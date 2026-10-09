import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getMediaFileType, shouldGenerateMediaThumbnail } from "./mediaAssets";
import { hasPermission } from "./permissions";

// An object normally has one primary file; this only bounds legacy repairs.
const PRIMARY_MEDIA_READ_LIMIT = 100;

type PrimaryCandidate = Pick<Doc<"mediaFiles">, "fileType" | "mediaCategory">;

/** Only photos of the object can be its primary image; documents never are. */
export function canBePrimaryImage(media: PrimaryCandidate) {
  return media.fileType === "image" && media.mediaCategory !== "document";
}

async function listPrimaryMedia(
  ctx: QueryCtx,
  collectionId: Id<"collections">,
) {
  return await ctx.db
    .query("mediaFiles")
    .withIndex("by_collection_and_isPrimary_and_fileType", (q) =>
      q.eq("collectionId", collectionId).eq("isPrimary", true),
    )
    .take(PRIMARY_MEDIA_READ_LIMIT);
}

async function clearPrimaryFlags(ctx: MutationCtx, media: Doc<"mediaFiles">[]) {
  await Promise.all(
    media.map((item) => ctx.db.patch(item._id, { isPrimary: false })),
  );
  return media.length;
}

/**
 * Decides whether a new file starts as the object's primary image. An explicit
 * request wins; otherwise only the object's first image becomes primary, so an
 * upload never replaces the image an object already shows.
 */
export async function resolveNewMediaPrimary(
  ctx: QueryCtx,
  {
    collectionId,
    requested,
    ...media
  }: PrimaryCandidate & {
    collectionId: Id<"collections">;
    requested?: boolean;
  },
) {
  if (!canBePrimaryImage(media)) return false;
  if (requested !== undefined) return requested;
  let checked = 0;
  for await (const image of ctx.db
    .query("mediaFiles")
    .withIndex("by_collection_and_fileType", (q) =>
      q.eq("collectionId", collectionId).eq("fileType", "image"),
    )) {
    if (canBePrimaryImage(image)) return false;
    checked += 1;
    if (checked >= PRIMARY_MEDIA_READ_LIMIT) return false;
  }
  return true;
}

/** Clears the primary flag from every other file attached to the object. */
export async function clearOtherPrimaryMedia(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  keepMediaId: Id<"mediaFiles">,
) {
  const primaryMedia = await listPrimaryMedia(ctx, collectionId);
  return await clearPrimaryFlags(
    ctx,
    primaryMedia.filter((media) => media._id !== keepMediaId),
  );
}

/** Makes the image its object's only primary image and requests a thumbnail. */
export async function makeOnlyPrimaryImage(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
) {
  if (!canBePrimaryImage(media)) {
    throw new Error("Only an image can be the primary image");
  }
  await clearOtherPrimaryMedia(ctx, media.collectionId, media._id);
  if (!media.isPrimary) {
    await ctx.db.patch(media._id, { isPrimary: true });
  }
  if (
    shouldGenerateMediaThumbnail({
      fileType: media.fileType,
      fileSize: media.fileSize,
      isPrimary: true,
    })
  ) {
    await ctx.scheduler.runAfter(0, internal.media.generateThumbnail, {
      mediaId: media._id,
    });
  }
}

/**
 * Repairs an object that uploads left with several primary files. Keeps the
 * oldest primary image (or, without one, the oldest primary file) and clears
 * the rest; objects with one primary file or none are left untouched.
 */
export async function keepOldestPrimaryImage(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const primaryMedia = await listPrimaryMedia(ctx, collectionId);
  if (primaryMedia.length < 2) return 0;
  // The index orders primaries by file type, then oldest first.
  const keep =
    primaryMedia.find(canBePrimaryImage) ??
    primaryMedia.reduce((oldest, media) =>
      media._creationTime < oldest._creationTime ? media : oldest,
    );
  return await clearPrimaryFlags(
    ctx,
    primaryMedia.filter((media) => media._id !== keep._id),
  );
}

interface DraftMediaItem {
  storageId: Id<"_storage">;
  mediaCategory: "image" | "document";
  mimeType: string;
  isPrimary: boolean;
}

function canDraftMediaBePrimary(item: DraftMediaItem) {
  return canBePrimaryImage({
    fileType: getMediaFileType(item.mimeType),
    mediaCategory: item.mediaCategory,
  });
}

/**
 * Leaves exactly one primary image in draft media: the first flagged image,
 * otherwise the first image. Documents are never primary.
 */
export function normalizeDraftMediaPrimary<T extends DraftMediaItem>(
  draftMedia: T[],
): T[] {
  const flaggedIndex = draftMedia.findIndex(
    (item) => item.isPrimary && canDraftMediaBePrimary(item),
  );
  const primaryIndex =
    flaggedIndex === -1
      ? draftMedia.findIndex(canDraftMediaBePrimary)
      : flaggedIndex;
  return draftMedia.map((item, index) => {
    const isPrimary = index === primaryIndex;
    return item.isPrimary === isPrimary ? item : { ...item, isPrimary };
  });
}

/**
 * Choosing a draft's primary image needs the same permission as choosing an
 * object's. Staff without it still save the draft; its saved primary stays.
 */
export async function keepDraftPrimaryUnlessPermitted<T extends DraftMediaItem>(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  saved: DraftMediaItem[] | undefined,
  next: T[],
): Promise<T[]> {
  const savedPrimaryId = normalizeDraftMediaPrimary(saved ?? []).find(
    (item) => item.isPrimary,
  )?.storageId;
  const nextPrimaryId = next.find((item) => item.isPrimary)?.storageId;
  if (
    savedPrimaryId === undefined ||
    nextPrimaryId === savedPrimaryId ||
    (await hasPermission(ctx, organizationId, "media.upload"))
  ) {
    return next;
  }
  return normalizeDraftMediaPrimary(
    next.map((item) => ({
      ...item,
      isPrimary: item.storageId === savedPrimaryId,
    })),
  );
}
