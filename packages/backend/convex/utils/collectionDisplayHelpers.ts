import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export function isImageMedia(media: {
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

/**
 * The files an image shows in the app: its current edited version when it has
 * one, so saved crops and watermarks appear. A version has no thumbnail.
 */
export async function getDisplayedMediaFiles(
  ctx: Pick<QueryCtx, "db">,
  media: Doc<"mediaFiles">,
): Promise<{
  storageId: Id<"_storage">;
  thumbnailStorageId?: Id<"_storage">;
  version: Doc<"mediaVersions"> | null;
}> {
  const version = media.currentVersionId
    ? await ctx.db.get(media.currentVersionId)
    : null;
  if (
    version &&
    version.originalMediaId === media._id &&
    version.organizationId === media.organizationId
  ) {
    return { storageId: version.storageId, version };
  }
  return {
    storageId: media.storageId,
    thumbnailStorageId: media.thumbnailStorageId,
    version: null,
  };
}

/**
 * Whether an edited version carries the watermark, burned in by this edit
 * (`watermark`) or by an earlier one it was made from (`watermarked`).
 */
export function isWatermarkedVersion(version: Doc<"mediaVersions"> | null) {
  const metadata = version?.editMetadata as
    | { watermarked?: unknown; watermark?: { enabled?: unknown } }
    | undefined;
  return (
    metadata?.watermarked === true || metadata?.watermark?.enabled === true
  );
}

/** The URL of an image's thumbnail, or of the image when it has none. */
export async function getDisplayedMediaThumbnailUrl(
  ctx: Pick<QueryCtx, "db" | "storage">,
  media: Doc<"mediaFiles">,
) {
  const files = await getDisplayedMediaFiles(ctx, media);
  return await ctx.storage.getUrl(files.thumbnailStorageId ?? files.storageId);
}

export async function getCollectionPrimaryImageUrls(
  ctx: Pick<QueryCtx, "db" | "storage">,
  collectionIds: Id<"collections">[],
) {
  const entries = await Promise.all(
    collectionIds.map(async (collectionId) => {
      const mediaFiles = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect();

      const imageMedia = mediaFiles.filter((media) => isImageMedia(media));
      const preferredMedia =
        imageMedia.find((media) => media.isPrimary) ?? imageMedia[0];

      if (!preferredMedia) {
        return [collectionId, undefined] as const;
      }

      const url =
        (await getDisplayedMediaThumbnailUrl(ctx, preferredMedia)) ?? undefined;

      return [collectionId, url] as const;
    }),
  );

  return new Map(entries);
}

async function loadLocationAncestors(
  ctx: Pick<QueryCtx, "db">,
  pendingIds: Set<Id<"locations">>,
  locationMap: Map<Id<"locations">, Doc<"locations">>,
) {
  const ids = [...pendingIds];
  pendingIds.clear();

  const locations = await Promise.all(ids.map((id) => ctx.db.get(id)));
  for (const location of locations) {
    if (!location || locationMap.has(location._id)) {
      continue;
    }

    locationMap.set(location._id, location);
    if (
      location.parentLocationId &&
      !locationMap.has(location.parentLocationId)
    ) {
      pendingIds.add(location.parentLocationId);
    }
  }
}

async function loadAllLocationAncestors(
  ctx: Pick<QueryCtx, "db">,
  pendingIds: Set<Id<"locations">>,
  locationMap: Map<Id<"locations">, Doc<"locations">>,
) {
  if (pendingIds.size === 0) {
    return;
  }

  await loadLocationAncestors(ctx, pendingIds, locationMap);
  return loadAllLocationAncestors(ctx, pendingIds, locationMap);
}

export async function getLocationPathStrings(
  ctx: Pick<QueryCtx, "db">,
  locationIds: Id<"locations">[],
) {
  const uniqueLocationIds = [...new Set(locationIds)];
  const locationMap = new Map<Id<"locations">, Doc<"locations">>();
  const pendingIds = new Set(uniqueLocationIds);

  await loadAllLocationAncestors(ctx, pendingIds, locationMap);

  const pathMap = new Map<Id<"locations">, string | undefined>();

  for (const locationId of uniqueLocationIds) {
    const pathSegments: string[] = [];
    let currentId: Id<"locations"> | undefined = locationId;

    while (currentId) {
      const location = locationMap.get(currentId);
      if (!location) {
        break;
      }

      pathSegments.unshift(location.name);
      currentId = location.parentLocationId;
    }

    pathMap.set(
      locationId,
      pathSegments.length > 0 ? pathSegments.join(" > ") : undefined,
    );
  }

  return pathMap;
}

/** How an Object is named outside its own page: accession number and title. */
export function objectLabel(
  object: Pick<Doc<"collections">, "accessionNumber" | "title">,
): string {
  return `${object.accessionNumber} ${object.title}`.trim();
}
