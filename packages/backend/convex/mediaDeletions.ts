import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import {
  assertImageCanBeDeleted,
  destroyObjectImage,
  findPendingDeletionRequest,
  isDeletableObjectImage,
  resolveImageDeletionApproval,
} from "./utils/imageDeletion";
import { imageDeletionError } from "./utils/imageDeletionErrors";
import { mutation } from "./utils/mutationBuilders";
import { hasPermission, requirePermission } from "./utils/permissions";
import { isAccessionWorkflowEnabled } from "./utils/workflowConfigs";

// Pending requests are few; this bounds what one page lists.
const PENDING_LIST_LIMIT = 100;

async function requireUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function loadImageForDeletion(
  ctx: MutationCtx,
  mediaId: Id<"mediaFiles">,
) {
  const media = await ctx.db.get(mediaId);
  if (!media) throw new Error("Media not found");
  await requirePermission(ctx, media.organizationId, "media.delete");
  return media;
}

/** Refuses a command the organization's approval setting no longer allows. */
async function requireApprovalSetting(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
  requiresApproval: boolean,
) {
  if (
    (await isAccessionWorkflowEnabled(ctx, media.organizationId)) !==
    requiresApproval
  ) {
    throw imageDeletionError(
      "APPROVAL_SETTING_CHANGED",
      requiresApproval
        ? "Image deletion no longer needs approval"
        : "Image deletion now needs approval",
    );
  }
}

async function logImageAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: string,
  media: Pick<Doc<"mediaFiles">, "_id" | "organizationId" | "collectionId">,
  changes: Record<string, string>,
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: media.organizationId,
    userId,
    action,
    entityType: "media",
    entityId: media._id,
    changes: { collectionId: media.collectionId, ...changes },
  });
}

async function loadPendingRequest(
  ctx: MutationCtx,
  requestId: Id<"mediaDeletionRequests">,
) {
  const request = await ctx.db.get(requestId);
  if (!request) throw new Error("Deletion request not found");
  const approval = await resolveImageDeletionApproval(
    ctx,
    request.organizationId,
  );
  if (!approval.allowed) throw approval.refusal;
  if (request.status !== "pending") {
    throw imageDeletionError(
      "DELETION_REQUEST_CLOSED",
      "This deletion request was already decided",
    );
  }
  return request;
}

/** What the image editor needs to offer deletion of one image. */
export const getDeletionState = query({
  args: { mediaId: v.id("mediaFiles") },
  returns: v.union(
    v.object({
      canDelete: v.boolean(),
      requiresApproval: v.boolean(),
      pendingRequestedAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) return null;
    await requirePermission(ctx, media.organizationId, "media.read");
    const [mayDelete, requiresApproval, pending] = await Promise.all([
      hasPermission(ctx, media.organizationId, "media.delete"),
      isAccessionWorkflowEnabled(ctx, media.organizationId),
      findPendingDeletionRequest(ctx, media),
    ]);
    return {
      canDelete: mayDelete && isDeletableObjectImage(media),
      requiresApproval,
      pendingRequestedAt: pending?.requestedAt ?? null,
    };
  },
});

/** Images of an object that wait for deletion approval. */
export const listPendingForObject = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(v.id("mediaFiles")),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) return [];
    await requirePermission(ctx, collection.organizationId, "media.read");
    const pending = await ctx.db
      .query("mediaDeletionRequests")
      .withIndex("by_collection_and_status", (q) =>
        q.eq("collectionId", args.collectionId).eq("status", "pending"),
      )
      .take(PENDING_LIST_LIMIT);
    return pending.flatMap((request) =>
      request.organizationId === collection.organizationId
        ? [request.mediaId]
        : [],
    );
  },
});

/** Image deletions waiting for approval, oldest first. */
export const listPending = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    canDecide: v.boolean(),
    requests: v.array(
      v.object({
        _id: v.id("mediaDeletionRequests"),
        mediaId: v.id("mediaFiles"),
        collectionId: v.id("collections"),
        fileName: v.string(),
        objectTitle: v.union(v.string(), v.null()),
        accessionNumber: v.union(v.string(), v.null()),
        imageUrl: v.union(v.string(), v.null()),
        requestedAt: v.number(),
        requestedByName: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.read");
    const [approval, pending] = await Promise.all([
      resolveImageDeletionApproval(ctx, args.organizationId),
      ctx.db
        .query("mediaDeletionRequests")
        .withIndex("by_organization_and_status_and_requestedAt", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "pending"),
        )
        .take(PENDING_LIST_LIMIT),
    ]);
    const requests = await Promise.all(
      pending.map(async (request) => {
        const [media, collection, requester] = await Promise.all([
          ctx.db.get(request.mediaId),
          ctx.db.get(request.collectionId),
          ctx.db.get(request.requestedBy),
        ]);
        const imageStorageId = media?.thumbnailStorageId ?? media?.storageId;
        return {
          _id: request._id,
          mediaId: request.mediaId,
          collectionId: request.collectionId,
          fileName: request.fileName,
          objectTitle: collection?.title ?? null,
          accessionNumber: collection?.accessionNumber ?? null,
          imageUrl: imageStorageId
            ? await ctx.storage.getUrl(imageStorageId)
            : null,
          requestedAt: request.requestedAt,
          requestedByName: requester?.name || requester?.email || null,
        };
      }),
    );
    return { canDecide: approval.allowed, requests };
  },
});

/**
 * Asks for an image's deletion while the accessions approval workflow is on.
 * The image stays until an approver decides.
 */
export const requestImageDeletion = mutation({
  args: { mediaId: v.id("mediaFiles") },
  returns: v.id("mediaDeletionRequests"),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const media = await loadImageForDeletion(ctx, args.mediaId);
    await requireApprovalSetting(ctx, media, true);
    await assertImageCanBeDeleted(ctx, media);
    const requestId = await ctx.db.insert("mediaDeletionRequests", {
      organizationId: media.organizationId,
      mediaId: media._id,
      collectionId: media.collectionId,
      fileName: media.fileName,
      status: "pending",
      requestedBy: userId,
      requestedAt: Date.now(),
    });
    await logImageAction(ctx, userId, "requested_media_deletion", media, {
      fileName: media.fileName,
      requestId,
    });
    return requestId;
  },
});

/** Deletes an image at once while the accessions approval workflow is off. */
export const deleteImage = mutation({
  args: { mediaId: v.id("mediaFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const media = await loadImageForDeletion(ctx, args.mediaId);
    await requireApprovalSetting(ctx, media, false);
    await assertImageCanBeDeleted(ctx, media);
    await logImageAction(ctx, userId, "deleted_media", media, {
      fileName: media.fileName,
    });
    await destroyObjectImage(ctx, media);
    return null;
  },
});

/** Approves a deletion request, which deletes the image for good. */
export const approve = mutation({
  args: { requestId: v.id("mediaDeletionRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await loadPendingRequest(ctx, args.requestId);
    const media = await ctx.db.get(request.mediaId);
    if (!media || media.organizationId !== request.organizationId) {
      throw imageDeletionError(
        "DELETION_REQUEST_CLOSED",
        "The image of this request no longer exists",
      );
    }
    await assertImageCanBeDeleted(ctx, media, { allowPendingRequest: true });
    await ctx.db.patch(request._id, {
      status: "approved",
      decidedBy: userId,
      decidedAt: Date.now(),
    });
    await logImageAction(ctx, userId, "approved_media_deletion", media, {
      fileName: media.fileName,
      requestId: request._id,
    });
    await logImageAction(ctx, userId, "deleted_media", media, {
      fileName: media.fileName,
      requestId: request._id,
    });
    await destroyObjectImage(ctx, media);
    return null;
  },
});

/** Rejects a deletion request; the image stays with its object. */
export const reject = mutation({
  args: { requestId: v.id("mediaDeletionRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await loadPendingRequest(ctx, args.requestId);
    await ctx.db.patch(request._id, {
      status: "rejected",
      decidedBy: userId,
      decidedAt: Date.now(),
    });
    await logImageAction(
      ctx,
      userId,
      "rejected_media_deletion",
      {
        _id: request.mediaId,
        organizationId: request.organizationId,
        collectionId: request.collectionId,
      },
      { fileName: request.fileName, requestId: request._id },
    );
    return null;
  },
});
