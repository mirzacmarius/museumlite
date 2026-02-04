import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { ObjectDetailClient } from "./object-detail-client";

export default async function ObjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await convexAuthNextjsToken();
  const { id } = await params;
  const collectionId = id as Id<"collections">;
  const collection = await fetchQuery(
    api.collections.get,
    { collectionId },
    { token },
  );

  if (!collection) {
    return (
      <ObjectDetailClient
        collectionId={collectionId}
        collection={null}
        preloadedCollectionGroup={null}
        preloadedLocationPath={null}
        preloadedMedia={null}
      />
    );
  }

  const [
    preloadedCollectionGroup,
    preloadedLocationPath,
    preloadedMedia,
  ] = await Promise.all([
    collection.collectionGroupId
      ? preloadQuery(
          api.collectionGroups.get,
          { groupId: collection.collectionGroupId },
          { token },
        )
      : Promise.resolve(null),
    collection.currentLocationId
      ? preloadQuery(
          api.locations.getLocationPath,
          { locationId: collection.currentLocationId },
          { token },
        )
      : Promise.resolve(null),
    preloadQuery(
      api.media.list,
      { collectionId: collection._id },
      { token },
    ),
  ]);

  return (
    <ObjectDetailClient
      collectionId={collectionId}
      collection={collection}
      preloadedCollectionGroup={preloadedCollectionGroup}
      preloadedLocationPath={preloadedLocationPath}
      preloadedMedia={preloadedMedia}
    />
  );
}
