import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { applyUsageCounterDelta } from "./organizationUsageCounters";

type ReadCtx = QueryCtx | MutationCtx;

export async function getPublicationSource(
  ctx: ReadCtx,
  media: Doc<"mediaFiles">,
) {
  let storageId = media.storageId;
  let versionId: Id<"mediaVersions"> | undefined;
  let ownerType = "media";
  let ownerId: string = media._id;
  let uploadedBy = media.uploadedBy;
  if (media.currentVersionId) {
    const version = await ctx.db.get(media.currentVersionId);
    if (
      !version ||
      version.originalMediaId !== media._id ||
      version.organizationId !== media.organizationId
    )
      return null;
    storageId = version.storageId;
    versionId = version._id;
    ownerType = "mediaVersion";
    ownerId = version._id;
    uploadedBy = version.createdBy;
  }
  const [blob, ownership] = await Promise.all([
    ctx.db.system.get(storageId),
    ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique(),
  ]);
  if (
    !blob ||
    ownership?.organizationId !== media.organizationId ||
    ownership.ownerType !== ownerType ||
    ownership.ownerId !== ownerId ||
    ownership.uploadedBy !== uploadedBy
  )
    return null;
  return { storageId, versionId };
}

function isSupportedImage(media: Doc<"mediaFiles">) {
  return (
    media.fileType === "image" &&
    ["image/jpeg", "image/png", "image/webp", "image/tiff"].includes(
      media.mimeType,
    )
  );
}

function getRecordedRestriction(media: Doc<"mediaFiles">) {
  if (!isSupportedImage(media) || media.mediaCategory === "document") {
    return "Only supported images can be published";
  }
  if (media.uploadStatus !== "completed") return "Image upload is not complete";
  if (media.rightsStatus === "restricted") {
    return "Rights must be owned, public domain, or licensed for public use";
  }
  if (
    media.licenseType === "internal_only" ||
    media.licenseType === "editorial_only" ||
    media.licenseType === "custom"
  )
    return "License does not establish public display rights";
  if (
    media.rightsStatus === "licensed" &&
    media.licenseType !== "creative_commons_zero"
  ) {
    return "Licensed image needs a public license without unsupported conditions";
  }
  if (media.usageRestrictions?.trim())
    return "Usage restrictions require review";
  if (media.requiresAcknowledgment)
    return "Acknowledgment requirements need a supported public display";
  return null;
}

export function getPortalDisplayBlocker(media: Doc<"mediaFiles">, now: number) {
  const restriction = getRecordedRestriction(media);
  if (restriction) return restriction;
  if (media.licenseExpiry !== undefined && media.licenseExpiry <= now) {
    return "License has expired";
  }
  return null;
}

export function getPublicationBlocker(media: Doc<"mediaFiles">, now: number) {
  const blocker = getPortalDisplayBlocker(media, now);
  if (blocker) return blocker;
  if (
    !["owned", "public_domain", "licensed"].includes(media.rightsStatus ?? "")
  ) {
    return "Rights must be owned, public domain, or licensed for public use";
  }
  return null;
}

async function getCurrentImageFile(ctx: ReadCtx, media: Doc<"mediaFiles">) {
  if (!media.currentVersionId) return media.storageId;
  const version = await ctx.db.get(media.currentVersionId);
  return version?.originalMediaId === media._id &&
    version.organizationId === media.organizationId
    ? version.storageId
    : null;
}

export async function getPortalImage(
  ctx: ReadCtx,
  media: Doc<"mediaFiles">,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  if (
    media.organizationId !== organizationId ||
    media.collectionId !== collectionId ||
    media.portalChoice === "hidden" ||
    getRecordedRestriction(media)
  )
    return null;
  const approved = await getApprovedPublicMedia(
    ctx,
    media,
    organizationId,
    collectionId,
  );
  if (approved) return approved;
  const rendition = media.publicRendition;
  if (
    rendition?.status !== "ready" ||
    rendition.sourceStorageId !== (await getCurrentImageFile(ctx, media))
  )
    return null;
  const url = await ctx.storage.getUrl(rendition.renditionStorageId);
  if (!url) return null;
  return {
    _id: media._id,
    url,
    isPrimary: media.isPrimary,
    caption: media.caption,
    originalDownloadUrl: undefined,
  };
}

const STALE_RENDITION_MS = 15 * 60 * 1000;

export async function syncPublicRendition(
  ctx: MutationCtx,
  mediaId: Id<"mediaFiles">,
) {
  const media = await ctx.db.get(mediaId);
  if (!media) return;
  const now = Date.now();
  const rendition = media.publicRendition;
  const sourceStorageId =
    media.portalChoice === "hidden" || getPortalDisplayBlocker(media, now)
      ? null
      : await getCurrentImageFile(ctx, media);
  if (!sourceStorageId) {
    if (rendition?.status === "ready") {
      await deleteRendition(ctx, media, rendition.renditionStorageId);
    }
    if (rendition)
      await ctx.db.patch(media._id, { publicRendition: undefined });
    return;
  }
  if (media.licenseExpiry !== undefined) {
    await ctx.scheduler.runAt(
      media.licenseExpiry,
      internal.mediaPublications.syncPublicRendition,
      { mediaId: media._id },
    );
  }
  if (
    rendition?.sourceStorageId === sourceStorageId &&
    (rendition.status === "ready" ||
      (rendition.status === "processing" &&
        now - rendition.requestedAt < STALE_RENDITION_MS))
  )
    return;
  if (rendition?.status === "ready") {
    await deleteRendition(ctx, media, rendition.renditionStorageId);
  }
  const requestId = crypto.randomUUID();
  await ctx.db.patch(media._id, {
    publicRendition: {
      status: "processing",
      sourceStorageId,
      requestId,
      requestedAt: now,
    },
  });
  await ctx.scheduler.runAfter(
    0,
    internal.mediaPublicationsActions.processPublicRendition,
    { mediaId: media._id, requestId, sourceStorageId },
  );
}

async function deleteRendition(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
  renditionStorageId: Id<"_storage">,
) {
  const [rendition, ownership] = await Promise.all([
    ctx.db.system.get(renditionStorageId),
    ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", renditionStorageId))
      .unique(),
  ]);
  if (
    !rendition ||
    ownership?.ownerType !== "mediaRendition" ||
    ownership.ownerId !== media._id
  )
    return;
  await ctx.storage.delete(renditionStorageId);
  await ctx.db.delete(ownership._id);
  if (ownership.organizationId) {
    await applyUsageCounterDelta(ctx, ownership.organizationId, {
      storageBytes: -rendition.size,
    });
  }
}

export async function getApprovedPublicMedia(
  ctx: ReadCtx,
  media: Doc<"mediaFiles">,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  if (
    media.organizationId !== organizationId ||
    media.collectionId !== collectionId ||
    getPublicationBlocker(media, Date.now())
  )
    return null;
  const approval = media.publicApproval;
  if (approval?.status !== "approved" || !approval.renditionStorageId)
    return null;
  const renditionStorageId = approval.renditionStorageId;
  const source = await getPublicationSource(ctx, media);
  if (
    !source ||
    source.storageId !== approval.sourceStorageId ||
    source.versionId !== approval.versionId ||
    renditionStorageId === source.storageId
  )
    return null;
  const ownership = await ctx.db
    .query("storageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", renditionStorageId))
    .unique();
  if (
    ownership?.organizationId !== media.organizationId ||
    ownership.ownerType !== "mediaRendition" ||
    ownership.ownerId !== media._id
  )
    return null;
  const url = await ctx.storage.getUrl(renditionStorageId);
  if (!url) return null;
  return {
    _id: media._id,
    url,
    isPrimary: media.isPrimary,
    caption: media.caption,
    originalDownloadUrl: approval.allowOriginalDownload
      ? ((await ctx.storage.getUrl(source.storageId)) ?? undefined)
      : undefined,
  };
}

export async function revokePublicRendition(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
) {
  const renditionStorageId = media.publicApproval?.renditionStorageId;
  if (
    !renditionStorageId ||
    renditionStorageId === media.storageId ||
    renditionStorageId === media.thumbnailStorageId
  )
    return;
  const version = media.currentVersionId
    ? await ctx.db.get(media.currentVersionId)
    : null;
  if (version?.storageId === renditionStorageId) return;
  const rendition = await ctx.db.system.get(renditionStorageId);
  if (!rendition) return;
  const ownership = await ctx.db
    .query("storageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", renditionStorageId))
    .unique();
  if (
    ownership &&
    (ownership.organizationId !== media.organizationId ||
      ownership.ownerType !== "mediaRendition" ||
      ownership.ownerId !== media._id)
  )
    return;
  await ctx.storage.delete(renditionStorageId);
  if (ownership) await ctx.db.delete(ownership._id);
  await applyUsageCounterDelta(ctx, media.organizationId, {
    storageBytes: -rendition.size,
  });
}
