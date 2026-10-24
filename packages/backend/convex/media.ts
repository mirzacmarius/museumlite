import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { getAuthorizedCollectionBatch } from "./utils/authorizedCollectionBatch";
import { batchGetByIds, createLookupMap } from "./utils/batchLookup";
import {
  getDisplayedMediaFiles,
  getDisplayedMediaThumbnailUrl,
  isWatermarkedVersion,
} from "./utils/collectionDisplayHelpers";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { requireExhibitionAccess } from "./utils/exhibitionAccess";
import { enforceMediaQuota } from "./utils/featureGates";
import {
  getDefaultMediaCategory,
  getMediaFileType,
  insertCompletedMediaAsset,
  isSupportedMediaMimeType,
  MAX_SMALL_MEDIA_FILE_SIZE,
} from "./utils/mediaAssets";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { applyUsageCounterDelta } from "./utils/organizationUsageCounters";
import {
  requireModuleAndPermission,
  requirePermission,
} from "./utils/permissions";
import {
  canBePrimaryImage,
  clearOtherPrimaryMedia,
  makeOnlyPrimaryImage,
  resolveNewMediaPrimary,
} from "./utils/primaryMedia";
import { buildStorageStats } from "./utils/projectionReports";
import { projectionUnavailableResult } from "./utils/projectionValidators";
import {
  revokePublicRendition,
  syncPublicRendition,
} from "./utils/publicMedia";
import {
  accessionReferenceProblems,
  objectReferenceProblems,
} from "./utils/recordReferences";
import { getRelatedEntityOrganization } from "./utils/relatedEntityIntegrity";
import {
  rightsStatementInEffect,
  rightsStatementValidator,
} from "./utils/rightsStatements";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
  validateOwnedUploadSize,
} from "./utils/uploadOwnership";
import { emitWebhookEvent } from "./utils/webhookEvents";

function isImageMedia(media: {
  fileType?: string;
  mediaCategory?: "image" | "document";
  mimeType?: string;
}) {
  return (
    media.fileType === "image" ||
    media.mediaCategory === "image" ||
    media.mimeType?.startsWith("image/") === true
  );
}

async function getPreferredImageMedia(
  ctx: QueryCtx,
  collectionId: Id<"collections">,
) {
  const mediaFiles = await ctx.db
    .query("mediaFiles")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  const imageMedia = mediaFiles.filter((media) => isImageMedia(media));
  return imageMedia.find((media) => media.isPrimary) ?? imageMedia[0] ?? null;
}

/**
 * Generate upload URL for file
 */
export const generateUploadUrl = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
    storageId: v.optional(v.id("_storage")),
    isChunked: v.boolean(),
    chunkId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (!isSupportedMediaMimeType(args.mimeType)) {
      throw new Error(`Unsupported file type: ${args.mimeType}`);
    }

    await requirePermission(ctx, args.organizationId, "media.upload");

    const uploadCollection = await ctx.db.get(args.collectionId);
    if (
      !uploadCollection ||
      uploadCollection.organizationId !== args.organizationId
    ) {
      throw new Error("Collection does not belong to this organization");
    }

    validateOwnedUploadSize(args.fileSize);
    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    // Small files - direct upload
    const uploadUrl = await createAuthorizedUploadUrl(
      ctx,
      userId,
      args.organizationId,
    );
    return {
      uploadUrl,
      isChunked: false,
    };
  },
});

/**
 * Create media record after upload
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    mediaCategory: v.optional(
      v.union(v.literal("image"), v.literal("document")),
    ),
    isPrimary: v.optional(v.boolean()),
    caption: v.optional(v.string()),
    photographer: v.optional(v.string()),
    copyright: v.optional(v.string()),
    chunkId: v.optional(v.string()),
  },
  returns: v.id("mediaFiles"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "media.upload");

    const targetCollection = await ctx.db.get(args.collectionId);
    if (
      !targetCollection ||
      targetCollection.organizationId !== args.organizationId
    ) {
      throw new Error("Collection does not belong to this organization");
    }

    validateOwnedUploadSize(args.fileSize);
    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    const fileCategory = getMediaFileType(args.mimeType);
    const mediaCategory = getDefaultMediaCategory(
      fileCategory,
      args.mediaCategory,
    );

    if (args.chunkId)
      throw new Error(
        "Chunked uploads are unavailable; upload a file up to 20 MB",
      );

    const isPrimary = await resolveNewMediaPrimary(ctx, {
      collectionId: args.collectionId,
      fileType: fileCategory,
      mediaCategory,
      requested: args.isPrimary,
    });
    const { mediaId } = await insertCompletedMediaAsset(ctx, {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      mediaCategory,
      isPrimary,
      caption: args.caption,
      photographer: args.photographer,
      copyright: args.copyright,
      uploadedBy: userId,
    });
    if (isPrimary) {
      await clearOtherPrimaryMedia(ctx, args.collectionId, mediaId);
    }
    await claimStorageOwnership(ctx, {
      storageId: args.storageId,
      organizationId: args.organizationId,
      uploadedBy: userId,
      ownerType: "media",
      ownerId: mediaId,
      expectedFileSize: args.fileSize,
      expectedMimeType: args.mimeType,
    });
    await syncPublicRendition(ctx, mediaId);

    await emitWebhookEvent(ctx, args.organizationId, "media.uploaded", {
      mediaId,
    });

    return mediaId;
  },
});

/**
 * List media for a collection object
 */
export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaFiles"),
      storageId: v.id("_storage"),
      thumbnailStorageId: v.optional(v.id("_storage")),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      mimeType: v.string(),
      mediaCategory: v.optional(
        v.union(v.literal("image"), v.literal("document")),
      ),
      isPrimary: v.boolean(),
      displayOrder: v.optional(v.number()),
      caption: v.optional(v.string()),
      photographer: v.optional(v.string()),
      copyright: v.optional(v.string()),
      /** The file's own statement; absent when its Organization's applies. */
      rightsStatement: v.optional(rightsStatementValidator),
      url: v.union(v.string(), v.null()),
      thumbnailUrl: v.union(v.string(), v.null()),
      uploadStatus: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const [, mediaFiles] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "media.read"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect(),
    ] as const);

    const mediaWithUrls = await Promise.all(
      mediaFiles.map(async (media) => {
        const shown = await getDisplayedMediaFiles(ctx, media);
        const url = await ctx.storage.getUrl(shown.storageId);
        const thumbnailUrl = shown.thumbnailStorageId
          ? await ctx.storage.getUrl(shown.thumbnailStorageId)
          : null;

        return {
          _id: media._id,
          storageId: media.storageId,
          thumbnailStorageId: media.thumbnailStorageId,
          fileName: media.fileName,
          fileType: media.fileType,
          fileSize: media.fileSize,
          mimeType: media.mimeType,
          mediaCategory: media.mediaCategory,
          isPrimary: media.isPrimary,
          displayOrder: media.displayOrder,
          caption: media.caption,
          photographer: media.photographer,
          copyright: media.copyright,
          rightsStatement: media.rightsStatement,
          url,
          thumbnailUrl,
          uploadStatus: media.uploadStatus,
        };
      }),
    );

    mediaWithUrls.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    return mediaWithUrls;
  },
});

/**
 * Update media metadata
 */
export const update = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    caption: v.optional(v.string()),
    photographer: v.optional(v.string()),
    copyright: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      media.organizationId,
      "media.upload", // Using upload permission for updates
    );

    const updates: {
      caption?: string;
      photographer?: string;
      copyright?: string;
      isPrimary?: boolean;
    } = {};

    if (args.caption !== undefined) updates.caption = args.caption;
    if (args.photographer !== undefined)
      updates.photographer = args.photographer;
    if (args.copyright !== undefined) updates.copyright = args.copyright;
    if (args.isPrimary === true) {
      await makeOnlyPrimaryImage(ctx, media);
    } else if (
      args.isPrimary === false &&
      media.isPrimary &&
      canBePrimaryImage(media)
    ) {
      throw new Error("Choose another image as the primary image instead");
    }
    if (args.isPrimary !== undefined) updates.isPrimary = args.isPrimary;

    await Promise.all([
      ctx.db.patch(args.mediaId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: media.organizationId,
        userId,
        action: "updated_media",
        entityType: "media",
        entityId: args.mediaId,
        changes: updates,
      }),
    ]);

    return null;
  },
});

/**
 * Delete media file
 */
export const deleteMedia = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.delete");
    return rejectPermanentEvidenceDeletion();
  },
});

/**
 * Set primary image
 */
export const setPrimary = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    await requirePermission(ctx, media.organizationId, "media.upload");
    await makeOnlyPrimaryImage(ctx, media);

    return null;
  },
});

/**
 * Get thumbnail URL
 */
export const getThumbnailUrl = query({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return null;
    }

    await requirePermission(ctx, media.organizationId, "media.read");

    return await getDisplayedMediaThumbnailUrl(ctx, media);
  },
});

/**
 * Get primary image thumbnail URL for a collection object
 */
export const getPrimaryImageUrl = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    await requirePermission(ctx, collection.organizationId, "media.read");

    const primaryMedia = await getPreferredImageMedia(ctx, args.collectionId);

    if (!primaryMedia) {
      return null;
    }
    if (primaryMedia.organizationId !== collection.organizationId) {
      throw new Error("Media organization does not match collection");
    }

    return await getDisplayedMediaThumbnailUrl(ctx, primaryMedia);
  },
});

/**
 * Get primary image thumbnail URLs for multiple collection objects (batched)
 * This avoids N+1 query patterns when fetching primary images for multiple collections
 */
export const getBatchPrimaryImageUrls = query({
  args: {
    collectionIds: v.array(v.id("collections")),
  },
  returns: v.array(
    v.object({
      collectionId: v.id("collections"),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.collectionIds.length === 0) {
      return [];
    }

    const collectionMap = await getAuthorizedCollectionBatch(
      ctx,
      args.collectionIds,
      "media.read",
    );

    // Batch query for primary media for each collection
    const primaryMediaResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        const collection = collectionMap.get(collectionId);
        if (!collection) {
          return { collectionId, media: null };
        }

        const primaryMedia = await getPreferredImageMedia(ctx, collectionId);
        if (
          primaryMedia &&
          primaryMedia.organizationId !== collection.organizationId
        ) {
          throw new Error("Media organization does not match collection");
        }

        return { collectionId, media: primaryMedia };
      }),
    );

    const urlResults = await Promise.all(
      primaryMediaResults.map(async (result) => ({
        collectionId: result.collectionId,
        url: result.media
          ? await getDisplayedMediaThumbnailUrl(ctx, result.media)
          : null,
      })),
    );

    // Create map of collectionId -> url
    const urlMap = new Map<Id<"collections">, string | null>();
    for (const result of urlResults) {
      urlMap.set(result.collectionId, result.url);
    }

    // Map results in order
    return args.collectionIds.map((collectionId) => ({
      collectionId,
      url: urlMap.get(collectionId) || null,
    }));
  },
});

/**
 * Get upload progress for large files
 */
export const getUploadProgress = query({
  args: {
    organizationId: v.id("organizations"),
    chunkId: v.string(),
  },
  returns: v.union(
    v.object({
      progress: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.upload");

    const media = await ctx.db
      .query("mediaFiles")
      .withIndex("by_chunkedUploadId", (q) =>
        q.eq("chunkedUploadId", args.chunkId),
      )
      .first();

    if (!media || media.organizationId !== args.organizationId) {
      return null;
    }

    let progress = 0;
    if (media.uploadStatus === "completed") {
      progress = 100;
    } else if (media.uploadStatus === "processing") {
      progress = 50;
    } else if (media.uploadStatus === "failed") {
      progress = 0;
    }

    return {
      progress,
      status: media.uploadStatus,
    };
  },
});

const storageUrlResultValidator = v.object({
  storageId: v.id("_storage"),
  url: v.union(v.string(), v.null()),
});

export const getStorageUrls = query({
  args: {
    organizationId: v.id("organizations"),
    storageIds: v.array(v.id("_storage")),
  },
  returns: v.array(storageUrlResultValidator),
  handler: async (ctx, args) => {
    if (args.storageIds.length === 0) {
      return [];
    }

    await requirePermission(ctx, args.organizationId, "media.read");

    const uniqueStorageIds = [...new Set(args.storageIds)];
    const authorizedIds = new Set<Id<"_storage">>();

    await Promise.all(
      uniqueStorageIds.map(async (storageId) => {
        const media = await ctx.db
          .query("mediaFiles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .filter((q) =>
            q.or(
              q.eq(q.field("storageId"), storageId),
              q.eq(q.field("thumbnailStorageId"), storageId),
            ),
          )
          .first();

        if (media) {
          authorizedIds.add(storageId);
        }
      }),
    );

    return await Promise.all(
      uniqueStorageIds.map(async (storageId) => {
        if (!authorizedIds.has(storageId)) {
          return { storageId, url: null };
        }

        const url = await ctx.storage.getUrl(storageId);
        return { storageId, url };
      }),
    );
  },
});

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
    fileType: v.optional(v.string()),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("mediaFiles"),
        _creationTime: v.number(),
        collectionId: v.id("collections"),
        collectionTitle: v.string(),
        accessionNumber: v.optional(v.string()),
        storageId: v.id("_storage"),
        thumbnailStorageId: v.optional(v.id("_storage")),
        fileName: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
        mimeType: v.string(),
        mediaCategory: v.optional(
          v.union(v.literal("image"), v.literal("document")),
        ),
        isPrimary: v.boolean(),
        caption: v.optional(v.string()),
        photographer: v.optional(v.string()),
        copyright: v.optional(v.string()),
        rightsStatement: v.optional(rightsStatementValidator),
        uploadedAt: v.number(),
        uploaderName: v.optional(v.string()),
        currentVersionId: v.optional(v.id("mediaVersions")),
        versionCount: v.optional(v.number()),
      }),
    ),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.read");

    const search = args.search?.trim();
    const fileType = args.fileType;
    const paginationResult = search
      ? await ctx.db
          .query("mediaFiles")
          .withSearchIndex("search_media_files", (q) => {
            const withOrg = q
              .search("fileName", search)
              .eq("organizationId", args.organizationId);
            return fileType ? withOrg.eq("fileType", fileType) : withOrg;
          })
          .paginate(args.paginationOpts)
      : fileType
        ? await ctx.db
            .query("mediaFiles")
            .withIndex("by_organization_and_fileType_and_uploadedAt", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("fileType", fileType),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("mediaFiles")
            .withIndex("by_organization_and_uploadedAt", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .order("desc")
            .paginate(args.paginationOpts);

    const collectionIds = paginationResult.page.map((m) => m.collectionId);
    const uploaderIds = paginationResult.page.map((m) => m.uploadedBy);
    const [collections, uploaders] = await Promise.all([
      batchGetByIds<"collections">(ctx, collectionIds, "collections"),
      batchGetByIds<"users">(ctx, uploaderIds, "users"),
    ]);
    const collectionMap = createLookupMap<"collections">(collections);
    const uploaderMap = createLookupMap<"users">(uploaders);

    const enriched = paginationResult.page.map((media) => {
      const collection = collectionMap.get(media.collectionId);
      const uploader = uploaderMap.get(media.uploadedBy);

      return {
        _id: media._id,
        _creationTime: media._creationTime,
        collectionId: media.collectionId,
        collectionTitle: collection?.title ?? "Unknown",
        accessionNumber: collection?.accessionNumber,
        storageId: media.storageId,
        thumbnailStorageId: media.thumbnailStorageId,
        fileName: media.fileName,
        fileType: media.fileType,
        fileSize: media.fileSize,
        mimeType: media.mimeType,
        mediaCategory: media.mediaCategory,
        isPrimary: media.isPrimary,
        caption: media.caption,
        photographer: media.photographer,
        copyright: media.copyright,
        rightsStatement: media.rightsStatement,
        uploadedAt: media.uploadedAt,
        uploaderName: uploader?.name ?? uploader?.username,
        currentVersionId: media.currentVersionId,
        versionCount: media.versionCount,
      };
    });

    return {
      page: enriched,
      continueCursor: paginationResult.continueCursor,
      isDone: paginationResult.isDone,
    };
  },
});

export const getStorageStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
      updating: v.optional(v.boolean()),
      totalFiles: v.number(),
      totalSize: v.number(),
      byType: v.array(
        v.object({
          type: v.string(),
          count: v.number(),
          size: v.number(),
        }),
      ),
      recentUploads: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.read");
    return await buildStorageStats(
      ctx,
      args.organizationId,
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    );
  },
});

export const checkFileType = query({
  args: {
    mimeType: v.string(),
  },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    return isSupportedMediaMimeType(args.mimeType);
  },
});

export const updateOrder = mutation({
  args: {
    mediaIds: v.array(v.id("mediaFiles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.mediaIds.length === 0) {
      return null;
    }

    const firstMedia = await ctx.db.get(args.mediaIds[0] as Id<"mediaFiles">);
    if (!firstMedia) {
      throw new Error("Media not found");
    }

    await requirePermission(ctx, firstMedia.organizationId, "media.upload");

    const mediaDocs = await Promise.all(
      args.mediaIds.map((mediaId) => ctx.db.get(mediaId)),
    );

    for (const media of mediaDocs) {
      if (!media) {
        throw new Error("Media not found");
      }
      if (media.organizationId !== firstMedia.organizationId) {
        throw new Error("Media does not belong to this organization");
      }
    }

    await Promise.all([
      ...args.mediaIds.map((mediaId, i) =>
        mediaId
          ? ctx.db.patch(mediaId, { displayOrder: i })
          : Promise.resolve(),
      ),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: firstMedia.organizationId,
        userId,
        action: "reordered_media",
        entityType: "media",
        entityId: args.mediaIds[0] as Id<"mediaFiles">,
        changes: {
          mediaCount: args.mediaIds.length,
          collectionId: firstMedia.collectionId,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Internal: Generate thumbnail for primary images.
 * The thumbnail is an optional derivative: the original upload keeps its
 * completed status while the action runs, and the action reports back through
 * `attachThumbnail`.
 */
export const generateThumbnail = internalMutation({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return null;
    }

    // Only generate thumbnails for images <50MB
    if (
      media.fileType !== "image" ||
      media.fileSize >= MAX_SMALL_MEDIA_FILE_SIZE
    ) {
      return null;
    }

    // Earlier thumbnail processing marked finished uploads as "processing"
    // and never restored them. A non-chunked record with a stored original is
    // a completed upload.
    if (
      media.uploadStatus === "processing" &&
      !media.chunkedUploadId &&
      (await ctx.db.system.get(media.storageId))
    ) {
      await ctx.db.patch(args.mediaId, { uploadStatus: "completed" });
      await syncPublicRendition(ctx, args.mediaId);
    }

    // Skip if thumbnail already exists
    if (media.thumbnailStorageId) {
      return null;
    }

    await ctx.scheduler.runAfter(0, internal.mediaThumbnails.processThumbnail, {
      mediaId: args.mediaId,
      storageId: media.storageId,
    });

    return null;
  },
});

/**
 * Internal: Attach a generated thumbnail. Returns false when the derivative
 * is stale (source replaced, media removed, thumbnail already attached) so the
 * action can delete the unreferenced blob.
 */
export const attachThumbnail = internalMutation({
  args: {
    mediaId: v.id("mediaFiles"),
    sourceStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (
      !media ||
      media.storageId !== args.sourceStorageId ||
      media.thumbnailStorageId ||
      args.thumbnailStorageId === args.sourceStorageId
    ) {
      return false;
    }
    const [thumbnail, existingOwnership] = await Promise.all([
      ctx.db.system.get(args.thumbnailStorageId),
      ctx.db
        .query("storageOwnership")
        .withIndex("by_storageId", (q) =>
          q.eq("storageId", args.thumbnailStorageId),
        )
        .unique(),
    ] as const);
    if (!thumbnail || existingOwnership) {
      return false;
    }
    await ctx.db.insert("storageOwnership", {
      storageId: args.thumbnailStorageId,
      organizationId: media.organizationId,
      uploadedBy: media.uploadedBy,
      uploadedAt: Date.now(),
      ownerType: "mediaThumbnail",
      ownerId: media._id,
    });
    await ctx.db.patch(media._id, {
      thumbnailStorageId: args.thumbnailStorageId,
    });
    await applyUsageCounterDelta(ctx, media.organizationId, {
      storageBytes: thumbnail.size,
    });
    return true;
  },
});

// ============================================
// 2.9.1 METADATA EXTRACTION
// ============================================

/**
 * Metadata validator for EXIF/IPTC data
 */
const metadataValidator = v.object({
  camera: v.optional(v.string()),
  lens: v.optional(v.string()),
  exposureTime: v.optional(v.string()),
  aperture: v.optional(v.string()),
  iso: v.optional(v.number()),
  focalLength: v.optional(v.string()),
  dateTimeOriginal: v.optional(v.number()),
  gpsLatitude: v.optional(v.number()),
  gpsLongitude: v.optional(v.number()),
  headline: v.optional(v.string()),
  description: v.optional(v.string()),
  creator: v.optional(v.string()),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  keywords: v.optional(v.array(v.string())),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  colorSpace: v.optional(v.string()),
  orientation: v.optional(v.number()),
});

/**
 * Store extracted metadata for a media file
 * Called by the metadata extraction action after processing
 */
export const storeMetadata = internalMutation({
  args: {
    mediaId: v.id("mediaFiles"),
    metadata: metadataValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return null;
    }

    await ctx.db.patch(args.mediaId, {
      metadata: args.metadata,
      metadataExtracted: true,
    });

    return null;
  },
});

/**
 * Get media with full metadata
 */
export const getWithMetadata = query({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.union(
    v.object({
      _id: v.id("mediaFiles"),
      collectionId: v.id("collections"),
      collectionTitle: v.string(),
      accessionNumber: v.optional(v.string()),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      mimeType: v.string(),
      isPrimary: v.boolean(),
      caption: v.optional(v.string()),
      photographer: v.optional(v.string()),
      copyright: v.optional(v.string()),
      url: v.union(v.string(), v.null()),
      thumbnailUrl: v.union(v.string(), v.null()),
      // The upload before any edit, when the shown image is an edited version.
      originalUrl: v.union(v.string(), v.null()),
      uploadedAt: v.number(),
      currentVersionId: v.optional(v.id("mediaVersions")),
      // The shown version already carries the organization's watermark.
      watermarked: v.boolean(),
      metadata: v.optional(metadataValidator),
      metadataExtracted: v.optional(v.boolean()),
      rightsStatus: v.optional(
        v.union(
          v.literal("owned"),
          v.literal("licensed"),
          v.literal("public_domain"),
          v.literal("orphan_work"),
          v.literal("restricted"),
          v.literal("unknown"),
        ),
      ),
      licenseType: v.optional(
        v.union(
          v.literal("creative_commons_by"),
          v.literal("creative_commons_by_sa"),
          v.literal("creative_commons_by_nc"),
          v.literal("creative_commons_by_nd"),
          v.literal("creative_commons_zero"),
          v.literal("editorial_only"),
          v.literal("commercial"),
          v.literal("internal_only"),
          v.literal("custom"),
        ),
      ),
      rightsHolder: v.optional(v.string()),
      licenseExpiry: v.optional(v.number()),
      usageRestrictions: v.optional(v.string()),
      requiresAcknowledgment: v.optional(v.boolean()),
      acknowledgmentText: v.optional(v.string()),
      /** The file's own statement, absent when none was recorded. */
      rightsStatement: v.optional(rightsStatementValidator),
      /** Its own, otherwise the Organization's media default. */
      rightsStatementInEffect: v.optional(rightsStatementValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return null;
    }

    await requirePermission(ctx, media.organizationId, "media.read");

    const [collection, shown, organization] = await Promise.all([
      ctx.db.get(media.collectionId),
      getDisplayedMediaFiles(ctx, media),
      ctx.db.get(media.organizationId),
    ]);
    const [url, thumbnailUrl, originalUrl] = await Promise.all([
      ctx.storage.getUrl(shown.storageId),
      shown.thumbnailStorageId
        ? ctx.storage.getUrl(shown.thumbnailStorageId)
        : null,
      shown.version ? ctx.storage.getUrl(media.storageId) : null,
    ]);

    return {
      _id: media._id,
      collectionId: media.collectionId,
      collectionTitle: collection?.title || "Unknown",
      accessionNumber: collection?.accessionNumber,
      fileName: media.fileName,
      fileType: media.fileType,
      fileSize: media.fileSize,
      mimeType: media.mimeType,
      isPrimary: media.isPrimary,
      caption: media.caption,
      photographer: media.photographer,
      copyright: media.copyright,
      url,
      thumbnailUrl,
      originalUrl,
      uploadedAt: media.uploadedAt,
      currentVersionId: media.currentVersionId,
      watermarked: isWatermarkedVersion(shown.version),
      metadata: media.metadata,
      metadataExtracted: media.metadataExtracted,
      rightsStatus: media.rightsStatus,
      licenseType: media.licenseType,
      rightsHolder: media.rightsHolder,
      licenseExpiry: media.licenseExpiry,
      usageRestrictions: media.usageRestrictions,
      requiresAcknowledgment: media.requiresAcknowledgment,
      acknowledgmentText: media.acknowledgmentText,
      rightsStatement: media.rightsStatement,
      rightsStatementInEffect: rightsStatementInEffect(
        media.rightsStatement,
        organization?.settings?.rightsDefaults?.mediaRightsStatement,
      ),
    };
  },
});

/**
 * Update metadata manually (for corrections or additional info)
 */
export const updateMetadata = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    metadata: metadataValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    await requirePermission(ctx, media.organizationId, "media.upload");

    // Merge with existing metadata
    const existingMetadata = media.metadata || {};
    const updatedMetadata = { ...existingMetadata, ...args.metadata };

    await Promise.all([
      ctx.db.patch(args.mediaId, {
        metadata: updatedMetadata,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: media.organizationId,
        userId,
        action: "updated_media_metadata",
        entityType: "media",
        entityId: args.mediaId,
        changes: {
          fileName: media.fileName,
          metadataFields: Object.keys(args.metadata),
        },
      }),
    ]);

    return null;
  },
});

// ============================================
// 2.9.2 DUPLICATE DETECTION
// ============================================

/**
 * Check for duplicate files by content hash before upload
 */
export const checkDuplicate = query({
  args: {
    organizationId: v.id("organizations"),
    contentHash: v.string(),
  },
  returns: v.union(
    v.object({
      isDuplicate: v.boolean(),
      existingMediaId: v.optional(v.id("mediaFiles")),
      existingFileName: v.optional(v.string()),
      existingCollectionId: v.optional(v.id("collections")),
      existingCollectionTitle: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [, existing] = await Promise.all([
      requirePermission(ctx, args.organizationId, "media.read"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_content_hash", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("contentHash", args.contentHash),
        )
        .first(),
    ] as const);

    if (!existing) {
      return {
        isDuplicate: false,
      };
    }

    const collection = await ctx.db.get(existing.collectionId);

    return {
      isDuplicate: true,
      existingMediaId: existing._id,
      existingFileName: existing.fileName,
      existingCollectionId: existing.collectionId,
      existingCollectionTitle: collection?.title,
    };
  },
});

/**
 * Set content hash for a media file (called after upload)
 * Also marks as duplicate if a match is found
 */
export const setContentHash = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    contentHash: v.string(),
    allowDuplicate: v.optional(v.boolean()),
  },
  returns: v.object({
    isDuplicate: v.boolean(),
    duplicateOfMediaId: v.optional(v.id("mediaFiles")),
  }),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    const [, existing] = await Promise.all([
      requirePermission(ctx, media.organizationId, "media.upload"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_content_hash", (q) =>
          q
            .eq("organizationId", media.organizationId)
            .eq("contentHash", args.contentHash),
        )
        .filter((q) => q.neq(q.field("_id"), args.mediaId))
        .first(),
    ] as const);

    const isDuplicate = !!existing;

    await ctx.db.patch(args.mediaId, {
      contentHash: args.contentHash,
      isDuplicate,
      duplicateOfMediaId: existing?._id,
    });

    return {
      isDuplicate,
      duplicateOfMediaId: existing?._id,
    };
  },
});

/**
 * List all duplicates for an organization
 */
export const listDuplicates = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaFiles"),
      fileName: v.string(),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
      duplicateOfMediaId: v.optional(v.id("mediaFiles")),
      duplicateOfFileName: v.optional(v.string()),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const [, duplicates] = await Promise.all([
      requirePermission(ctx, args.organizationId, "media.read"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("isDuplicate"), true))
        .collect(),
    ] as const);

    const enriched = await Promise.all(
      duplicates.map(async (media) => {
        const collection = await ctx.db.get(media.collectionId);
        const original = media.duplicateOfMediaId
          ? await ctx.db.get(media.duplicateOfMediaId)
          : null;

        return {
          _id: media._id,
          fileName: media.fileName,
          collectionId: media.collectionId,
          collectionTitle: collection?.title,
          duplicateOfMediaId: media.duplicateOfMediaId,
          duplicateOfFileName: original?.fileName,
          uploadedAt: media.uploadedAt,
        };
      }),
    );

    return enriched;
  },
});

// ============================================
// 2.9.3 RIGHTS MANAGEMENT
// ============================================

const rightsStatusValidator = v.union(
  v.literal("owned"),
  v.literal("licensed"),
  v.literal("public_domain"),
  v.literal("orphan_work"),
  v.literal("restricted"),
  v.literal("unknown"),
);

const licenseTypeValidator = v.union(
  v.literal("creative_commons_by"),
  v.literal("creative_commons_by_sa"),
  v.literal("creative_commons_by_nc"),
  v.literal("creative_commons_by_nd"),
  v.literal("creative_commons_zero"),
  v.literal("editorial_only"),
  v.literal("commercial"),
  v.literal("internal_only"),
  v.literal("custom"),
);

const downloadPurposeValidator = v.union(
  v.literal("internal_use"),
  v.literal("publication"),
  v.literal("exhibition"),
  v.literal("loan"),
  v.literal("research"),
  v.literal("marketing"),
  v.literal("other"),
);

/**
 * Update rights information for a media file
 */
export const updateRights = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    rightsStatus: v.optional(rightsStatusValidator),
    licenseType: v.optional(v.union(licenseTypeValidator, v.null())),
    licenseExpiry: v.optional(v.union(v.number(), v.null())),
    rightsHolder: v.optional(v.string()),
    usageRestrictions: v.optional(v.union(v.string(), v.null())),
    requiresAcknowledgment: v.optional(v.boolean()),
    acknowledgmentText: v.optional(v.string()),
    /**
     * Null clears it, so the Organization's media default applies. The
     * statement is descriptive: changing only it keeps the approval.
     */
    rightsStatement: v.optional(v.union(rightsStatementValidator, v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    await requirePermission(ctx, media.organizationId, "media.upload");

    const updates: Record<string, unknown> = {};
    if (args.rightsStatus !== undefined)
      updates.rightsStatus = args.rightsStatus;
    if (args.licenseType !== undefined)
      updates.licenseType = args.licenseType ?? undefined;
    if (args.licenseExpiry !== undefined)
      updates.licenseExpiry = args.licenseExpiry ?? undefined;
    if (args.rightsHolder !== undefined)
      updates.rightsHolder = args.rightsHolder;
    if (args.usageRestrictions !== undefined)
      updates.usageRestrictions = args.usageRestrictions ?? undefined;
    if (args.requiresAcknowledgment !== undefined)
      updates.requiresAcknowledgment = args.requiresAcknowledgment;
    if (args.acknowledgmentText !== undefined)
      updates.acknowledgmentText = args.acknowledgmentText;
    // Recorded rights gate the portal (ADR 0017), so changing them revokes
    // the approval; the statement does not (ADR 0022).
    if (Object.keys(updates).length > 0) {
      await revokePublicRendition(ctx, media);
      updates.publicApproval = undefined;
    }
    if (args.rightsStatement !== undefined)
      updates.rightsStatement = args.rightsStatement ?? undefined;

    await Promise.all([
      ctx.db.patch(args.mediaId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: media.organizationId,
        userId,
        action: "updated_media_rights",
        entityType: "media",
        entityId: args.mediaId,
        changes: updates,
      }),
    ]);
    await syncPublicRendition(ctx, args.mediaId);

    return null;
  },
});

/**
 * Track media download with rights acknowledgment
 */
export const trackDownload = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    purpose: downloadPurposeValidator,
    purposeDetails: v.optional(v.string()),
    acknowledgedRights: v.boolean(),
  },
  returns: v.object({
    downloadId: v.id("mediaDownloads"),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const [userId, media] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mediaId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!media) {
      throw new Error("Media not found");
    }

    if (media.requiresAcknowledgment && !args.acknowledgedRights) {
      throw new Error("Rights acknowledgment required for this media");
    }

    if (media.rightsStatus === "restricted") {
      throw new Error(
        "This media has restricted rights and cannot be downloaded",
      );
    }

    if (media.licenseExpiry && media.licenseExpiry < Date.now()) {
      throw new Error("License for this media has expired");
    }

    await requirePermission(ctx, media.organizationId, "media.read");

    // Track the download
    const [downloadId, url] = await Promise.all([
      ctx.db.insert("mediaDownloads", {
        mediaId: args.mediaId,
        organizationId: media.organizationId,
        userId,
        downloadedAt: Date.now(),
        purpose: args.purpose,
        purposeDetails: args.purposeDetails,
        acknowledgedRights: args.acknowledgedRights,
      }),
      ctx.storage.getUrl(media.storageId),
    ]);
    return {
      downloadId,
      url,
    };
  },
});

/**
 * Check if download is allowed (without tracking)
 */
export const checkDownloadAllowed = query({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.object({
    allowed: v.boolean(),
    requiresAcknowledgment: v.boolean(),
    acknowledgmentText: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return {
        allowed: false,
        requiresAcknowledgment: false,
        reason: "Media not found",
      };
    }

    if (media.rightsStatus === "restricted") {
      return {
        allowed: false,
        requiresAcknowledgment: false,
        reason: "Media has restricted rights",
      };
    }

    if (media.licenseExpiry && media.licenseExpiry < Date.now()) {
      return {
        allowed: false,
        requiresAcknowledgment: false,
        reason: "License has expired",
      };
    }

    await requirePermission(ctx, media.organizationId, "media.read");

    return {
      allowed: true,
      requiresAcknowledgment: media.requiresAcknowledgment ?? false,
      acknowledgmentText: media.acknowledgmentText,
    };
  },
});

/**
 * List download history for a media file
 */
export const listDownloads = query({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaDownloads"),
      userId: v.id("users"),
      userName: v.optional(v.string()),
      downloadedAt: v.number(),
      purpose: v.optional(downloadPurposeValidator),
      purposeDetails: v.optional(v.string()),
      acknowledgedRights: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return [];
    }

    const [, downloads] = await Promise.all([
      requirePermission(ctx, media.organizationId, "media.read"),
      ctx.db
        .query("mediaDownloads")
        .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
        .collect(),
    ] as const);

    const enriched = await Promise.all(
      downloads.map(async (download) => {
        const user = await ctx.db.get(download.userId);
        return {
          _id: download._id,
          userId: download.userId,
          userName: user?.name || user?.username,
          downloadedAt: download.downloadedAt,
          purpose: download.purpose,
          purposeDetails: download.purposeDetails,
          acknowledgedRights: download.acknowledgedRights,
        };
      }),
    );

    return enriched.sort((a, b) => b.downloadedAt - a.downloadedAt);
  },
});

/**
 * Get media files with specific rights status
 */
export const listByRightsStatus = query({
  args: {
    organizationId: v.id("organizations"),
    rightsStatus: rightsStatusValidator,
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaFiles"),
      fileName: v.string(),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
      rightsStatus: v.optional(rightsStatusValidator),
      licenseType: v.optional(licenseTypeValidator),
      licenseExpiry: v.optional(v.number()),
      rightsHolder: v.optional(v.string()),
      rightsStatement: v.optional(rightsStatementValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const [, media] = await Promise.all([
      requirePermission(ctx, args.organizationId, "media.read"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_rights_status", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("rightsStatus", args.rightsStatus),
        )
        .collect(),
    ] as const);

    const enriched = await Promise.all(
      media.map(async (m) => {
        const collection = await ctx.db.get(m.collectionId);
        return {
          _id: m._id,
          fileName: m.fileName,
          collectionId: m.collectionId,
          collectionTitle: collection?.title,
          rightsStatus: m.rightsStatus,
          licenseType: m.licenseType,
          licenseExpiry: m.licenseExpiry,
          rightsHolder: m.rightsHolder,
          rightsStatement: m.rightsStatement,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get media with expiring licenses
 */
export const getExpiringLicenses = query({
  args: {
    organizationId: v.id("organizations"),
    daysAhead: v.optional(v.number()), // Default 30 days
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaFiles"),
      fileName: v.string(),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
      licenseType: v.optional(licenseTypeValidator),
      licenseExpiry: v.number(),
      daysUntilExpiry: v.number(),
      rightsHolder: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.read");

    const daysAhead = args.daysAhead ?? 30;
    const expiryThreshold = Date.now() + daysAhead * 24 * 60 * 60 * 1000;

    const allMedia = await ctx.db
      .query("mediaFiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("licenseExpiry"), undefined),
          q.lt(q.field("licenseExpiry"), expiryThreshold),
        ),
      )
      .collect();

    const enriched = await Promise.all(
      allMedia.map(async (media) => {
        const collection = await ctx.db.get(media.collectionId);
        const daysUntilExpiry = Math.ceil(
          (media.licenseExpiry! - Date.now()) / (24 * 60 * 60 * 1000),
        );

        return {
          _id: media._id,
          fileName: media.fileName,
          collectionId: media.collectionId,
          collectionTitle: collection?.title,
          licenseType: media.licenseType,
          licenseExpiry: media.licenseExpiry!,
          daysUntilExpiry,
          rightsHolder: media.rightsHolder,
        };
      }),
    );

    // Sort by days until expiry (most urgent first)
    return enriched.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  },
});

/**
 * Bulk update rights for multiple media files
 */
export const bulkUpdateRights = mutation({
  args: {
    mediaIds: v.array(v.id("mediaFiles")),
    rightsStatus: v.optional(rightsStatusValidator),
    licenseType: v.optional(licenseTypeValidator),
    licenseExpiry: v.optional(v.number()),
    rightsHolder: v.optional(v.string()),
    requiresAcknowledgment: v.optional(v.boolean()),
    acknowledgmentText: v.optional(v.string()),
  },
  returns: v.object({
    updated: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let updated = 0;
    let failed = 0;

    const outcomes = await Promise.all(
      args.mediaIds.map(async (mediaId) => {
        try {
          const media = await ctx.db.get(mediaId);
          if (!media) {
            return "failed" as const;
          }

          await requirePermission(ctx, media.organizationId, "media.upload");

          const updates: Record<string, unknown> = {};
          if (args.rightsStatus !== undefined)
            updates.rightsStatus = args.rightsStatus;
          if (args.licenseType !== undefined)
            updates.licenseType = args.licenseType;
          if (args.licenseExpiry !== undefined)
            updates.licenseExpiry = args.licenseExpiry;
          if (args.rightsHolder !== undefined)
            updates.rightsHolder = args.rightsHolder;
          if (args.requiresAcknowledgment !== undefined)
            updates.requiresAcknowledgment = args.requiresAcknowledgment;
          if (args.acknowledgmentText !== undefined)
            updates.acknowledgmentText = args.acknowledgmentText;

          await ctx.db.patch(mediaId, updates);
          await syncPublicRendition(ctx, mediaId);
          return "updated" as const;
        } catch {
          return "failed" as const;
        }
      }),
    );

    for (const outcome of outcomes) {
      if (outcome === "updated") {
        updated++;
      } else if (outcome === "failed") {
        failed++;
      }
    }

    return { updated, failed };
  },
});

/**
 * Get rights summary for an organization
 */
export const getRightsSummary = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalMedia: v.number(),
    byRightsStatus: v.array(
      v.object({
        status: v.string(),
        count: v.number(),
      }),
    ),
    expiringLicenses: v.number(),
    requiresAcknowledgment: v.number(),
    unknownRights: v.number(),
  }),
  handler: async (ctx, args) => {
    const [, allMedia] = await Promise.all([
      requirePermission(ctx, args.organizationId, "media.read"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ] as const);

    const totalMedia = allMedia.length;

    // Count by rights status
    const statusMap = new Map<string, number>();
    let expiringLicenses = 0;
    let requiresAcknowledgment = 0;
    let unknownRights = 0;

    const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000;

    for (const media of allMedia) {
      const status = media.rightsStatus || "unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);

      if (media.licenseExpiry && media.licenseExpiry < thirtyDaysFromNow) {
        expiringLicenses++;
      }

      if (media.requiresAcknowledgment) {
        requiresAcknowledgment++;
      }

      if (!media.rightsStatus || media.rightsStatus === "unknown") {
        unknownRights++;
      }
    }

    const byRightsStatus = Array.from(statusMap.entries()).map(
      ([status, count]) => ({
        status,
        count,
      }),
    );

    return {
      totalMedia,
      byRightsStatus,
      expiringLicenses,
      requiresAcknowledgment,
      unknownRights,
    };
  },
});

const OBJECT_REFERENCE_ISSUES = {
  parentObject: "Parent object is missing or belongs to another organization",
  currentLocation: "Location is missing or belongs to another organization",
  collectionGroup:
    "Collection group is missing or belongs to another organization",
} as const;

const ACCESSION_REFERENCE_ISSUES = {
  object: "Object is missing or belongs to another organization",
  donorAccount: "Donor account is missing or belongs to another organization",
} as const;

export const reviewIntegrity = query({
  args: {
    organizationId: v.id("organizations"),
    kind: v.union(
      v.literal("relationships"),
      v.literal("collections"),
      v.literal("media"),
      v.literal("accessions"),
      v.literal("locations"),
      v.literal("exhibitions"),
      v.literal("loans"),
      v.literal("accounts"),
      v.literal("library"),
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    issues: v.array(
      v.object({
        recordId: v.string(),
        recordLabel: v.string(),
        referencedId: v.string(),
        issue: v.string(),
      }),
    ),
    checkedCount: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      args.kind === "media"
        ? "media.read"
        : args.kind === "locations"
          ? "locations.read"
          : args.kind === "loans"
            ? "loans.read"
            : args.kind === "accounts" || args.kind === "relationships"
              ? "accounts.read"
              : "collections.read",
    );
    if (args.kind === "accounts" || args.kind === "relationships")
      await requireModuleAndPermission(
        ctx,
        args.organizationId,
        "accounts",
        "accounts.read",
      );
    if (args.kind === "library")
      await requireModuleAndPermission(
        ctx,
        args.organizationId,
        "library",
        "collections.read",
      );
    if (args.kind === "exhibitions")
      await requireExhibitionAccess(ctx, args.organizationId);
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(
        args.kind === "loans" ? 1 : 25,
        Math.max(1, args.paginationOpts.numItems),
      ),
    };
    const issues: Array<{
      recordId: string;
      recordLabel: string;
      referencedId: string;
      issue: string;
    }> = [];
    const add = (
      recordId: string,
      recordLabel: string,
      referencedId: string,
      issue: string,
    ) => {
      issues.push({ recordId, recordLabel, referencedId, issue });
    };
    let remainingReferences = 200;
    const limitedRecords = new Set<string>();
    const canReviewReference = (recordId: string, label: string) => {
      if (remainingReferences > 0) {
        remainingReferences--;
        return true;
      }
      if (!limitedRecords.has(recordId)) {
        limitedRecords.add(recordId);
        add(
          recordId,
          label,
          recordId,
          "Reference review limit reached; this record requires a separate review",
        );
      }
      return false;
    };
    const checkBlob = async (
      recordId: string,
      label: string,
      storageId: Id<"_storage">,
      expectedOwner?: { type: string; id: string },
    ) => {
      if (!canReviewReference(recordId, label)) return;
      const [file, binding] = await Promise.all([
        ctx.db.system.get("_storage", storageId),
        ctx.db
          .query("storageOwnership")
          .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
          .unique(),
      ]);
      if (!file)
        add(
          recordId,
          label,
          storageId,
          "File is missing; retain the attachment record for review",
        );
      else if (!binding)
        add(
          recordId,
          label,
          storageId,
          "File ownership is unverified; retain the file for review",
        );
      else if (
        binding.organizationId !== args.organizationId ||
        (expectedOwner &&
          (binding.ownerType !== expectedOwner.type ||
            binding.ownerId !== expectedOwner.id))
      )
        add(
          recordId,
          label,
          storageId,
          "File ownership conflicts with this attachment",
        );
    };
    const checkLocation = async (
      recordId: string,
      label: string,
      id?: Id<"locations">,
    ) => {
      if (!id || !canReviewReference(recordId, label)) return;
      const location = await ctx.db.get(id);
      if (!location || location.organizationId !== args.organizationId)
        add(
          recordId,
          label,
          id,
          "Location is missing or belongs to another organization",
        );
      else if (
        !location.isActive ||
        (location.status && location.status !== "active")
      )
        add(recordId, label, id, "Location is unavailable for moves");
    };
    if (args.kind === "collections") {
      const result = await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page) {
        const problems = await objectReferenceProblems(ctx, record);
        for (const problem of problems)
          add(
            record._id,
            record.title,
            problem.referencedId,
            OBJECT_REFERENCE_ISSUES[problem.field],
          );
        // Locations that still exist may be unavailable for moves.
        if (!problems.some((problem) => problem.field === "currentLocation"))
          await checkLocation(
            record._id,
            record.title,
            record.currentLocationId,
          );
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    if (args.kind === "media") {
      const result = await ctx.db
        .query("mediaFiles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page) {
        const collection = await ctx.db.get(record.collectionId);
        if (!collection || collection.organizationId !== args.organizationId)
          add(
            record._id,
            record.fileName,
            record.collectionId,
            "Object is missing or belongs to another organization",
          );
        await checkBlob(record._id, record.fileName, record.storageId, {
          type: "media",
          id: record._id,
        });
        const versions = await ctx.db
          .query("mediaVersions")
          .withIndex("by_original_media", (q) =>
            q.eq("originalMediaId", record._id),
          )
          .take(101);
        if (versions.length > 100)
          add(
            record._id,
            record.fileName,
            record._id,
            "More than 100 versions require a separate review",
          );
        for (const version of versions.slice(0, 100))
          await checkBlob(
            record._id,
            `${record.fileName} version ${version.versionNumber}`,
            version.storageId,
            { type: "mediaVersion", id: version._id },
          );
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    if (args.kind === "accessions") {
      const result = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page) {
        await checkLocation(
          record._id,
          record.accessionNumber,
          record.draftObjectData?.currentLocationId,
        );
        const storageIds = new Set([
          ...(record.documents ?? []),
          ...(record.draftMedia ?? []).map((media) => media.storageId),
          ...(record.documentChecklist ?? []).flatMap((item) =>
            item.storageId ? [item.storageId] : [],
          ),
        ]);
        for (const storageId of storageIds)
          await checkBlob(record._id, record.accessionNumber, storageId);
        for (const problem of await accessionReferenceProblems(ctx, record))
          add(
            record._id,
            record.accessionNumber,
            problem.referencedId,
            ACCESSION_REFERENCE_ISSUES[problem.field],
          );
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    if (args.kind === "locations") {
      const result = await ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page) {
        await checkLocation(record._id, record.name, record.parentLocationId);
        const imageId = record.customFields?.locationImageId;
        if (imageId) {
          const storageId =
            typeof imageId === "string"
              ? ctx.db.system.normalizeId("_storage", imageId)
              : null;
          if (storageId)
            await checkBlob(record._id, record.name, storageId, {
              type: "locationImage",
              id: record._id,
            });
          else
            add(
              record._id,
              record.name,
              String(imageId),
              "Location image ID is invalid",
            );
        }
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    if (args.kind === "relationships") {
      const result = await ctx.db
        .query("accountRelationships")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page) {
        const account = await ctx.db.get(record.accountId);
        if (!account || account.organizationId !== args.organizationId)
          add(
            record._id,
            "Account relationship",
            record.accountId,
            "Account is missing or belongs to another organization",
          );
        if (
          (await getRelatedEntityOrganization(
            ctx,
            record.relatedEntityType,
            record.relatedEntityId,
          )) !== args.organizationId
        )
          add(
            record._id,
            "Account relationship",
            record.relatedEntityId,
            "Related record is missing or belongs to another organization",
          );
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    if (args.kind === "accounts") {
      const result = await ctx.db
        .query("accountDocuments")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page) {
        const account = await ctx.db.get(record.accountId);
        if (!account || account.organizationId !== args.organizationId)
          add(
            record._id,
            record.filename,
            record.accountId,
            "Account is missing or belongs to another organization",
          );
        await checkBlob(record._id, record.filename, record.storageId, {
          type: "accountDocument",
          id: record._id,
        });
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    if (args.kind === "library") {
      const result = await ctx.db
        .query("libraryItems")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const record of result.page)
        if (record.coverImageId)
          await checkBlob(record._id, record.title, record.coverImageId, {
            type: "libraryCover",
            id: record._id,
          });
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    if (args.kind === "loans") {
      const result = await ctx.db
        .query("loans")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      const database = ctx.db;
      for (const record of result.page) {
        const documents = await database
          .query("loanDocuments")
          .withIndex("by_loan", (q) => q.eq("loanId", record._id))
          .take(101);
        if (documents.length > 100)
          add(
            record._id,
            record.loanNumber,
            record._id,
            "More than 100 documents require a separate review",
          );
        for (const document of documents.slice(0, 100))
          await checkBlob(record._id, document.fileName, document.storageId, {
            type: "loanDocument",
            id: document._id,
          });
        const items = await database
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", record._id))
          .take(101);
        if (items.length > 100)
          add(
            record._id,
            record.loanNumber,
            record._id,
            "More than 100 loan items require a separate review",
          );
        for (const item of items.slice(0, 100)) {
          const collection = await ctx.db.get(item.collectionId);
          if (!collection || collection.organizationId !== args.organizationId)
            add(
              record._id,
              record.loanNumber,
              item.collectionId,
              "Loan object is missing or belongs to another organization",
            );
          const reports = await database
            .query("conditionReports")
            .withIndex("by_loanItem", (q) => q.eq("loanItemId", item._id))
            .take(101);
          if (reports.length > 100)
            add(
              record._id,
              record.loanNumber,
              item._id,
              "More than 100 condition reports require a separate review",
            );
          for (const report of reports.slice(0, 100))
            for (const storageId of report.photos ?? [])
              await checkBlob(record._id, record.loanNumber, storageId, {
                type: "conditionReport",
                id: report._id,
              });
        }
      }
      return {
        issues,
        checkedCount: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    const result = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate(paginationOpts);
    for (const record of result.page) {
      await checkLocation(record._id, record.title, record.locationId);
      const objects = await ctx.db
        .query("exhibitionObjects")
        .withIndex("by_exhibition", (q) => q.eq("exhibitionId", record._id))
        .take(101);
      if (objects.length > 100)
        add(
          record._id,
          record.title,
          record._id,
          "More than 100 exhibition objects require a separate review",
        );
      for (const object of objects.slice(0, 100)) {
        const collection = await ctx.db.get(object.collectionId);
        if (
          !collection ||
          collection.organizationId !== args.organizationId ||
          object.organizationId !== args.organizationId
        )
          add(
            record._id,
            record.title,
            object.collectionId,
            "Exhibition object is missing or belongs to another organization",
          );
        await checkLocation(
          record._id,
          record.title,
          object.originalLocationId,
        );
        await checkLocation(
          record._id,
          record.title,
          object.exhibitionLocationId,
        );
      }
      const documents = await ctx.db
        .query("exhibitionDocuments")
        .withIndex("by_exhibition", (q) => q.eq("exhibitionId", record._id))
        .take(101);
      if (documents.length > 100)
        add(
          record._id,
          record.title,
          record._id,
          "More than 100 exhibition documents require a separate review",
        );
      for (const document of documents.slice(0, 100))
        await checkBlob(record._id, document.fileName, document.storageId, {
          type: "exhibitionDocument",
          id: document._id,
        });
    }
    return {
      issues,
      checkedCount: result.page.length,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
