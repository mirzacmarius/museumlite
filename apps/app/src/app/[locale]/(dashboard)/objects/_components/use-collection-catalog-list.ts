"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useListState } from "@/hooks/use-list-state";
import { useObjectFilters } from "@/hooks/use-url-filters";
import { defineListState } from "@/lib/list-state";
import {
  INITIAL_OBJECTS_PAGE_SIZE,
  NEXT_OBJECTS_PAGE_SIZE,
} from "./collection-catalog-constants";
import type {
  CollectionListItem,
  TypeOption,
} from "./collection-catalog-types";
import { type ColumnConfig, useDefaultColumns } from "./column-config";
import type { ViewMode } from "./view-toggle";

interface CatalogPreferencesState {
  viewMode: ViewMode;
  columns: ColumnConfig[] | null;
}

type CatalogPreferencesAction =
  | {
      type: "syncFromServer";
      savedViewMode: string | null | undefined;
      savedColumns: string | null | undefined;
      defaultColumns: ColumnConfig[];
    }
  | { type: "setViewMode"; viewMode: ViewMode }
  | { type: "setColumns"; columns: ColumnConfig[] };

function expandStoredStringList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) =>
          typeof item === "string" ? expandStoredStringList(item) : [],
        );
      }
    } catch {
      // Keep the raw value when it is not valid JSON.
    }
  }
  return [trimmed];
}

function catalogPreferencesReducer(
  state: CatalogPreferencesState,
  action: CatalogPreferencesAction,
): CatalogPreferencesState {
  switch (action.type) {
    case "syncFromServer": {
      let viewMode = state.viewMode;
      if (action.savedViewMode) {
        viewMode = action.savedViewMode as ViewMode;
      }

      let columns = state.columns;
      if (action.savedColumns) {
        try {
          const parsed = JSON.parse(action.savedColumns) as Record<
            string,
            boolean
          >;
          columns = action.defaultColumns.map((col) => ({
            ...col,
            visible: parsed[col.id] ?? col.visible,
          }));
        } catch {
          columns = action.defaultColumns;
        }
      } else if (columns === null) {
        columns = action.defaultColumns;
      }

      return { viewMode, columns };
    }
    case "setViewMode":
      return { ...state, viewMode: action.viewMode };
    case "setColumns":
      return { ...state, columns: action.columns };
    default:
      return state;
  }
}

const INVENTORY_METRIC_SCOPES = ["owned", "incoming", "unclassified"] as const;

export const OBJECT_SORTS = ["newest", "oldest", "identifier"] as const;
export type ObjectSort = (typeof OBJECT_SORTS)[number];

/**
 * The catalog's sort and loaded depth in the URL. Search and filters keep
 * their existing keys, owned by `useObjectFilters`.
 */
const objectCatalogListState = defineListState({
  filters: {},
  sorts: OBJECT_SORTS,
  pageSize: INITIAL_OBJECTS_PAGE_SIZE,
  loadMoreSize: NEXT_OBJECTS_PAGE_SIZE,
  maxDepth: 500,
  search: false,
});

/** Every URL key that shapes the catalog view, for links back to it. */
export const OBJECT_LIST_KEYS = [
  "search",
  "status",
  "inventory",
  "objectType",
  "displayStatus",
  "culture",
  "period",
  "materials",
  "condition",
  "photograph",
  "collectionGroupId",
  "locationIds",
  "locationId",
  "catalogedFrom",
  "catalogedTo",
  "advancedFilters",
  "filterCombinations",
  ...objectCatalogListState.keys,
];

export function useCollectionCatalogList(organizationId: Id<"organizations">) {
  const objectFilters = useObjectFilters();
  const { filters, hasActiveFilters } = objectFilters;
  const catalogView = useListState(objectCatalogListState);
  const restartCatalogView = catalogView.update;
  const setObjectFilters = objectFilters.setFilters;
  const resetObjectFilters = objectFilters.resetFilters;
  // A new search or filter starts again from the first page.
  const setFilters = useCallback(
    (next: Parameters<typeof setObjectFilters>[0]) => {
      setObjectFilters(next);
      restartCatalogView({});
    },
    [restartCatalogView, setObjectFilters],
  );
  const resetFilters = useCallback(() => {
    resetObjectFilters();
    restartCatalogView({});
  }, [resetObjectFilters, restartCatalogView]);
  const [searchInput, setSearchInput] = useState(filters.search);

  const [selectedIds, setSelectedIds] = useState<Set<Id<"collections">>>(
    new Set(),
  );
  const [showMoveLocationDialog, setShowMoveLocationDialog] = useState(false);
  const [showBulkDeaccessionDialog, setShowBulkDeaccessionDialog] =
    useState(false);
  const [showAddToGroupDialog, setShowAddToGroupDialog] = useState(false);
  const [showAddToCollectionDialog, setShowAddToCollectionDialog] =
    useState(false);
  const [showBulkPrintLabelsDialog, setShowBulkPrintLabelsDialog] =
    useState(false);
  // A bulk field edit runs over the selection or every matching object.
  const [bulkEditScope, setBulkEditScope] = useState<
    "selection" | "filters" | null
  >(null);

  const savedViewMode = useQuery(api.userPreferences.get, {
    key: "objects.viewMode",
    organizationId,
  });
  const savedColumns = useQuery(api.userPreferences.get, {
    key: "objects.columns",
    organizationId,
  });
  const setViewPreference = useMutation(api.userPreferences.set);
  const defaultColumns = useDefaultColumns();
  const [{ viewMode, columns }, dispatchCatalogPreferences] = useReducer(
    catalogPreferencesReducer,
    { viewMode: "list" as ViewMode, columns: null as ColumnConfig[] | null },
  );

  useEffect(() => {
    dispatchCatalogPreferences({
      type: "syncFromServer",
      savedViewMode,
      savedColumns,
      defaultColumns,
    });
  }, [defaultColumns, savedColumns, savedViewMode]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchInput === filters.search) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFilters({ search: searchInput });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters.search, searchInput, setFilters]);

  const handleViewModeChange = (mode: ViewMode) => {
    dispatchCatalogPreferences({ type: "setViewMode", viewMode: mode });
    setViewPreference({
      key: "objects.viewMode",
      value: mode,
      organizationId,
    });
  };

  const handleColumnToggle = (columnId: string, visible: boolean) => {
    const currentColumns = columns ?? defaultColumns;
    const newColumns = currentColumns.map((col) =>
      col.id === columnId ? { ...col, visible } : col,
    );
    dispatchCatalogPreferences({ type: "setColumns", columns: newColumns });

    const columnVisibility = Object.fromEntries(
      newColumns.map((col) => [col.id, col.visible]),
    );
    setViewPreference({
      key: "objects.columns",
      value: JSON.stringify(columnVisibility),
      organizationId,
    });
  };

  // Groups without a condition match everything, so they are not sent.
  const advancedFilters = filters.advancedFilters.filter(
    (group) => group.filters.length > 0,
  );

  const statusFilter =
    filters.status !== "any" &&
    filters.status !== "all" &&
    filters.status !== "deaccessioned"
      ? filters.status
      : undefined;

  const exportFilters = {
    inventoryMetricScope: INVENTORY_METRIC_SCOPES.find(
      (scope) => scope === filters.inventoryScope,
    ),
    search: filters.search || undefined,
    status: statusFilter,
    objectType: filters.objectType || undefined,
    displayStatus: filters.displayStatus || undefined,
    culture: filters.culture || undefined,
    period: filters.period || undefined,
    materials: filters.materials || undefined,
    condition: filters.condition || undefined,
    hasImage:
      filters.photograph === "with"
        ? true
        : filters.photograph === "without"
          ? false
          : undefined,
    collectionGroupId: filters.collectionGroupId
      ? (filters.collectionGroupId as Id<"collectionGroups">)
      : undefined,
    locationIds:
      filters.locationIds.length > 0
        ? (filters.locationIds as Id<"locations">[])
        : undefined,
    catalogedFrom: filters.catalogedFrom
      ? new Date(filters.catalogedFrom).getTime()
      : undefined,
    catalogedTo: filters.catalogedTo
      ? new Date(filters.catalogedTo).setHours(23, 59, 59, 999)
      : undefined,
    ...(advancedFilters.length > 0
      ? { advancedFilters, filterCombinations: filters.filterCombinations }
      : {}),
  };
  const isSearching = filters.search.trim() !== "";

  const {
    results: collections,
    status: collectionsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.collections.list,
    { organizationId, ...exportFilters, sort: catalogView.state.sort },
    { initialNumItems: catalogView.state.show },
  );

  const shouldLoadFilterMetadata =
    collectionsStatus !== "LoadingFirstPage" ||
    filters.objectType !== "" ||
    filters.locationIds.length > 0 ||
    filters.collectionGroupId !== "";
  const collectionGroups = useQuery(
    api.collectionGroups.list,
    shouldLoadFilterMetadata ? { organizationId } : "skip",
  );
  const locations = useQuery(
    api.locations.listAllWithPaths,
    shouldLoadFilterMetadata ? { organizationId } : "skip",
  );
  const typeOptions = useQuery(
    api.typeOptions.list,
    shouldLoadFilterMetadata ? { organizationId } : "skip",
  );
  const facetValues = useQuery(
    api.objectSearch.facetValues,
    shouldLoadFilterMetadata ? { organizationId } : "skip",
  );

  const activeCollectionGroup = useMemo(() => {
    if (!filters.collectionGroupId || !collectionGroups) {
      return null;
    }
    return (
      collectionGroups.find(
        (group) => group._id === filters.collectionGroupId,
      ) ?? null
    );
  }, [collectionGroups, filters.collectionGroupId]);

  const objectTypeOptions = useMemo(() => {
    const types = new Set<string>();

    function addObjectType(value: string) {
      for (const part of expandStoredStringList(value)) {
        const trimmed = part.trim();
        if (trimmed) types.add(trimmed);
      }
    }

    typeOptions?.forEach((option: TypeOption) => {
      if (option.name) addObjectType(option.name);
    });
    // Types recorded on objects, whether or not the option list has them.
    const listed = new Set(Array.from(types, (type) => type.toLowerCase()));
    facetValues?.objectTypes.forEach((facet) => {
      if (!listed.has(facet.value)) addObjectType(facet.label);
    });
    collections.forEach((item: CollectionListItem) => {
      if (item.objectType) addObjectType(item.objectType);
    });
    return Array.from(types).sort((left, right) => left.localeCompare(right));
  }, [collections, facetValues, typeOptions]);

  const handleSelectItem = (id: Id<"collections">, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && collections.length > 0) {
      setSelectedIds(new Set(collections.map((item) => item._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkSuccess = () => {
    setSelectedIds(new Set());
  };

  return {
    exportFilters,
    filters,
    setFilters,
    resetFilters,
    isFiltered: hasActiveFilters,
    sort: catalogView.state.sort,
    setSort: (sort: ObjectSort) => catalogView.update({ sort }),
    isSearching,
    facetValues,
    bulkEditScope,
    setBulkEditScope,
    searchInput,
    setSearchInput,
    selectedIds,
    showMoveLocationDialog,
    setShowMoveLocationDialog,
    showBulkDeaccessionDialog,
    setShowBulkDeaccessionDialog,
    showAddToGroupDialog,
    setShowAddToGroupDialog,
    showAddToCollectionDialog,
    setShowAddToCollectionDialog,
    activeCollectionGroup,
    showBulkPrintLabelsDialog,
    setShowBulkPrintLabelsDialog,
    viewMode,
    columns,
    defaultColumns,
    collections,
    collectionsStatus,
    loadMore: ({ remember }: { remember: boolean }) => {
      loadMore(NEXT_OBJECTS_PAGE_SIZE);
      if (remember) catalogView.loadMore();
    },
    collectionGroups,
    locations,
    objectTypeOptions,
    handleViewModeChange,
    handleColumnToggle,
    handleSelectItem,
    handleSelectAll,
    handleClearSelection,
    handleBulkSuccess,
  };
}
