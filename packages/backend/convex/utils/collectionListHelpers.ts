import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  getCollectionPrimaryImageUrls,
  getLocationPathStrings,
} from "./collectionDisplayHelpers";
import { countOpenDeaccessionCollectionIds } from "./indexedCounts";

/**
 * Whether catalog list pagination can use org/status/location indexes only.
 * Text and membership filters (including JSON-stored object types) skip this path.
 */
export function shouldUseIndexedCollectionsPagination(args: {
  collectionGroupId?: Id<"collectionGroups">;
  culture?: string;
  period?: string;
  materials?: string;
  objectType?: string;
  displayStatus?: string;
  search?: string;
  catalogedFrom?: number;
  catalogedTo?: number;
}) {
  return (
    !args.collectionGroupId &&
    !args.culture &&
    !args.period &&
    !args.materials &&
    !args.objectType &&
    !args.displayStatus &&
    !args.search?.trim() &&
    !args.catalogedFrom &&
    !args.catalogedTo
  );
}

export async function getCollectionsWithOpenDeaccessions(
  ctx: Pick<QueryCtx, "db">,
  organizationId: Id<"organizations">,
) {
  return countOpenDeaccessionCollectionIds(ctx, organizationId);
}

export type CollectionListPageItem = {
  _id: Id<"collections">;
  accessionNumber: string;
  title: string;
  collectionGroupId?: Id<"collectionGroups">;
  objectType?: string;
  currentLocationId?: Id<"locations">;
  status: Doc<"collections">["status"];
  _creationTime: number;
};

export async function enrichCollectionListPage(
  ctx: Pick<QueryCtx, "db" | "storage">,
  page: CollectionListPageItem[],
) {
  const collectionIds = page.map((item) => item._id);
  const locationIds = page.flatMap((item) =>
    item.currentLocationId === undefined ? [] : [item.currentLocationId],
  );

  const [locationPathById, primaryImageUrlByCollectionId] = await Promise.all([
    getLocationPathStrings(ctx, locationIds),
    getCollectionPrimaryImageUrls(ctx, collectionIds),
  ] as const);

  return page.map((item) => ({
    _id: item._id,
    accessionNumber: item.accessionNumber,
    title: item.title,
    collectionGroupId: item.collectionGroupId,
    objectType: item.objectType,
    currentLocationId: item.currentLocationId,
    locationPath: item.currentLocationId
      ? locationPathById.get(item.currentLocationId)
      : undefined,
    primaryImageUrl: primaryImageUrlByCollectionId.get(item._id),
    status: item.status,
    _creationTime: item._creationTime,
  }));
}

export async function toCollectionListPaginationResult(
  ctx: Pick<QueryCtx, "db" | "storage">,
  paginationResult: {
    page: CollectionListPageItem[];
    isDone: boolean;
    continueCursor: string;
  },
) {
  return {
    page: await enrichCollectionListPage(ctx, paginationResult.page),
    isDone: paginationResult.isDone,
    continueCursor: paginationResult.continueCursor,
  };
}
