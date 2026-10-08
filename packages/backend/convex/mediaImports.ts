import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import {
  applyImportJobProgress,
  getStoredRowResult,
  importJobStatusValidator,
  importJobViewFields,
  storeRowOutcome,
  toImportJobView,
  validateImportJobTotal,
} from "./utils/importJobs";
import {
  getMediaFileType,
  insertCompletedMediaAsset,
  isSupportedMediaMimeType,
  MAX_SMALL_MEDIA_FILE_SIZE,
} from "./utils/mediaAssets";
import { mutation } from "./utils/mutationBuilders";
import { hasPermission, requirePermission } from "./utils/permissions";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
  transferStorageOwnership,
  validateOwnedUploadSize,
} from "./utils/uploadOwnership";

/** Every retained original lives in one job document, so jobs stay bounded. */
export const MAX_MEDIA_IMPORT_FILES = 2_000;

/** Storage owner of an uploaded original that is not yet attached to an object. */
const MEDIA_IMPORT_OWNER = "mediaImport";

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

type MediaImportJobData = Doc<"mediaImportJobData">;
type UploadedFile = MediaImportJobData["uploadedFiles"][number];

async function loadMediaImportJob(
  ctx: MutationCtx,
  jobId: Id<"importJobs">,
  organizationId?: Id<"organizations">,
) {
  const job = await ctx.db.get(jobId);
  if (
    !job ||
    job.type !== "media" ||
    (organizationId !== undefined && job.organizationId !== organizationId)
  ) {
    throw new Error("Import job not found");
  }
  return job;
}

/** A job that can still take new files; cancelled jobs refuse further work. */
function assertAcceptsFiles(job: Doc<"importJobs">) {
  if (job.status === "cancelled") {
    throw new Error(
      "This import was cancelled. Start a new import to continue.",
    );
  }
  if (job.status === "failed") {
    throw new Error("This import failed and cannot accept more files.");
  }
  // Jobs from before per-file outcomes counted every file as processed, so
  // their progress cannot be continued truthfully.
  if (job.attemptedItems === undefined && job.processedItems > 0) {
    throw new Error(
      "This import was started by an earlier version. Start a new import for the remaining files.",
    );
  }
}

async function getMediaData(ctx: MutationCtx, jobId: Id<"importJobs">) {
  return await ctx.db
    .query("mediaImportJobData")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .first();
}

/** Finds the one object for an accession number; ambiguity is not guessed. */
async function resolveObject(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  accessionNumber: string,
) {
  const matches = (
    await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("accessionNumber", accessionNumber),
      )
      .take(10)
  ).filter((collection) => collection.status !== "deleted");
  if (matches.length === 0) {
    return {
      collectionId: undefined,
      error: `No object found for accession number ${accessionNumber}`,
    };
  }
  if (matches.length > 1) {
    return {
      collectionId: undefined,
      error: `Accession number ${accessionNumber} matches more than one object`,
    };
  }
  return {
    collectionId: (matches[0] as Doc<"collections">)._id,
    error: undefined,
  };
}

async function resolveTarget(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  mediaData: MediaImportJobData,
  fileName: string,
) {
  if (mediaData.mappingType === "manual") {
    return {
      collectionId: undefined,
      error: "Choose the object for this file",
    };
  }
  const accessionNumber =
    mediaData.mappingType === "csv"
      ? mediaData.mappingData.find(
          (mapping) =>
            mapping.filename.toLowerCase() === fileName.toLowerCase(),
        )?.accessionNumber
      : extractAccessionFromFilename(fileName);
  if (!accessionNumber) {
    return {
      collectionId: undefined,
      error:
        mediaData.mappingType === "csv"
          ? "File is not listed in the mapping CSV"
          : "Could not determine accession number from filename",
    };
  }
  return await resolveObject(ctx, organizationId, accessionNumber);
}

/** Attaches a retained original to an object and hands its blob to the media. */
async function attachRetainedFile(
  ctx: MutationCtx,
  job: Doc<"importJobs">,
  file: Pick<UploadedFile, "storageId" | "fileName" | "fileSize" | "mimeType">,
  collectionId: Id<"collections">,
  userId: Id<"users">,
) {
  const fileType = getMediaFileType(file.mimeType);
  const { mediaId } = await insertCompletedMediaAsset(ctx, {
    collectionId,
    organizationId: job.organizationId,
    storageId: file.storageId,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    isPrimary: false,
    uploadedBy: userId,
    forceThumbnail:
      fileType === "image" && file.fileSize < MAX_SMALL_MEDIA_FILE_SIZE,
  });
  const ownership = await transferStorageOwnership(ctx, {
    storageId: file.storageId,
    organizationId: job.organizationId,
    fromOwnerType: MEDIA_IMPORT_OWNER,
    fromOwnerId: job._id,
    ownerType: "media",
    ownerId: mediaId,
  });
  // The attachment keeps the original uploader, not the person who mapped it.
  await ctx.db.patch(mediaId, ownership);
  return mediaId;
}

function itemError(itemNumber: number, fileName: string, error: string) {
  return `Row ${itemNumber}: ${fileName}: ${error}`;
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
    sourceName: v.optional(v.string()),
    sourceFingerprint: v.optional(v.string()),
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
    validateImportJobTotal(args.totalFiles);
    if (args.totalFiles > MAX_MEDIA_IMPORT_FILES) {
      throw new Error(
        `Import at most ${MAX_MEDIA_IMPORT_FILES} files at a time`,
      );
    }
    if (
      args.sourceFingerprint !== undefined &&
      !/^[0-9a-f]{64}$/.test(args.sourceFingerprint)
    ) {
      throw new Error("Source fingerprint must be a SHA-256 hex digest");
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("importJobs", {
      organizationId: args.organizationId,
      type: "media",
      status: "pending",
      progress: 0,
      totalItems: args.totalFiles,
      processedItems: 0,
      attemptedItems: 0,
      acceptedItems: 0,
      failedItems: 0,
      sourceName: args.sourceName?.trim().slice(0, 200) || undefined,
      sourceFingerprint: args.sourceFingerprint,
      errors: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("mediaImportJobData", {
      jobId,
      mappingType: args.mappingType,
      mappingData: args.mappingType === "csv" ? (args.mappingData ?? []) : [],
      uploadedFiles: [],
    });

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
      status: importJobStatusValidator,
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
    if (!(await hasPermission(ctx, job.organizationId, "media.read"))) {
      return null;
    }

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
      progress: Math.min(job.progress, 100),
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

/** The latest unfinished or partly failed media import of the same files. */
export const findResumableMediaImportJob = query({
  args: {
    organizationId: v.id("organizations"),
    sourceFingerprint: v.string(),
  },
  returns: v.union(v.object(importJobViewFields), v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "media.upload");
    const jobs = await ctx.db
      .query("importJobs")
      .withIndex("by_organization_and_sourceFingerprint", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("sourceFingerprint", args.sourceFingerprint),
      )
      .order("desc")
      .take(10);
    const job = jobs.find(
      (candidate) =>
        candidate.type === "media" &&
        (candidate.status === "pending" ||
          candidate.status === "processing" ||
          candidate.status === "completed_with_errors"),
    );
    return job ? toImportJobView(job) : null;
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

    const job = await loadMediaImportJob(ctx, args.jobId, args.organizationId);
    assertAcceptsFiles(job);

    validateOwnedUploadSize(args.fileSize);
    const uploadUrl = await createAuthorizedUploadUrl(
      ctx,
      userId,
      args.organizationId,
    );
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return { uploadUrl, fileId };
  },
});

/**
 * Records one uploaded file as item `itemNumber` of a media import. Each item
 * has one durable outcome: replays return it, an attached file is never
 * attached twice, and an unmatched original is retained for later mapping.
 * Files the caller does not own are refused and recorded as failed items.
 */
export const recordUploadedFile = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    /** 1-based position of the file in the import; omitted by older clients. */
    itemNumber: v.optional(v.number()),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    itemNumber: v.number(),
    mapped: v.boolean(),
    replayed: v.boolean(),
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
    const job = await loadMediaImportJob(ctx, args.jobId, args.organizationId);
    assertAcceptsFiles(job);

    let mediaData = await getMediaData(ctx, job._id);
    if (!mediaData) {
      // Manual jobs created before MUS-622 kept no file list.
      const id = await ctx.db.insert("mediaImportJobData", {
        jobId: job._id,
        mappingType: "manual",
        mappingData: [],
        uploadedFiles: [],
      });
      mediaData = (await ctx.db.get(id)) as MediaImportJobData;
    }

    const recorded = mediaData.uploadedFiles.find(
      (file) => file.storageId === args.storageId,
    );
    // Older clients send no item number: a repeated storage ID is a replay,
    // anything else is the next file.
    const itemNumber =
      args.itemNumber ??
      recorded?.itemNumber ??
      toImportJobView(job).attemptedItems + 1;
    if (
      !Number.isInteger(itemNumber) ||
      itemNumber < 1 ||
      itemNumber > job.totalItems
    ) {
      throw new Error(
        `File number must be between 1 and ${job.totalItems} for this import`,
      );
    }

    const previous = await getStoredRowResult(ctx, job._id, itemNumber);
    if (
      previous?.identifier !== undefined &&
      previous.identifier !== args.fileName
    ) {
      throw new Error(
        `File ${itemNumber} does not match this import (expected ${previous.identifier}). Select the same files to resume.`,
      );
    }
    const retained = mediaData.uploadedFiles.find(
      (file) => file.itemNumber === itemNumber,
    );

    if (previous?.status === "accepted") {
      return {
        success: true,
        itemNumber,
        mapped: true,
        replayed: true,
        collectionId: retained?.collectionId,
        mediaFileId: previous.recordId as Id<"mediaFiles"> | undefined,
      };
    }
    if (recorded && recorded.itemNumber !== itemNumber) {
      throw new Error(
        recorded.itemNumber === undefined
          ? "This file is already recorded on this import"
          : `This file is already recorded as file ${recorded.itemNumber} of this import`,
      );
    }
    if (retained && retained.storageId !== args.storageId) {
      throw new Error(
        `File ${itemNumber} is already uploaded. Retry it with its retained original or map it from the review list.`,
      );
    }

    let error: string | undefined;
    let collectionId: Id<"collections"> | undefined;
    let mediaFileId: Id<"mediaFiles"> | undefined;
    let file: UploadedFile | undefined = retained;

    if (!file) {
      try {
        // A refused file must stay unclaimed, so check its type first.
        if (!isSupportedMediaMimeType(args.mimeType)) {
          throw new Error(`Unsupported file type: ${args.mimeType}`);
        }
        // Validates organization, uploader and metadata before any write.
        await claimStorageOwnership(ctx, {
          storageId: args.storageId,
          organizationId: job.organizationId,
          uploadedBy: userId,
          ownerType: MEDIA_IMPORT_OWNER,
          ownerId: job._id,
          expectedFileSize: args.fileSize,
          expectedMimeType: args.mimeType,
        });
        file = {
          itemNumber,
          fileName: args.fileName,
          storageId: args.storageId,
          fileSize: args.fileSize,
          mimeType: args.mimeType,
          mapped: false,
        };
      } catch (claimError) {
        error = `File refused: ${
          claimError instanceof Error ? claimError.message : "Unknown error"
        }`;
      }
    }

    if (file) {
      const target = await resolveTarget(
        ctx,
        job.organizationId,
        mediaData,
        file.fileName,
      );
      if (target.collectionId) {
        collectionId = target.collectionId;
        mediaFileId = await attachRetainedFile(
          ctx,
          job,
          file,
          target.collectionId,
          userId,
        );
      } else {
        error = target.error;
      }
      const updated: UploadedFile = {
        ...file,
        mapped: mediaFileId !== undefined,
        collectionId,
        mediaFileId,
        error,
      };
      await ctx.db.patch(mediaData._id, {
        uploadedFiles: retained
          ? mediaData.uploadedFiles.map((entry) =>
              entry.itemNumber === itemNumber ? updated : entry,
            )
          : [...mediaData.uploadedFiles, updated],
      });
    }

    const errors = error ? [itemError(itemNumber, args.fileName, error)] : [];
    const delta = await storeRowOutcome(ctx, job, previous, {
      rowNumber: itemNumber,
      status: mediaFileId ? "accepted" : "failed",
      recordId: mediaFileId,
      identifier: args.fileName,
      errors,
    });
    await applyImportJobProgress(
      ctx,
      job._id,
      [delta],
      errors,
      previous ? [itemNumber] : [],
    );

    return {
      success: true,
      itemNumber,
      mapped: mediaFileId !== undefined,
      replayed: false,
      collectionId,
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
      itemNumber: v.optional(v.number()),
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
    if (!job || job.type !== "media") return [];

    const [, mediaData] = await Promise.all([
      requirePermission(ctx, job.organizationId, "media.read"),
      ctx.db
        .query("mediaImportJobData")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .first(),
    ] as const);

    if (!mediaData) return [];

    return mediaData.uploadedFiles.flatMap((file) =>
      file.mapped
        ? []
        : [
            {
              itemNumber: file.itemNumber,
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

/**
 * Attaches a retained original to an object chosen by staff. Repeating the
 * same mapping returns the existing attachment; a different object is refused.
 */
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
    const job = await loadMediaImportJob(ctx, args.jobId);
    await requirePermission(ctx, job.organizationId, "media.upload");

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.organizationId !== job.organizationId) {
      throw new Error("Collection not found");
    }

    const mediaData = await getMediaData(ctx, job._id);
    if (!mediaData) {
      throw new Error("Media import data not found");
    }

    const fileIndex = mediaData.uploadedFiles.findIndex(
      (f) => f.storageId === args.storageId,
    );
    const file = mediaData.uploadedFiles[fileIndex];
    if (!file) {
      throw new Error("File not found in import job");
    }

    if (file.mapped) {
      if (file.collectionId === args.collectionId && file.mediaFileId) {
        return { success: true, mediaFileId: file.mediaFileId };
      }
      throw new Error("This file is already attached to a different object");
    }
    if (collection.status === "deleted") {
      throw new Error("Restore the object before attaching files to it");
    }

    const mediaFileId = await attachRetainedFile(
      ctx,
      job,
      file,
      args.collectionId,
      userId,
    );

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

    if (file.itemNumber !== undefined) {
      const previous = await getStoredRowResult(ctx, job._id, file.itemNumber);
      const delta = await storeRowOutcome(ctx, job, previous, {
        rowNumber: file.itemNumber,
        status: "accepted",
        recordId: mediaFileId,
        identifier: file.fileName,
        errors: [],
      });
      await applyImportJobProgress(
        ctx,
        job._id,
        [delta],
        [],
        [file.itemNumber],
      );
    }

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
    const [userId, job] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.jobId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!job || job.type !== "media") {
      throw new Error("Import job not found");
    }

    const [, mediaData] = await Promise.all([
      requirePermission(ctx, job.organizationId, "media.delete"),
      ctx.db
        .query("mediaImportJobData")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .first(),
    ] as const);

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

    return rejectPermanentEvidenceDeletion();
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "media.upload"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
      status: importJobStatusValidator,
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

    const [, jobs] = await Promise.all([
      requirePermission(ctx, args.organizationId, "media.read"),
      ctx.db
        .query("importJobs")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("type"), "media"))
        .order("desc")
        .take(20),
    ] as const);

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
