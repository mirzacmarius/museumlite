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

      const storageId =
        preferredMedia.thumbnailStorageId ??
        (isImageMedia(preferredMedia) ? preferredMedia.storageId : undefined);
      const url = storageId
        ? ((await ctx.storage.getUrl(storageId)) ?? undefined)
        : undefined;

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
