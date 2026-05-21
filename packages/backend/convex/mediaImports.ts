import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  MAX_SMALL_MEDIA_FILE_SIZE,
  getMediaFileType,
  insertCompletedMediaAsset,
  isSupportedMediaMimeType,
} from "./utils/mediaAssets";
import { requirePermission } from "./utils/permissions";

const mappingTypeValidator = v.union(
  v.literal("csv"),
  v.literal("filename"),
  v.literal("manual"),
);

/**
 * Extracts accession number from filename patterns:
 * "2024.001.001_front.jpg" → "2024.001.001"
 * "ACC-2024-001_view1.png" → "ACC-2024-001"
 */
function extractAccessionFromFilename(filename: string): string | null {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // YYYY.NNN.NNN (standard museum accession format)
  const yearDotPattern = nameWithoutExt.match(/^(\d{4}\.\d{1,4}\.\d{1,4})/);
  if (yearDotPattern?.[1]) return yearDotPattern[1];

  // PREFIX-YYYY-NNN
  const prefixPattern = nameWithoutExt.match(/^([A-Z]+-\d{4}-\d{1,4})/i);
  if (prefixPattern?.[1]) return prefixPattern[1];

  // YYYY-NNNN or YYYY_NNNN
  const yearDashPattern = nameWithoutExt.match(/^(\d{4}[-_]\d{1,4})/);
  if (yearDashPattern?.[1]) return yearDashPattern[1];

  // Everything before common suffixes like _front, _back, _detail
  const suffixPattern = nameWithoutExt.match(
    /^(.+?)(?:[-_](?:front|back|side|detail|view\d*))?$/i,
  );
  if (suffixPattern?.[1]) return suffixPattern[1];

  return null;
}

export const createMediaImportJob = mutation({
  args: {
    organizationId: v.id("organizations"),
    totalFiles: v.number(),
    mappingType: mappingTypeValidator,
    mappingData: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          accessionNumber: v.string(),
        }),
      ),
    ),
  },
  returns: v.id("importJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.mappingType === "csv" && !args.mappingData) {
      throw new Error("Mapping data is required for CSV mapping type");
    }

    await requirePermission(ctx, args.organizationId, "media.upload");

    const jobId = await ctx.db.insert("importJobs", {
      organizationId: args.organizationId,
      type: "media",
      status: "pending",
      progress: 0,
      totalItems: args.totalFiles,
      processedItems: 0,
      errors: [],
      createdBy: userId,
      createdAt: Date.now(),
    });

    if (args.mappingType !== "manual") {
      await ctx.db.insert("mediaImportJobData", {
        jobId,
        mappingType: args.mappingType,
        mappingData: args.mappingData || [],
        uploadedFiles: [],
      });
    }

    return jobId;
  },
});

export const getMediaImportJob = query({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.union(
    v.object({
      _id: v.id("importJobs"),
      organizationId: v.id("organizations"),
      type: v.literal("media"),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      progress: v.number(),
      totalItems: v.number(),
      processedItems: v.number(),
      errors: v.optional(v.array(v.string())),
      createdAt: v.number(),
      mappingType: v.optional(mappingTypeValidator),
      successfulMappings: v.number(),
      failedMappings: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const job = await ctx.db.get(args.jobId);
    if (!job || job.type !== "media") return null;

    const mediaData = await ctx.db
      .query("mediaImportJobData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    const successfulMappings =
      mediaData?.uploadedFiles.filter((f) => f.mapped).length || 0;
    const failedMappings =
      mediaData?.uploadedFiles.filter((f) => !f.mapped).length || 0;

    return {
      _id: job._id,
      organizationId: job.organizationId,
      type: "media" as const,
      status: job.status,
      progress: job.progress,
      totalItems: job.totalItems,
      processedItems: job.processedItems,
      errors: job.errors,
      createdAt: job.createdAt,
      mappingType: mediaData?.mappingType,
      successfulMappings,
      failedMappings,
    };
  },
});

export const generateBulkUploadUrl = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
    fileId: v.string(),
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

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return { uploadUrl, fileId };
  },
});

export const recordUploadedFile = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    mapped: v.boolean(),
    collectionId: v.optional(v.id("collections")),
    mediaFileId: v.optional(v.id("mediaFiles")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "media.upload");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    const mediaData = await ctx.db
      .query("mediaImportJobData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    let accessionNumber: string | null = null;
    let collectionId: Id<"collections"> | null = null;

    if (mediaData) {
      if (mediaData.mappingType === "csv") {
        const mapping = mediaData.mappingData.find(
          (m) => m.filename.toLowerCase() === args.fileName.toLowerCase(),
        );
        accessionNumber = mapping?.accessionNumber || null;
      } else if (mediaData.mappingType === "filename") {
        accessionNumber = extractAccessionFromFilename(args.fileName);
      }
    }

    if (accessionNumber) {
      const collection = await ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("accessionNumber", accessionNumber),
        )
        .first();
      collectionId = collection?._id || null;
    }

    let mediaFileId: Id<"mediaFiles"> | undefined;
    let error: string | undefined;

    if (collectionId) {
      const fileType = getMediaFileType(args.mimeType);
      const mediaAsset = await insertCompletedMediaAsset(ctx, {
        collectionId,
        organizationId: args.organizationId,
        storageId: args.storageId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        isPrimary: false,
        uploadedBy: userId,
        forceThumbnail:
          fileType === "image" && args.fileSize < MAX_SMALL_MEDIA_FILE_SIZE,
      });
      mediaFileId = mediaAsset.mediaId;
    } else {
      error = accessionNumber
        ? `No collection found for accession number: ${accessionNumber}`
        : "Could not determine accession number from filename";
    }

    if (mediaData) {
      await ctx.db.patch(mediaData._id, {
        uploadedFiles: [
          ...mediaData.uploadedFiles,
          {
            fileName: args.fileName,
            storageId: args.storageId,
            fileSize: args.fileSize,
            mimeType: args.mimeType,
            mapped: !!collectionId,
            collectionId: collectionId || undefined,
            mediaFileId,
            error,
          },
        ],
      });
    }

    const newProcessedItems = job.processedItems + 1;
    const newProgress = Math.round((newProcessedItems / job.totalItems) * 100);
    const newErrors = error
      ? [...(job.errors || []), `${args.fileName}: ${error}`]
      : job.errors;

    await ctx.db.patch(args.jobId, {
      processedItems: newProcessedItems,
      progress: newProgress,
      errors: newErrors?.slice(-100),
      status: newProcessedItems >= job.totalItems ? "completed" : "processing",
    });

    return {
      success: true,
      mapped: !!collectionId,
      collectionId: collectionId || undefined,
      mediaFileId,
      error,
    };
  },
});

export const getUnmappedFiles = query({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.array(
    v.object({
      fileName: v.string(),
      storageId: v.id("_storage"),
      fileSize: v.number(),
      mimeType: v.string(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const job = await ctx.db.get(args.jobId);
    if (!job) return [];

    await requirePermission(ctx, job.organizationId, "media.read");

    const mediaData = await ctx.db
      .query("mediaImportJobData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!mediaData) return [];

    return mediaData.uploadedFiles.flatMap((file) =>
      file.mapped
        ? []
        : [
            {
              fileName: file.fileName,
              storageId: file.storageId,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              error: file.error,
            },
          ],
    );
  },
});

export const mapFileToCollection = mutation({
  args: {
    jobId: v.id("importJobs"),
    storageId: v.id("_storage"),
    collectionId: v.id("collections"),
  },
  returns: v.object({
    success: v.boolean(),
    mediaFileId: v.optional(v.id("mediaFiles")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Import job not found");
    }

    await requirePermission(ctx, job.organizationId, "media.upload");

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.organizationId !== job.organizationId) {
      throw new Error("Collection not found");
    }

    const mediaData = await ctx.db
      .query("mediaImportJobData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!mediaData) {
      throw new Error("Media import data not found");
    }

    const fileIndex = mediaData.uploadedFiles.findIndex(
      (f) => f.storageId === args.storageId,
    );

    if (fileIndex === -1) {
      throw new Error("File not found in import job");
    }

    const file = mediaData.uploadedFiles[fileIndex];
    if (!file) {
      throw new Error("File data not found");
    }

    if (file.mapped) {
      return {
        success: false,
        error: "File is already mapped to a collection",
      };
    }

    const fileType = getMediaFileType(file.mimeType);
    const mediaAsset = await insertCompletedMediaAsset(ctx, {
      collectionId: args.collectionId,
      organizationId: job.organizationId,
      storageId: args.storageId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      isPrimary: false,
      uploadedBy: userId,
      forceThumbnail:
        fileType === "image" && file.fileSize < MAX_SMALL_MEDIA_FILE_SIZE,
    });
    const mediaFileId = mediaAsset.mediaId;

    const updatedFiles = [...mediaData.uploadedFiles];
    updatedFiles[fileIndex] = {
      ...file,
      mapped: true,
      collectionId: args.collectionId,
      mediaFileId,
      error: undefined,
    };

    await ctx.db.patch(mediaData._id, {
      uploadedFiles: updatedFiles,
    });

    return {
      success: true,
      mediaFileId,
    };
  },
});

export const deleteUnmappedFile = mutation({
  args: {
    jobId: v.id("importJobs"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Import job not found");
    }

    await requirePermission(ctx, job.organizationId, "media.delete");

    const mediaData = await ctx.db
      .query("mediaImportJobData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!mediaData) {
      throw new Error("Media import data not found");
    }

    const file = mediaData.uploadedFiles.find(
      (f) => f.storageId === args.storageId,
    );
    if (!file) {
      throw new Error("File not found");
    }

    if (file.mapped) {
      throw new Error("Cannot delete mapped file");
    }

    await ctx.storage.delete(args.storageId);

    const updatedFiles = mediaData.uploadedFiles.filter(
      (f) => f.storageId !== args.storageId,
    );

    await ctx.db.patch(mediaData._id, {
      uploadedFiles: updatedFiles,
    });

    return null;
  },
});

export const parseMappingCsv = mutation({
  args: {
    organizationId: v.id("organizations"),
    csvContent: v.string(),
  },
  returns: v.object({
    mappings: v.array(
      v.object({
        filename: v.string(),
        accessionNumber: v.string(),
      }),
    ),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "media.upload");

    const lines = args.csvContent.split("\n").filter((line) => line.trim());
    const mappings: { filename: string; accessionNumber: string }[] = [];
    const errors: string[] = [];

    const startIndex = lines[0]?.toLowerCase().includes("filename") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const parts = line
        .split(",")
        .map((p) => p.trim().replace(/^["']|["']$/g, ""));

      if (parts.length < 2) {
        errors.push(
          `Row ${i + 1}: Invalid format, expected filename,accessionNumber`,
        );
        continue;
      }

      const [filename, accessionNumber] = parts;
      if (!filename || !accessionNumber) {
        errors.push(`Row ${i + 1}: Missing filename or accession number`);
        continue;
      }

      mappings.push({ filename, accessionNumber });
    }

    return { mappings, errors };
  },
});

export const listMediaImportJobs = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("importJobs"),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      progress: v.number(),
      totalItems: v.number(),
      processedItems: v.number(),
      createdAt: v.number(),
      successfulMappings: v.number(),
      failedMappings: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    await requirePermission(ctx, args.organizationId, "media.read");

    const jobs = await ctx.db
      .query("importJobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("type"), "media"))
      .order("desc")
      .take(20);

    const results = await Promise.all(
      jobs.map(async (job) => {
        const mediaData = await ctx.db
          .query("mediaImportJobData")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .first();

        const successfulMappings =
          mediaData?.uploadedFiles.filter((f) => f.mapped).length || 0;
        const failedMappings =
          mediaData?.uploadedFiles.filter((f) => !f.mapped).length || 0;

        return {
          _id: job._id,
          status: job.status,
          progress: job.progress,
          totalItems: job.totalItems,
          processedItems: job.processedItems,
          createdAt: job.createdAt,
          successfulMappings,
          failedMappings,
        };
      }),
    );

    return results;
  },
});
