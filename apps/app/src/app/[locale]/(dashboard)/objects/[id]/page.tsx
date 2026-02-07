import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
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
        collectionGroup={null}
        locationPath={null}
        media={null}
      />
    );
  }

  const [collectionGroup, locationPath, media] = await Promise.all([
    collection.collectionGroupId
      ? fetchQuery(
          api.collectionGroups.get,
          { groupId: collection.collectionGroupId },
          { token },
        )
      : Promise.resolve(null),
    collection.currentLocationId
      ? fetchQuery(
          api.locations.getLocationPath,
          { locationId: collection.currentLocationId },
          { token },
        )
      : Promise.resolve(null),
    fetchQuery(
      api.media.list,
      { collectionId: collection._id },
      { token },
    ),
  ]);

  return (
    <ObjectDetailClient
      collectionId={collectionId}
      collection={collection}
      collectionGroup={collectionGroup}
      locationPath={locationPath}
      media={media}
    />
  );
}
