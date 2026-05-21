"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useObjectFilters } from "@/hooks/use-url-filters";
import { exportCollectionsToCsv } from "./collection-bulk-export";
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

export function useCollectionCatalogList(organizationId: Id<"organizations">) {
  const { filters, setFilters, resetFilters } = useObjectFilters();
  const [searchInput, setSearchInput] = useState(filters.search);

  const [selectedIds, setSelectedIds] = useState<Set<Id<"collections">>>(
    new Set(),
  );
  const [showMoveLocationDialog, setShowMoveLocationDialog] = useState(false);
  const [showBulkDeaccessionDialog, setShowBulkDeaccessionDialog] =
    useState(false);
  const [showAddToGroupDialog, setShowAddToGroupDialog] = useState(false);
  const [showBulkPrintLabelsDialog, setShowBulkPrintLabelsDialog] =
    useState(false);

  const bulkExport = useQuery(
    api.collections.bulkExport,
    selectedIds.size > 0 ? { collectionIds: Array.from(selectedIds) } : "skip",
  );
  const savedViewMode = useQuery(api.userPreferences.get, {
    key: "objects.viewMode",
    organizationId,
  });
  const savedColumns = useQuery(api.userPreferences.get, {
    key: "objects.columns",
    organizationId,
  });
  const setViewPreference = useMutation(api.userPreferences.set);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const defaultColumns = useDefaultColumns();
  const [columns, setColumns] = useState<ColumnConfig[] | null>(null);

  useEffect(() => {
    if (savedViewMode) {
      setViewMode(savedViewMode as ViewMode);
    }

    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns) as Record<string, boolean>;
        setColumns(
          defaultColumns.map((col) => ({
            ...col,
            visible: parsed[col.id] ?? col.visible,
          })),
        );
      } catch {
        setColumns(defaultColumns);
      }
    } else {
      setColumns(defaultColumns);
    }
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
    setViewMode(mode);
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
    setColumns(newColumns);

    const columnVisibility = Object.fromEntries(
      newColumns.map((col) => [col.id, col.visible]),
    );
    setViewPreference({
      key: "objects.columns",
      value: JSON.stringify(columnVisibility),
      organizationId,
    });
  };

  const statusFilter =
    filters.status !== "any" &&
    filters.status !== "all" &&
    filters.status !== "deaccessioned"
      ? filters.status
      : undefined;

  const {
    results: collections,
    status: collectionsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.collections.list,
    {
      organizationId,
      search: filters.search || undefined,
      status: statusFilter,
      objectType: filters.objectType || undefined,
      culture: filters.culture || undefined,
      period: filters.period || undefined,
      materials: filters.materials || undefined,
      collectionGroupId: filters.collectionGroupId
        ? (filters.collectionGroupId as Id<"collectionGroups">)
        : undefined,
      locationId: filters.locationId
        ? (filters.locationId as Id<"locations">)
        : undefined,
      catalogedFrom: filters.catalogedFrom
        ? new Date(filters.catalogedFrom).getTime()
        : undefined,
      catalogedTo: filters.catalogedTo
        ? new Date(filters.catalogedTo).setHours(23, 59, 59, 999)
        : undefined,
    },
    { initialNumItems: INITIAL_OBJECTS_PAGE_SIZE },
  );

  const shouldLoadFilterMetadata =
    collectionsStatus !== "LoadingFirstPage" ||
    filters.objectType !== "" ||
    filters.locationId !== "" ||
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

  const objectTypeOptions = useMemo(() => {
    const types = new Set<string>();
    typeOptions?.forEach((option: TypeOption) => {
      if (option.name) types.add(option.name);
    });
    collections.forEach((item: CollectionListItem) => {
      if (item.objectType) types.add(item.objectType);
    });
    return Array.from(types)
      .filter((typeName) => typeName.trim() !== "")
      .sort();
  }, [collections, typeOptions]);

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

  const handleBulkExport = () => {
    if (!bulkExport || bulkExport.length === 0) {
      return;
    }
    exportCollectionsToCsv(bulkExport);
  };

  const handleBulkSuccess = () => {
    setSelectedIds(new Set());
  };

  return {
    filters,
    setFilters,
    resetFilters,
    searchInput,
    setSearchInput,
    selectedIds,
    showMoveLocationDialog,
    setShowMoveLocationDialog,
    showBulkDeaccessionDialog,
    setShowBulkDeaccessionDialog,
    showAddToGroupDialog,
    setShowAddToGroupDialog,
    showBulkPrintLabelsDialog,
    setShowBulkPrintLabelsDialog,
    viewMode,
    columns,
    defaultColumns,
    collections,
    collectionsStatus,
    loadMore: () => loadMore(NEXT_OBJECTS_PAGE_SIZE),
    collectionGroups,
    locations,
    objectTypeOptions,
    handleViewModeChange,
    handleColumnToggle,
    handleSelectItem,
    handleSelectAll,
    handleClearSelection,
    handleBulkExport,
    handleBulkSuccess,
  };
}
