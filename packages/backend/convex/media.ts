import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { batchGetByIds, createLookupMap } from "./utils/batchLookup";
import { enforceMediaQuota } from "./utils/featureGates";
import {
  completeChunkedMediaAsset,
  deleteMediaAsset,
  getDefaultMediaCategory,
  getMediaFileType,
  insertCompletedMediaAsset,
  isSupportedMediaMimeType,
  MAX_SMALL_MEDIA_FILE_SIZE,
  shouldGenerateMediaThumbnail,
} from "./utils/mediaAssets";
import {
  createEmptyUsageCounter,
  getUsageCounter,
} from "./utils/organizationUsageCounters";
import { requirePermission } from "./utils/permissions";

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

    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    const isLargeFile = args.fileSize > MAX_SMALL_MEDIA_FILE_SIZE;

    if (isLargeFile) {
      // For large files, generate upload URL
      // Note: Client should handle chunked uploads externally if needed
      // For now, Convex storage handles large files directly
      const uploadUrl = await ctx.storage.generateUploadUrl();
      const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      return {
        uploadUrl,
        isChunked: true,
        chunkId,
      };
    }

    // Small files - direct upload
    const uploadUrl = await ctx.storage.generateUploadUrl();
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

    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    const fileCategory = getMediaFileType(args.mimeType);
    const mediaCategory = getDefaultMediaCategory(
      fileCategory,
      args.mediaCategory,
    );

    if (args.chunkId) {
      const mediaId = await completeChunkedMediaAsset(ctx, {
        organizationId: args.organizationId,
        chunkId: args.chunkId,
        storageId: args.storageId,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
      });

      if (mediaId) {
        return mediaId;
      }
    }

    const { mediaId } = await insertCompletedMediaAsset(ctx, {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      mediaCategory,
      isPrimary: args.isPrimary ?? false,
      caption: args.caption,
      photographer: args.photographer,
      copyright: args.copyright,
      uploadedBy: userId,
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
        const url = await ctx.storage.getUrl(media.storageId);
        const thumbnailUrl = media.thumbnailStorageId
          ? await ctx.storage.getUrl(media.thumbnailStorageId)
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
          url,
          thumbnailUrl,
          uploadStatus: media.uploadStatus,
        };
      }),
    );

    mediaWithUrls.sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
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
    if (args.isPrimary !== undefined) {
      updates.isPrimary = args.isPrimary;

      // If setting as primary and it's an image <50MB, generate thumbnail
      if (
        args.isPrimary &&
        media.fileType === "image" &&
        media.fileSize < MAX_SMALL_MEDIA_FILE_SIZE
      ) {
        await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
          mediaId: args.mediaId,
        });
      }
    }

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

    await deleteMediaAsset(ctx, {
      media,
      deletedBy: userId,
    });

    return null;
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

    const [, otherMedia] = await Promise.all([
      requirePermission(ctx, media.organizationId, "media.upload"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", media.collectionId),
        )
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .collect(),
    ] as const);

    await Promise.all([
      ...otherMedia.map((m) =>
        m._id !== args.mediaId
          ? ctx.db.patch(m._id, { isPrimary: false })
          : Promise.resolve(),
      ),
      ctx.db.patch(args.mediaId, { isPrimary: true }),
    ]);

    // Generate thumbnail if image <50MB
    if (
      shouldGenerateMediaThumbnail({
        fileType: media.fileType,
        fileSize: media.fileSize,
        isPrimary: true,
      })
    ) {
      await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
        mediaId: args.mediaId,
      });
    }

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

    return media.thumbnailStorageId
      ? await ctx.storage.getUrl(media.thumbnailStorageId)
      : await ctx.storage.getUrl(media.storageId);
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

    // Return thumbnail URL if available, otherwise fallback to original
    if (primaryMedia.thumbnailStorageId) {
      return await ctx.storage.getUrl(primaryMedia.thumbnailStorageId);
    }

    // Only return original URL if it's an image type
    if (isImageMedia(primaryMedia)) {
      return await ctx.storage.getUrl(primaryMedia.storageId);
    }

    return null;
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

    // Batch fetch collections for permission check
    const collections = await batchGetByIds(
      ctx,
      args.collectionIds,
      "collections",
    );
    const collectionMap = createLookupMap(collections);

    // Check permissions (assume all collections are from the same org)
    const firstValidCollection = collections.find((c) => c !== null);
    if (firstValidCollection) {
      await requirePermission(
        ctx,
        firstValidCollection.organizationId,
        "media.read",
      );
    }

    // Batch query for primary media for each collection
    const primaryMediaResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        const collection = collectionMap.get(collectionId);
        if (!collection) {
          return { collectionId, media: null };
        }

        const primaryMedia = await getPreferredImageMedia(ctx, collectionId);

        return { collectionId, media: primaryMedia };
      }),
    );

    // Collect all storage IDs that need URLs
    const storageIdsToFetch: Array<{
      collectionId: Id<"collections">;
      storageId: Id<"_storage">;
    }> = [];

    for (const result of primaryMediaResults) {
      if (result.media) {
        if (result.media.thumbnailStorageId) {
          storageIdsToFetch.push({
            collectionId: result.collectionId,
            storageId: result.media.thumbnailStorageId,
          });
        } else if (isImageMedia(result.media)) {
          storageIdsToFetch.push({
            collectionId: result.collectionId,
            storageId: result.media.storageId,
          });
        }
      }
    }

    // Batch fetch all URLs
    const urlResults = await Promise.all(
      storageIdsToFetch.map(async (item) => ({
        collectionId: item.collectionId,
        url: await ctx.storage.getUrl(item.storageId),
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
    const media = await ctx.db
      .query("mediaFiles")
      .filter((q) => q.eq(q.field("chunkedUploadId"), args.chunkId))
      .first();

    if (!media) {
      return null;
    }

    // Calculate progress based on upload status
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
        url: v.union(v.string(), v.null()),
        thumbnailUrl: v.union(v.string(), v.null()),
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

    const enriched = await Promise.all(
      paginationResult.page.map(async (media) => {
        const collection = collectionMap.get(media.collectionId);
        const uploader = uploaderMap.get(media.uploadedBy);
        const url = await ctx.storage.getUrl(media.storageId);
        const thumbnailUrl = media.thumbnailStorageId
          ? await ctx.storage.getUrl(media.thumbnailStorageId)
          : null;

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
          url,
          thumbnailUrl,
          uploadedAt: media.uploadedAt,
          uploaderName: uploader?.name ?? uploader?.username,
          currentVersionId: media.currentVersionId,
          versionCount: media.versionCount,
        };
      }),
    );

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
  returns: v.object({
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
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.read");

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const [usageCounter, recentUploads] = await Promise.all([
      getUsageCounter(ctx, args.organizationId),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_organization_and_uploadedAt", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .gte("uploadedAt", sevenDaysAgo),
        )
        .collect(),
    ]);

    const counter =
      usageCounter ?? createEmptyUsageCounter(args.organizationId);
    const byType = Object.entries(counter.mediaByType).map(([type, usage]) => ({
      type,
      count: usage.count,
      size: usage.bytes,
    }));

    return {
      totalFiles: counter.mediaFileCount,
      totalSize: counter.storageBytes,
      byType,
      recentUploads: recentUploads.length,
    };
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
 * Internal: Generate thumbnail for primary images
 * Schedules the thumbnail processing action and updates the media record
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

    // Skip if thumbnail already exists
    if (media.thumbnailStorageId) {
      return null;
    }

    // Mark as processing
    await ctx.db.patch(args.mediaId, {
      uploadStatus: "processing",
    });

    try {
      // Schedule the action to process the thumbnail
      // The action will update the media record via an internal mutation when it completes
      await ctx.scheduler.runAfter(
        0,
        internal.mediaThumbnails.processThumbnail,
        {
          mediaId: args.mediaId,
          storageId: media.storageId,
        },
      );
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      await ctx.db.patch(args.mediaId, {
        uploadStatus: "failed",
      });
    }

    return null;
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
      uploadedAt: v.number(),
      currentVersionId: v.optional(v.id("mediaVersions")),
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
      requiresAcknowledgment: v.optional(v.boolean()),
      acknowledgmentText: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      return null;
    }

    await requirePermission(ctx, media.organizationId, "media.read");

    const [collection, url] = await Promise.all([
      ctx.db.get(media.collectionId),
      ctx.storage.getUrl(media.storageId),
    ]);
    const thumbnailUrl = media.thumbnailStorageId
      ? await ctx.storage.getUrl(media.thumbnailStorageId)
      : null;

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
      uploadedAt: media.uploadedAt,
      currentVersionId: media.currentVersionId,
      metadata: media.metadata,
      metadataExtracted: media.metadataExtracted,
      rightsStatus: media.rightsStatus,
      licenseType: media.licenseType,
      rightsHolder: media.rightsHolder,
      requiresAcknowledgment: media.requiresAcknowledgment,
      acknowledgmentText: media.acknowledgmentText,
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
    licenseType: v.optional(licenseTypeValidator),
    licenseExpiry: v.optional(v.number()),
    rightsHolder: v.optional(v.string()),
    usageRestrictions: v.optional(v.string()),
    requiresAcknowledgment: v.optional(v.boolean()),
    acknowledgmentText: v.optional(v.string()),
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
    if (args.licenseType !== undefined) updates.licenseType = args.licenseType;
    if (args.licenseExpiry !== undefined)
      updates.licenseExpiry = args.licenseExpiry;
    if (args.rightsHolder !== undefined)
      updates.rightsHolder = args.rightsHolder;
    if (args.usageRestrictions !== undefined)
      updates.usageRestrictions = args.usageRestrictions;
    if (args.requiresAcknowledgment !== undefined)
      updates.requiresAcknowledgment = args.requiresAcknowledgment;
    if (args.acknowledgmentText !== undefined)
      updates.acknowledgmentText = args.acknowledgmentText;

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
