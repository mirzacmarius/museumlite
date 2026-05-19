import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  applyUsageCounterDelta,
  getMediaStorageBytes,
  getMediaVersionStorageBytes,
  getStorageBytes,
} from "./organizationUsageCounters";

export const MAX_SMALL_MEDIA_FILE_SIZE = 50 * 1024 * 1024;

type MediaCategory = "image" | "document";

const SUPPORTED_MEDIA_TYPES = {
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

function includesMimeType(values: readonly string[], mimeType: string) {
  return values.some((value) => value === mimeType);
}

export function getMediaFileType(mimeType: string) {
  if (includesMimeType(SUPPORTED_MEDIA_TYPES.images, mimeType)) return "image";
  if (includesMimeType(SUPPORTED_MEDIA_TYPES.documents, mimeType)) {
    return "document";
  }
  if (includesMimeType(SUPPORTED_MEDIA_TYPES.videos, mimeType)) return "video";
  if (includesMimeType(SUPPORTED_MEDIA_TYPES["3d"], mimeType)) return "3d";
  return "other";
}

export function isSupportedMediaMimeType(mimeType: string) {
  return getMediaFileType(mimeType) !== "other";
}

export function getDefaultMediaCategory(
  fileType: string,
  explicitCategory?: MediaCategory,
): MediaCategory {
  return explicitCategory ?? (fileType === "image" ? "image" : "document");
}

export function shouldGenerateMediaThumbnail({
  fileSize,
  fileType,
  isPrimary,
}: {
  fileSize: number;
  fileType: string;
  isPrimary: boolean;
}) {
  return (
    isPrimary && fileType === "image" && fileSize < MAX_SMALL_MEDIA_FILE_SIZE
  );
}

export async function insertCompletedMediaAsset(
  ctx: MutationCtx,
  {
    caption,
    collectionId,
    copyright,
    fileName,
    fileSize,
    forceThumbnail,
    isPrimary = false,
    mediaCategory,
    mimeType,
    organizationId,
    photographer,
    storageId,
    uploadedAt = Date.now(),
    uploadedBy,
  }: {
    collectionId: Id<"collections">;
    organizationId: Id<"organizations">;
    storageId: Id<"_storage">;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: Id<"users">;
    mediaCategory?: MediaCategory;
    isPrimary?: boolean;
    caption?: string;
    photographer?: string;
    copyright?: string;
    forceThumbnail?: boolean;
    uploadedAt?: number;
  },
) {
  const fileType = getMediaFileType(mimeType);
  const resolvedMediaCategory = getDefaultMediaCategory(
    fileType,
    mediaCategory,
  );

  const [mediaId, storageBytes] = await Promise.all([
    ctx.db.insert("mediaFiles", {
      collectionId,
      organizationId,
      storageId,
      fileName,
      fileType,
      fileSize,
      mimeType,
      mediaCategory: resolvedMediaCategory,
      isPrimary,
      caption,
      photographer,
      copyright,
      uploadedBy,
      uploadedAt,
      uploadStatus: "completed",
    }),
    getStorageBytes(ctx, storageId),
  ] as const);
  await applyUsageCounterDelta(ctx, organizationId, {
    mediaFileCount: 1,
    mediaTypeDeltas: [
      {
        type: fileType,
        countDelta: 1,
        bytesDelta: storageBytes,
      },
    ],
    storageBytes,
  });

  if (
    forceThumbnail ||
    shouldGenerateMediaThumbnail({ fileType, fileSize, isPrimary })
  ) {
    await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
      mediaId,
    });
  }

  await ctx.runMutation(internal.audit.logAction, {
    organizationId,
    userId: uploadedBy,
    action: "uploaded_media",
    entityType: "media",
    entityId: mediaId,
    changes: {
      fileName,
      fileType,
      fileSize,
      collectionId,
    },
  });

  return {
    fileType,
    mediaCategory: resolvedMediaCategory,
    mediaId,
  };
}

export async function completeChunkedMediaAsset(
  ctx: MutationCtx,
  {
    chunkId,
    fileSize,
    mimeType,
    organizationId,
    storageId,
  }: {
    organizationId: Id<"organizations">;
    chunkId: string;
    storageId: Id<"_storage">;
    fileSize: number;
    mimeType: string;
  },
) {
  const fileType = getMediaFileType(mimeType);
  const existing = await ctx.db
    .query("mediaFiles")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("chunkedUploadId"), chunkId))
    .first();

  if (!existing) {
    return null;
  }

  await ctx.db.patch(existing._id, {
    storageId,
    uploadStatus: "completed",
    mediaCategory: getDefaultMediaCategory(fileType, existing.mediaCategory),
  });

  if (
    shouldGenerateMediaThumbnail({
      fileType,
      fileSize,
      isPrimary: existing.isPrimary,
    })
  ) {
    await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
      mediaId: existing._id,
    });
  }

  return existing._id;
}

export async function deleteMediaAsset(
  ctx: MutationCtx,
  {
    deletedBy,
    media,
  }: {
    media: {
      _id: Id<"mediaFiles">;
      collectionId: Id<"collections">;
      fileName: string;
      fileType: string;
      organizationId: Id<"organizations">;
      storageId: Id<"_storage">;
      thumbnailStorageId?: Id<"_storage">;
    };
    deletedBy: Id<"users">;
  },
) {
  const storageBytes = await getMediaStorageBytes(ctx, media);

  await ctx.storage.delete(media.storageId);
  if (media.thumbnailStorageId) {
    await ctx.storage.delete(media.thumbnailStorageId);
  }
  await Promise.all([
    ctx.db.delete(media._id),
    applyUsageCounterDelta(ctx, media.organizationId, {
      mediaFileCount: -1,
      mediaTypeDeltas: [
        {
          type: media.fileType,
          countDelta: -1,
          bytesDelta: -storageBytes,
        },
      ],
      storageBytes: -storageBytes,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: media.organizationId,
      userId: deletedBy,
      action: "deleted_media",
      entityType: "media",
      entityId: media._id,
      changes: {
        fileName: media.fileName,
        fileType: media.fileType,
        collectionId: media.collectionId,
      },
    }),
  ] as const);
}

export async function recordMediaVersionUsage(
  ctx: MutationCtx,
  {
    organizationId,
    storageId,
  }: {
    organizationId: Id<"organizations">;
    storageId: Id<"_storage">;
  },
) {
  const versionStorageBytes = await getMediaVersionStorageBytes(ctx, {
    storageId,
  });

  await applyUsageCounterDelta(ctx, organizationId, {
    mediaVersionCount: 1,
    storageBytes: versionStorageBytes,
  });
}
