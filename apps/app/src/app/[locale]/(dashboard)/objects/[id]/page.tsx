import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import type { ObjectDetailData } from "./_components/types";
import { ObjectDetailClient } from "./object-detail-client";

function isMissingObjectDetailFunction(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("collections:getObjectDetail")
  );
}

async function fetchObjectDetailFallback(
  collectionId: Id<"collections">,
  token: string | undefined,
): Promise<ObjectDetailData | null> {
  const collection = await fetchQuery(
    api.collections.get,
    { collectionId },
    { token },
  );

  if (!collection) {
    return null;
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
      : Promise.resolve([]),
    fetchQuery(api.media.list, { collectionId: collection._id }, { token }),
  ]);

  const heroImage =
    media.find((file) => file.isPrimary && file.fileType === "image") ??
    media.find((file) => file.fileType === "image") ??
    null;

  return {
    collection,
    collectionGroup: collectionGroup
      ? {
          _id: collectionGroup._id,
          name: collectionGroup.name,
        }
      : null,
    locationPath: locationPath.map(({ _id, name, locationCode }) => ({
      _id,
      name,
      locationCode,
    })),
    heroImage: heroImage
      ? {
          _id: heroImage._id,
          url: heroImage.url,
          thumbnailUrl: heroImage.thumbnailUrl,
          fileName: heroImage.fileName,
          fileType: heroImage.fileType,
          caption: heroImage.caption,
          isPrimary: heroImage.isPrimary,
        }
      : null,
  };
}

export default async function ObjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [token, { id }] = await Promise.all([convexAuthNextjsToken(), params]);
  const collectionId = id as Id<"collections">;
  try {
    const preloadedObjectDetail = await preloadQuery(
      api.collections.getObjectDetail,
      { collectionId },
      { token },
    );

    return (
      <ObjectDetailClient
        collectionId={collectionId}
        preloadedObjectDetail={preloadedObjectDetail}
      />
    );
  } catch (error) {
    if (!isMissingObjectDetailFunction(error)) {
      throw error;
    }

    const initialObjectDetail = await fetchObjectDetailFallback(
      collectionId,
      token,
    );

    return (
      <ObjectDetailClient
        collectionId={collectionId}
        initialObjectDetail={initialObjectDetail}
      />
    );
  }
}
