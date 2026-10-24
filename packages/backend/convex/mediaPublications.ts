import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { type MutationCtx, query } from "./_generated/server";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { applyUsageCounterDelta } from "./utils/organizationUsageCounters";
import { hasPermission, requirePermission } from "./utils/permissions";
import {
  getApprovedPublicMedia,
  getPortalDisplayBlocker,
  getPortalImage,
  getPublicationBlocker,
  getPublicationSource,
  MAX_RENDITION_ATTEMPTS,
  renditionRetryAt,
  revokePublicRendition,
  syncPublicRendition as syncMediaPublicRendition,
} from "./utils/publicMedia";

export const getReview = query({
  args: { mediaId: v.id("mediaFiles") },
  returns: v.union(
    v.null(),
    v.object({
      canManage: v.boolean(),
      blocker: v.union(v.string(), v.null()),
      status: v.union(
        v.literal("private"),
        v.literal("processing"),
        v.literal("approved"),
        v.literal("failed"),
      ),
      portal: v.union(
        v.literal("shown"),
        v.literal("preparing"),
        v.literal("hidden"),
        v.literal("blocked"),
        v.literal("failed"),
      ),
      publicRenditionUrl: v.union(v.string(), v.null()),
      originalDownloadAllowed: v.boolean(),
      approvedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) return null;
    await requirePermission(ctx, media.organizationId, "media.read");
    const now = Date.now();
    const blocker = getPublicationBlocker(media, now);
    const approved = await getApprovedPublicMedia(
      ctx,
      media,
      media.organizationId,
      media.collectionId,
    );
    const portalImage = await getPortalImage(
      ctx,
      media,
      media.organizationId,
      media.collectionId,
    );
    const source = await getPublicationSource(ctx, media);
    const approval = media.publicApproval;
    const isCurrent =
      !!source &&
      approval?.sourceStorageId === source.storageId &&
      approval.versionId === source.versionId;
    return {
      canManage: await hasPermission(
        ctx,
        media.organizationId,
        "organization.manage_settings",
      ),
      blocker:
        blocker ??
        (!source
          ? "Source ownership or version is unverified. Reupload the image or create a verified version before approval."
          : null),
      status: !isCurrent
        ? ("private" as const)
        : approved
          ? ("approved" as const)
          : approval?.status === "processing" || approval?.status === "failed"
            ? approval.status
            : ("private" as const),
      portal:
        media.portalChoice === "hidden"
          ? ("hidden" as const)
          : getPortalDisplayBlocker(media, now)
            ? ("blocked" as const)
            : portalImage
              ? ("shown" as const)
              : media.publicRendition?.status === "failed"
                ? ("failed" as const)
                : ("preparing" as const),
      publicRenditionUrl: portalImage?.url ?? null,
      originalDownloadAllowed: !!approved?.originalDownloadUrl,
      approvedAt: approved ? approval?.approvedAt : undefined,
    };
  },
});

export const approve = mutation({
  args: { mediaId: v.id("mediaFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media not found");
    await requirePermission(
      ctx,
      media.organizationId,
      "organization.manage_settings",
    );
    const collection = await ctx.db.get(media.collectionId);
    if (!collection || collection.organizationId !== media.organizationId) {
      throw new Error("Object is unavailable in this organization");
    }
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const blocker = getPublicationBlocker(media, Date.now());
    if (blocker) throw new Error(blocker);
    const source = await getPublicationSource(ctx, media);
    if (!source)
      throw new Error(
        "Source ownership or version is unverified. Reupload the image or create a verified version before approval.",
      );
    await revokePublicRendition(ctx, media);
    const requestId = crypto.randomUUID();
    await ctx.db.patch(media._id, {
      portalChoice: "shown",
      publicApproval: {
        status: "processing",
        requestId,
        sourceStorageId: source.storageId,
        versionId: source.versionId,
        approvedBy: userId,
        approvedAt: Date.now(),
        allowOriginalDownload: false,
      },
    });
    await syncMediaPublicRendition(ctx, media._id);
    await ctx.scheduler.runAfter(
      0,
      internal.mediaPublicationsActions.processRendition,
      {
        mediaId: media._id,
        requestId,
        sourceStorageId: source.storageId,
      },
    );
    if (media.licenseExpiry !== undefined) {
      await ctx.scheduler.runAt(
        media.licenseExpiry,
        internal.mediaPublications.expireApproval,
        {
          mediaId: media._id,
          requestId,
        },
      );
    }
    return null;
  },
});

export const expireApproval = internalMutation({
  args: { mediaId: v.id("mediaFiles"), requestId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (
      media?.publicApproval?.requestId === args.requestId &&
      media.licenseExpiry !== undefined &&
      media.licenseExpiry <= Date.now()
    ) {
      await revokePublicRendition(ctx, media);
      await ctx.db.patch(media._id, { publicApproval: undefined });
    }
    return null;
  },
});

export const completeRendition = internalMutation({
  args: {
    mediaId: v.id("mediaFiles"),
    requestId: v.string(),
    sourceStorageId: v.id("_storage"),
    renditionStorageId: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    const approval = media?.publicApproval;
    if (
      !media ||
      approval?.status !== "processing" ||
      approval.requestId !== args.requestId ||
      approval.sourceStorageId !== args.sourceStorageId ||
      args.renditionStorageId === args.sourceStorageId ||
      getPublicationBlocker(media, Date.now())
    )
      return false;
    const source = await getPublicationSource(ctx, media);
    const rendition = await ctx.db.system.get(args.renditionStorageId);
    const existingOwnership = await ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) =>
        q.eq("storageId", args.renditionStorageId),
      )
      .unique();
    if (
      !source ||
      source.storageId !== args.sourceStorageId ||
      source.versionId !== approval.versionId ||
      !rendition ||
      existingOwnership
    )
      return false;
    await ctx.db.insert("storageOwnership", {
      storageId: args.renditionStorageId,
      organizationId: media.organizationId,
      uploadedBy: approval.approvedBy,
      uploadedAt: Date.now(),
      ownerType: "mediaRendition",
      ownerId: media._id,
    });
    await ctx.db.patch(media._id, {
      publicApproval: {
        ...approval,
        status: "approved",
        renditionStorageId: args.renditionStorageId,
      },
    });
    await applyUsageCounterDelta(ctx, media.organizationId, {
      storageBytes: rendition.size,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: media.organizationId,
      userId: approval.approvedBy,
      action: "approved_public_media",
      entityType: "media",
      entityId: media._id,
      changes: {
        versionId: approval.versionId,
        renditionStorageId: args.renditionStorageId,
      },
    });
    return true;
  },
});

export const completePublicRendition = internalMutation({
  args: {
    mediaId: v.id("mediaFiles"),
    requestId: v.string(),
    renditionStorageId: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    const request = media?.publicRendition;
    if (
      !media ||
      request?.status !== "processing" ||
      request.requestId !== args.requestId ||
      args.renditionStorageId === request.sourceStorageId
    )
      return false;
    const [rendition, existingOwnership] = await Promise.all([
      ctx.db.system.get(args.renditionStorageId),
      ctx.db
        .query("storageOwnership")
        .withIndex("by_storageId", (q) =>
          q.eq("storageId", args.renditionStorageId),
        )
        .unique(),
    ]);
    if (!rendition || existingOwnership) return false;
    await ctx.db.insert("storageOwnership", {
      storageId: args.renditionStorageId,
      organizationId: media.organizationId,
      uploadedBy: media.uploadedBy,
      uploadedAt: Date.now(),
      ownerType: "mediaRendition",
      ownerId: media._id,
    });
    await ctx.db.patch(media._id, {
      publicRendition: {
        status: "ready",
        sourceStorageId: request.sourceStorageId,
        renditionStorageId: args.renditionStorageId,
      },
    });
    await applyUsageCounterDelta(ctx, media.organizationId, {
      storageBytes: rendition.size,
    });
    return true;
  },
});

export const failPublicRendition = internalMutation({
  args: { mediaId: v.id("mediaFiles"), requestId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    const request = media?.publicRendition;
    if (
      media &&
      request?.status === "processing" &&
      request.requestId === args.requestId
    ) {
      const attempts = request.attempts ?? 1;
      await ctx.db.patch(media._id, {
        publicRendition: {
          status: "failed",
          sourceStorageId: request.sourceStorageId,
          attempts,
          retryAt: renditionRetryAt(attempts, Date.now()),
        },
      });
    }
    return null;
  },
});

export const syncPublicRendition = internalMutation({
  args: { mediaId: v.id("mediaFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await syncMediaPublicRendition(ctx, args.mediaId);
    return null;
  },
});

/**
 * Raising it makes the repair sweep run the rendition backfill once more.
 * Version 1 makes renditions for images from before they were made on upload
 * (MUS-870).
 */
const PUBLIC_RENDITION_BACKFILL_VERSION = 1;
const RENDITION_REPAIRS_PER_RUN = 25;

async function startPublicRenditionBackfill(ctx: MutationCtx, now: number) {
  const run = await ctx.db
    .query("publicRenditionBackfills")
    .withIndex("by_version", (q) =>
      q.eq("version", PUBLIC_RENDITION_BACKFILL_VERSION),
    )
    .first();
  if (run) return;
  const backfillId = await ctx.db.insert("publicRenditionBackfills", {
    version: PUBLIC_RENDITION_BACKFILL_VERSION,
    startedAt: now,
  });
  await ctx.scheduler.runAfter(
    0,
    internal.migrations.backfillPublicRenditions,
    { cursor: null, backfillId },
  );
}

/**
 * Run by a cron. Starts the rendition backfill once per version, then asks
 * again for renditions that failed or never reported back, at the time each
 * one set (MUS-870). A request still stuck after the last attempt is recorded
 * as failed, so staff see it.
 */
export const repairPublicRenditions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    await startPublicRenditionBackfill(ctx, now);
    const due = await ctx.db
      .query("mediaFiles")
      .withIndex("by_publicRendition_retryAt", (q) =>
        q.gte("publicRendition.retryAt", 0).lte("publicRendition.retryAt", now),
      )
      .take(RENDITION_REPAIRS_PER_RUN);
    for (const media of due) {
      const rendition = media.publicRendition;
      if (
        rendition?.status === "processing" &&
        (rendition.attempts ?? 1) >= MAX_RENDITION_ATTEMPTS
      ) {
        await ctx.db.patch(media._id, {
          publicRendition: {
            status: "failed",
            sourceStorageId: rendition.sourceStorageId,
            attempts: rendition.attempts,
          },
        });
      } else {
        await syncMediaPublicRendition(ctx, media._id);
      }
    }
    return null;
  },
});

export const failRendition = internalMutation({
  args: { mediaId: v.id("mediaFiles"), requestId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    const approval = media?.publicApproval;
    if (
      media &&
      approval?.status === "processing" &&
      approval.requestId === args.requestId
    ) {
      await ctx.db.patch(media._id, {
        publicApproval: { ...approval, status: "failed" },
      });
    }
    return null;
  },
});

export const setHiddenFromPortal = mutation({
  args: { mediaId: v.id("mediaFiles"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media not found");
    await requirePermission(
      ctx,
      media.organizationId,
      "organization.manage_settings",
    );
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.hidden) {
      await revokePublicRendition(ctx, media);
      await ctx.db.patch(media._id, {
        portalChoice: "hidden",
        publicApproval: undefined,
      });
    } else {
      await ctx.db.patch(media._id, { portalChoice: "shown" });
    }
    await syncMediaPublicRendition(ctx, media._id);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: media.organizationId,
      userId,
      action: args.hidden
        ? "unpublished_public_media"
        : "republished_public_media",
      entityType: "media",
      entityId: media._id,
    });
    return null;
  },
});

export const setOriginalDownload = mutation({
  args: { mediaId: v.id("mediaFiles"), allowed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media not found");
    await requirePermission(
      ctx,
      media.organizationId,
      "organization.manage_settings",
    );
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const approved = await getApprovedPublicMedia(
      ctx,
      media,
      media.organizationId,
      media.collectionId,
    );
    if (!approved || media.publicApproval?.status !== "approved")
      throw new Error("Approved rendition is required");
    await ctx.db.patch(media._id, {
      publicApproval: {
        ...media.publicApproval,
        allowOriginalDownload: args.allowed,
      },
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: media.organizationId,
      userId,
      action: args.allowed
        ? "enabled_public_original_download"
        : "disabled_public_original_download",
      entityType: "media",
      entityId: media._id,
    });
    return null;
  },
});
