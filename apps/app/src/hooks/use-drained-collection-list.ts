"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useEffect } from "react";
import { DRAINED_COLLECTION_LIST_MAX_ITEMS } from "@/lib/drain-collection-list";

type CollectionListArgs = FunctionArgs<typeof api.collections.list>;

export type CollectionListItem = FunctionReturnType<
  typeof api.collections.list
>["page"][number];

export type DrainedCollectionListArgs =
  | Omit<CollectionListArgs, "paginationOpts">
  | "skip";

export interface DrainedCollectionList {
  items: CollectionListItem[];
  isComplete: boolean;
}

export interface UseDrainedCollectionListOptions {
  pageSize?: number;
  maxItems?: number;
}

export const DRAINED_COLLECTION_LIST_PAGE_SIZE = 100;

export function useDrainedCollectionList(
  args: DrainedCollectionListArgs,
  options: UseDrainedCollectionListOptions = {},
): DrainedCollectionList {
  const pageSize = options.pageSize ?? DRAINED_COLLECTION_LIST_PAGE_SIZE;
  const maxItems = options.maxItems ?? DRAINED_COLLECTION_LIST_MAX_ITEMS;
  const isSkipped = args === "skip";

  const { results, status, loadMore } = usePaginatedQuery(
    api.collections.list,
    args,
    { initialNumItems: pageSize },
  );

  useEffect(() => {
    if (isSkipped) return;
    if (status !== "CanLoadMore") return;
    if (results.length >= maxItems) return;
    loadMore(pageSize);
  }, [isSkipped, loadMore, maxItems, pageSize, results.length, status]);

  if (isSkipped) {
    return { items: [], isComplete: true };
  }

  return {
    items: results.slice(0, maxItems),
    isComplete: status === "Exhausted",
  };
}
