import type { PaginationResult } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  getCollectionPrimaryImageUrls,
  getLocationPathStrings,
} from "./collectionDisplayHelpers";
import { countOpenDeaccessionCollectionIds } from "./indexedCounts";

interface CollectionListFilters {
  organizationId: Id<"organizations">;
  status?: Doc<"collections">["status"];
  includeDeaccessioned?: boolean;
  locationId?: Id<"locations">;
  locationIds?: Id<"locations">[];
  objectType?: string;
  displayStatus?: string;
  culture?: string;
  period?: string;
  materials?: string;
  collectionGroupId?: Id<"collectionGroups">;
  catalogedFrom?: number;
  catalogedTo?: number;
  search?: string;
}

function parseStoredStringList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) =>
          typeof item === "string" ? parseStoredStringList(item) : [],
        );
      }
    } catch {
      // Keep the raw value when it is not valid JSON.
    }
  }
  return [trimmed];
}

function matchesObjectType(
  stored: string | undefined,
  filter: string,
): boolean {
  if (!stored) return false;
  if (stored === filter) return true;
  const storedValues = parseStoredStringList(stored);
  const filterValues = parseStoredStringList(filter);
  return filterValues.some((value) => storedValues.includes(value));
}

/** Filter only the bounded database page; never load an organization's relations. */
export async function filterCollectionListPage(
  ctx: Pick<QueryCtx, "db">,
  page: Doc<"collections">[],
  args: CollectionListFilters,
) {
  const search = args.search?.trim() ? args.search : undefined;
  const searchLower = search?.toLowerCase();
  const titleMatches = new Map<string, Promise<boolean>>();
  const locationIdSet = new Set(
    args.locationIds && args.locationIds.length > 0
      ? args.locationIds
      : args.locationId
        ? [args.locationId]
        : [],
  );
  const matches = await Promise.all(
    page.map(async (collection) => {
      if (args.status && collection.status !== args.status) return false;
      if (collection.status === "deleted" && args.status !== "deleted")
        return false;
      if (
        collection.status === "deaccessioned" &&
        args.status !== "deaccessioned" &&
        !args.includeDeaccessioned
      )
        return false;
      if (
        locationIdSet.size > 0 &&
        (!collection.currentLocationId ||
          !locationIdSet.has(collection.currentLocationId))
      )
        return false;
      if (args.objectType && !matchesObjectType(collection.objectType, args.objectType))
        return false;
      if (args.displayStatus && collection.displayStatus !== args.displayStatus)
        return false;
      if (
        args.catalogedFrom !== undefined &&
        collection.catalogedAt < args.catalogedFrom
      )
        return false;
      if (
        args.catalogedTo !== undefined &&
        collection.catalogedAt > args.catalogedTo
      )
        return false;
      for (const field of ["culture", "period", "materials"] as const) {
        const value = args[field];
        if (
          value &&
          !collection[field]?.toLowerCase().includes(value.toLowerCase())
        )
          return false;
      }
      if (search && searchLower) {
        const substringMatch = [
          collection.accessionNumber,
          collection.description,
          collection.objectName,
          collection.objectType,
          collection.culture,
          collection.period,
          collection.materials,
          collection.provenance,
        ].some((value) => value?.toLowerCase().includes(searchLower));
        if (!substringMatch) {
          // Keep Convex's title token/prefix semantics. Exact-title filtering makes
          // this an existence probe, without collecting every full-text match.
          let match = titleMatches.get(collection.title);
          if (!match) {
            match = ctx.db
              .query("collections")
              .withSearchIndex("search_index", (q) =>
                q
                  .search("title", search)
                  .eq("organizationId", args.organizationId)
                  .eq("title", collection.title),
              )
              .first()
              .then((result) => result !== null);
            titleMatches.set(collection.title, match);
          }
          if (!(await match)) return false;
        }
      }
      if (
        args.collectionGroupId &&
        collection.collectionGroupId !== args.collectionGroupId
      ) {
        const groupId = args.collectionGroupId;
        const membership = await ctx.db
          .query("collectionGroupItems")
          .withIndex("by_collectionGroup_and_collection", (q) =>
            q
              .eq("collectionGroupId", groupId)
              .eq("collectionId", collection._id),
          )
          .first();
        if (!membership) return false;
      }
      if (args.status !== "deleted" && collection.status !== "deaccessioned") {
        for (const status of ["pending", "approved"] as const) {
          const deaccession = await ctx.db
            .query("deaccessions")
            .withIndex("by_organization_and_collection_and_status", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("collectionId", collection._id)
                .eq("status", status),
            )
            .first();
          if (deaccession?.organizationId === args.organizationId) return false;
        }
      }
      return true;
    }),
  );
  return page.filter((_, index) => matches[index]);
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
  paginationResult: PaginationResult<CollectionListPageItem>,
) {
  return {
    ...paginationResult,
    page: await enrichCollectionListPage(ctx, paginationResult.page),
  };
}
