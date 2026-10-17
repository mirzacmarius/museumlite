import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { getConvexServerToken } from "@/lib/convex-server-token";
import { recordErrorKind } from "@/lib/record-recovery";
import type { ObjectDetailData } from "./_components/types";
import { ObjectDetailClient } from "./object-detail-client";
import { ObjectDetailSkeleton } from "./object-detail-skeleton";

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

type ObjectDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function ObjectDetailPage({ params }: ObjectDetailPageProps) {
  return (
    <Suspense fallback={<ObjectDetailSkeleton />}>
      <ObjectDetail params={params} />
    </Suspense>
  );
}

/**
 * The object's details for this session, kept in the browser for 30 seconds
 * (the shortest stale time a hover prefetch can use). The page subscribes to
 * the live query as soon as it mounts, so an older snapshot is replaced at
 * once, and Convex Auth clears the browser cache when the user changes.
 */
async function loadObjectDetail(collectionId: Id<"collections">) {
  "use cache: private";
  cacheLife({ stale: 30 });
  const token = await convexAuthNextjsToken();
  return preloadQuery(
    api.collections.getObjectDetail,
    { collectionId },
    { token },
  );
}

async function ObjectDetail({ params }: ObjectDetailPageProps) {
  const { id } = await params;
  const collectionId = id as Id<"collections">;
  try {
    const preloadedObjectDetail = await loadObjectDetail(collectionId);

    return (
      <ObjectDetailClient
        collectionId={collectionId}
        preloadedObjectDetail={preloadedObjectDetail}
      />
    );
  } catch (error) {
    const recovery = recordErrorKind(error);
    if (recovery !== "error") {
      return <RecordRecoveryState kind={recovery} list="objects" />;
    }
    if (!isMissingObjectDetailFunction(error)) {
      throw error;
    }

    const initialObjectDetail = await fetchObjectDetailFallback(
      collectionId,
      await getConvexServerToken(),
    );

    return (
      <ObjectDetailClient
        collectionId={collectionId}
        initialObjectDetail={initialObjectDetail}
      />
    );
  }
}
