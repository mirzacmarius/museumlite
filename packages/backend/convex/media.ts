import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { enforceMediaQuota } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const MAX_SMALL_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Valid file types by category
 */
const FILE_TYPES = {
  images: ["image/jpeg", "image/png", "image/webp", "image/tiff"],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  videos: ["video/mp4", "video/webm"],
  "3d": [
    "model/obj",
    "model/gltf+json",
    "application/x-fbx",
    "model/gltf-binary",
  ],
} as const;

/**
 * Validate file type
 */
function validateFileType(mimeType: string): boolean {
  return Object.values(FILE_TYPES)
    .flat()
    .includes(mimeType as any);
}

/**
 * Get file category from mime type
 */
function getFileCategory(mimeType: string): string {
  if (FILE_TYPES.images.includes(mimeType as any)) return "image";
  if (FILE_TYPES.documents.includes(mimeType as any)) return "document";
  if (FILE_TYPES.videos.includes(mimeType as any)) return "video";
  if (FILE_TYPES["3d"].includes(mimeType as any)) return "3d";
  return "other";
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

    // Check permission
    await requirePermission(ctx, args.organizationId, "media.upload");

    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    // Validate file type
    if (!validateFileType(args.mimeType)) {
      throw new Error(`Unsupported file type: ${args.mimeType}`);
    }

    const isLargeFile = args.fileSize > MAX_SMALL_FILE_SIZE;
    const fileCategory = getFileCategory(args.mimeType);

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
    } else {
      // Small files - direct upload
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return {
        uploadUrl,
        isChunked: false,
      };
    }
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

    const fileCategory = getFileCategory(args.mimeType);
    // Use explicit mediaCategory if provided, otherwise default to "image" for images, "document" for others
    const mediaCategory =
      args.mediaCategory || (fileCategory === "image" ? "image" : "document");

    // If this is a chunked upload, update existing record
    if (args.chunkId) {
      const existing = await ctx.db
        .query("mediaFiles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("chunkedUploadId"), args.chunkId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          storageId: args.storageId,
          uploadStatus: "completed",
          mediaCategory,
        });

        // If it's a primary image and <50MB, schedule thumbnail generation
        if (
          existing.isPrimary &&
          args.fileSize < MAX_SMALL_FILE_SIZE &&
          fileCategory === "image"
        ) {
          await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
            mediaId: existing._id,
          });
        }

        return existing._id;
      }
    }

    // Create new media record
    const mediaId = await ctx.db.insert("mediaFiles", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: fileCategory,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      mediaCategory,
      isPrimary: args.isPrimary ?? false,
      caption: args.caption,
      photographer: args.photographer,
      copyright: args.copyright,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });

    // If it's a primary image and <50MB, schedule thumbnail generation
    if (
      args.isPrimary &&
      args.fileSize < MAX_SMALL_FILE_SIZE &&
      fileCategory === "image"
    ) {
      await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
        mediaId,
      });
    }

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

    await requirePermission(ctx, collection.organizationId, "media.read");

    const mediaFiles = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const media = await ctx.db.get(args.mediaId);
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
        media.fileSize < MAX_SMALL_FILE_SIZE
      ) {
        await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
          mediaId: args.mediaId,
        });
      }
    }

    await ctx.db.patch(args.mediaId, updates);

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.delete");

    // Delete from storage
    await ctx.storage.delete(media.storageId);
    if (media.thumbnailStorageId) {
      await ctx.storage.delete(media.thumbnailStorageId);
    }

    // Delete record
    await ctx.db.delete(args.mediaId);

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.upload");

    // Unset other primary images for this collection
    const otherMedia = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", media.collectionId),
      )
      .filter((q) => q.eq(q.field("isPrimary"), true))
      .collect();

    for (const m of otherMedia) {
      if (m._id !== args.mediaId) {
        await ctx.db.patch(m._id, { isPrimary: false });
      }
    }

    // Set this as primary
    await ctx.db.patch(args.mediaId, { isPrimary: true });

    // Generate thumbnail if image <50MB
    if (media.fileType === "image" && media.fileSize < MAX_SMALL_FILE_SIZE) {
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

    if (media.thumbnailStorageId) {
      return await ctx.storage.getUrl(media.thumbnailStorageId);
    }

    // Fallback to original if no thumbnail
    return await ctx.storage.getUrl(media.storageId);
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

    // Find primary image for this collection
    const primaryMedia = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .filter((q) => q.eq(q.field("isPrimary"), true))
      .first();

    if (!primaryMedia) {
      return null;
    }

    // Return thumbnail URL if available, otherwise fallback to original
    if (primaryMedia.thumbnailStorageId) {
      return await ctx.storage.getUrl(primaryMedia.thumbnailStorageId);
    }

    // Only return original URL if it's an image type
    if (primaryMedia.fileType === "image") {
      return await ctx.storage.getUrl(primaryMedia.storageId);
    }

    return null;
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
    fileType: v.optional(v.string()),
    uploaderId: v.optional(v.id("users")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    search: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
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
      }),
    ),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.read");

    let results = await ctx.db
      .query("mediaFiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    if (args.fileType) {
      results = results.filter((m) => m.fileType === args.fileType);
    }
    if (args.uploaderId) {
      results = results.filter((m) => m.uploadedBy === args.uploaderId);
    }
    if (args.dateFrom) {
      results = results.filter((m) => m.uploadedAt >= args.dateFrom!);
    }
    if (args.dateTo) {
      results = results.filter((m) => m.uploadedAt <= args.dateTo!);
    }
    if (args.collectionId) {
      results = results.filter((m) => m.collectionId === args.collectionId);
    }
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      results = results.filter(
        (m) =>
          m.fileName.toLowerCase().includes(searchLower) ||
          m.caption?.toLowerCase().includes(searchLower) ||
          m.photographer?.toLowerCase().includes(searchLower),
      );
    }

    results.sort((a, b) => b.uploadedAt - a.uploadedAt);

    const startIndex = args.paginationOpts.cursor
      ? results.findIndex((m) => m._id === args.paginationOpts.cursor) + 1
      : 0;
    const pageResults = results.slice(
      startIndex,
      startIndex + args.paginationOpts.numItems,
    );
    const hasMore = startIndex + args.paginationOpts.numItems < results.length;

    const enriched = await Promise.all(
      pageResults.map(async (media) => {
        const collection = await ctx.db.get(media.collectionId);
        const uploader = await ctx.db.get(media.uploadedBy);
        const url = await ctx.storage.getUrl(media.storageId);
        const thumbnailUrl = media.thumbnailStorageId
          ? await ctx.storage.getUrl(media.thumbnailStorageId)
          : null;

        return {
          _id: media._id,
          _creationTime: media._creationTime,
          collectionId: media.collectionId,
          collectionTitle: collection?.title || "Unknown",
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
          uploaderName: uploader?.name || uploader?.username,
        };
      }),
    );

    return {
      page: enriched,
      continueCursor: hasMore
        ? pageResults[pageResults.length - 1]?._id ?? null
        : null,
      isDone: !hasMore,
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

    const allMedia = await ctx.db
      .query("mediaFiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const totalFiles = allMedia.length;
    const totalSize = allMedia.reduce((sum, m) => sum + m.fileSize, 0);

    const typeMap = new Map<string, { count: number; size: number }>();
    for (const m of allMedia) {
      const existing = typeMap.get(m.fileType) || { count: 0, size: 0 };
      typeMap.set(m.fileType, {
        count: existing.count + 1,
        size: existing.size + m.fileSize,
      });
    }

    const byType = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      count: stats.count,
      size: stats.size,
    }));

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentUploads = allMedia.filter(
      (m) => m.uploadedAt >= sevenDaysAgo,
    ).length;

    return { totalFiles, totalSize, byType, recentUploads };
  },
});

export const checkFileType = query({
  args: {
    mimeType: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return validateFileType(args.mimeType);
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

    for (let i = 0; i < args.mediaIds.length; i++) {
      const mediaId = args.mediaIds[i];
      if (mediaId) {
        await ctx.db.patch(mediaId, { displayOrder: i });
      }
    }

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
    if (media.fileType !== "image" || media.fileSize >= MAX_SMALL_FILE_SIZE) {
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
