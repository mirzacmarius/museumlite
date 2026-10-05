import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { applyUsageCounterDelta } from "./utils/organizationUsageCounters";
import { hasPermission, requirePermission } from "./utils/permissions";
import {
  getApprovedPublicMedia,
  getPublicationBlocker,
  getPublicationSource,
  revokePublicRendition,
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
      publicRenditionUrl: v.union(v.string(), v.null()),
      originalDownloadAllowed: v.boolean(),
      approvedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) return null;
    await requirePermission(ctx, media.organizationId, "media.read");
    const blocker = getPublicationBlocker(media, Date.now());
    const approved = await getApprovedPublicMedia(
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
      blocker: blocker ?? (!source ? "Image version is unavailable" : null),
      status: !isCurrent
        ? ("private" as const)
        : approved
          ? ("approved" as const)
          : approval?.status === "processing" || approval?.status === "failed"
            ? approval.status
            : ("private" as const),
      publicRenditionUrl: approved?.url ?? null,
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
    if (!source) throw new Error("Image version is unavailable");
    await revokePublicRendition(ctx, media);
    const requestId = crypto.randomUUID();
    await ctx.db.patch(media._id, {
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
    if (
      !source ||
      source.storageId !== args.sourceStorageId ||
      source.versionId !== approval.versionId ||
      !rendition
    )
      return false;
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

export const unpublish = mutation({
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await revokePublicRendition(ctx, media);
    await ctx.db.patch(media._id, { publicApproval: undefined });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: media.organizationId,
      userId,
      action: "unpublished_public_media",
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
