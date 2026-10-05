import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { applyUsageCounterDelta } from "./organizationUsageCounters";

type ReadCtx = QueryCtx | MutationCtx;

export async function getPublicationSource(
  ctx: ReadCtx,
  media: Doc<"mediaFiles">,
) {
  if (!media.currentVersionId) {
    return { storageId: media.storageId, versionId: undefined };
  }
  const version = await ctx.db.get(media.currentVersionId);
  if (
    !version ||
    version.originalMediaId !== media._id ||
    version.organizationId !== media.organizationId
  ) {
    return null;
  }
  return { storageId: version.storageId, versionId: version._id };
}

export function getPublicationBlocker(media: Doc<"mediaFiles">, now: number) {
  if (
    media.fileType !== "image" ||
    media.mediaCategory === "document" ||
    !["image/jpeg", "image/png", "image/webp", "image/tiff"].includes(
      media.mimeType,
    )
  ) {
    return "Only supported images can be published";
  }
  if (media.uploadStatus !== "completed") return "Image upload is not complete";
  if (
    !["owned", "public_domain", "licensed"].includes(media.rightsStatus ?? "")
  ) {
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
  if (media.licenseExpiry !== undefined && media.licenseExpiry <= now) {
    return "License has expired";
  }
  if (media.usageRestrictions?.trim())
    return "Usage restrictions require review";
  if (media.requiresAcknowledgment)
    return "Acknowledgment requirements need a supported public display";
  return null;
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
  const source = await getPublicationSource(ctx, media);
  if (
    !source ||
    source.storageId !== approval.sourceStorageId ||
    source.versionId !== approval.versionId ||
    approval.renditionStorageId === source.storageId
  )
    return null;
  const url = await ctx.storage.getUrl(approval.renditionStorageId);
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
  await ctx.storage.delete(renditionStorageId);
  await applyUsageCounterDelta(ctx, media.organizationId, {
    storageBytes: -rendition.size,
  });
}
