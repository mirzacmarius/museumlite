"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useDeferredValue } from "react";

export interface SelectableObject {
  _id: Id<"collections">;
  title: string;
  accessionNumber: string;
  status: string;
}

interface UseObjectSearchSelectionOptions {
  organizationId: Id<"organizations"> | undefined;
  query: string;
  status?: "active" | "loaned" | "deaccessioned";
  enabled?: boolean;
}

const BROWSE_PAGE_SIZE = 25;

/**
 * Object picker data loaded on demand. Without a query it pages through
 * recent objects; with a query it asks the server for indexed matches. It
 * never loads a whole organization.
 */
export function useObjectSearchSelection({
  organizationId,
  query,
  status,
  enabled = true,
}: UseObjectSearchSelectionOptions) {
  const search = useDeferredValue(query.trim());
  const isActive = enabled && organizationId !== undefined;
  const browse = usePaginatedQuery(
    api.collections.list,
    isActive && !search ? { organizationId, status } : "skip",
    { initialNumItems: BROWSE_PAGE_SIZE },
  );
  const matches = useQuery(
    api.collections.searchForSelection,
    isActive && search ? { organizationId, query: search, status } : "skip",
  );

  if (search) {
    return {
      items: matches?.items ?? [],
      isLoading: isActive && matches === undefined,
      hasMoreMatches: matches?.hasMore ?? false,
      canLoadMore: false,
      isLoadingMore: false,
      loadMore: () => undefined,
    };
  }
  return {
    items: browse.results.map(
      (item): SelectableObject => ({
        _id: item._id,
        title: item.title,
        accessionNumber: item.accessionNumber,
        status: item.status,
      }),
    ),
    isLoading: isActive && browse.status === "LoadingFirstPage",
    hasMoreMatches: false,
    canLoadMore: browse.status === "CanLoadMore",
    isLoadingMore: browse.status === "LoadingMore",
    loadMore: () => browse.loadMore(BROWSE_PAGE_SIZE),
  };
}
