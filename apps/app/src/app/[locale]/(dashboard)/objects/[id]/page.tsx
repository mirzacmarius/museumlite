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
    locationPath: locationPath.map((location) => ({
      _id: location._id,
      name: location.name,
      locationCode: location.locationCode,
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [token, { id }, { tab }] = await Promise.all([
    convexAuthNextjsToken(),
    params,
    searchParams,
  ]);
  const collectionId = id as Id<"collections">;
  // A `?tab=` link opens that tab; unknown tabs fall back on the client.
  const initialTab = typeof tab === "string" ? tab : undefined;
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
        initialTab={initialTab}
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
        initialTab={initialTab}
      />
    );
  }
}
