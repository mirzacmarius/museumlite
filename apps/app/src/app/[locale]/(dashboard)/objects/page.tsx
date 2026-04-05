"use client";

import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useObjectFilters } from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { EmptyState } from "@v1/ui/empty-state";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  Building2,
  LayoutGrid,
  List,
  MoreVertical,
  Package,
  Plus,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BulkActionsBar } from "./_components/bulk-actions-bar";
import { BulkAddToGroupDialog } from "./_components/bulk-add-to-group-dialog";
import { BulkDeaccessionDialog } from "./_components/bulk-deaccession-dialog";
import { BulkMoveLocationDialog } from "./_components/bulk-move-location-dialog";
import { BulkPrintLabelsDialog } from "./_components/bulk-print-labels-dialog";
import {
  type ColumnConfig,
  ColumnConfigDropdown,
  useDefaultColumns,
} from "./_components/column-config";
import { ObjectAppliedFilters } from "./_components/object-applied-filters";
import { ObjectFiltersDropdown } from "./_components/object-filters-dropdown";
import { ObjectGridView } from "./_components/object-grid-view";
import { type ViewMode } from "./_components/view-toggle";

export default function CollectionsPage() {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  const exportObjects = useMutation(api.imports.exportObjects);

  const handleExport = useCallback(async () => {
    if (!currentOrganizationId) return [];
    return exportObjects({ organizationId: currentOrganizationId });
  }, [currentOrganizationId, exportObjects]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("objectNotFound")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("form.errors.selectOrganization")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              {common("create")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("form.errors.selectOrganization")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("form.errors.selectOrganization")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-zinc-950 flex-col overflow-hidden">
      <CollectionFiltersAndList
        organizationId={currentOrganizationId}
        onExport={handleExport}
      />
    </div>
  );
}

function CollectionFiltersAndList({
  organizationId,
  onExport,
}: {
  organizationId: Id<"organizations">;
  onExport: () => Promise<Record<string, unknown>[] | undefined>;
}) {
  const t = useScopedI18n("objects");
  const { filters, setFilters, resetFilters } = useObjectFilters();

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

  const collectionGroups = useQuery(api.collectionGroups.list, {
    organizationId,
  });
  const locations = useQuery(api.locations.listAllWithPaths, {
    organizationId,
  });
  const typeOptions = useQuery(api.typeOptions.list, { organizationId });

  useEffect(() => {
    if (savedViewMode) {
      setViewMode(savedViewMode as ViewMode);
    }
  }, [savedViewMode]);

  useEffect(() => {
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
  }, [savedColumns, defaultColumns]);

  useEffect(() => {
    if (
      filters.status === "deaccessioned" ||
      filters.status === "deleted"
    ) {
      setFilters({ status: "any" });
    }
  }, [filters.status, setFilters]);

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
    filters.status !== "deaccessioned" &&
    filters.status !== "deleted"
      ? filters.status
      : undefined;

  const {
    results: collections,
    status: collectionsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.collections.list,
    organizationId
      ? {
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
        }
      : "skip",
    { initialNumItems: 20 },
  );

  const objectTypeOptions = useMemo(() => {
    const types = new Set<string>();
    typeOptions?.forEach((option) => {
      if (option.name) types.add(option.name);
    });
    collections.forEach((item) => {
      if (item.objectType) types.add(item.objectType);
    });
    return Array.from(types)
      .filter((t) => t.trim() !== "")
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
      if (selectedIds.size === 0) {
        onExport();
        return;
      }
    }

    const headers = [
      "Accession Number",
      "Title",
      "Alternative Title",
      "Creator",
      "Object Type",
      "Object Name",
      "Culture",
      "Period",
      "Date Created",
      "Materials",
      "Technique",
      "Dimensions",
      "Description",
      "Condition",
      "Provenance",
      "Status",
      "Location",
      "Collection Group",
      "Cataloged Date",
    ];

    const rows = (bulkExport || []).map((item) => [
      item.accessionNumber,
      item.title,
      item.alternativeTitle ?? "",
      item.creator ?? "",
      item.objectType ?? "",
      item.objectName ?? "",
      item.culture ?? "",
      item.period ?? "",
      item.dateCreated ?? "",
      item.materials ?? "",
      item.technique ?? "",
      item.dimensions ?? "",
      item.description?.replace(/[\n\r]/g, " ") ?? "",
      item.condition ?? "",
      item.provenance?.replace(/[\n\r]/g, " ") ?? "",
      item.status,
      item.locationPath ?? "",
      item.collectionGroup ?? "",
      new Date(item.catalogedAt).toISOString().split("T")[0] ?? "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `collection-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(
      `Exported ${(bulkExport || []).length} item${(bulkExport || []).length !== 1 ? "s" : ""}`,
    );
  };

  const handleBulkSuccess = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur-sm z-20">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-zinc-200 tracking-tight">
              {t("title")}
            </h2>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="relative group">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={filters.search || ""}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="w-64 bg-zinc-900/50 border border-zinc-800 rounded-md py-1.5 pl-8 pr-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-zinc-900/80 transition-all"
              />
            </div>
            <ObjectFiltersDropdown
              filters={{
                status: filters.status,
                objectType: filters.objectType,
                locationId: filters.locationId,
                collectionGroupId: filters.collectionGroupId,
              }}
              onChange={setFilters}
              objectTypes={objectTypeOptions}
              locations={locations}
              collectionGroups={collectionGroups}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
              <button
                type="button"
                onClick={() => handleViewModeChange("list")}
                className={`p-1.5 rounded shadow-sm transition-all ${
                  viewMode === "list"
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("grid")}
                className={`p-1.5 rounded shadow-sm transition-all ${
                  viewMode === "grid"
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            {viewMode === "list" && (
              <ColumnConfigDropdown
                columns={columns ?? defaultColumns}
                onColumnToggle={handleColumnToggle}
              />
            )}

            <PermissionGate permission="collections.read">
              <ExportCSVButton
                onExport={onExport}
                filename="objects"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-200"
              />
            </PermissionGate>

            <PermissionGate permission="collections.create">
              <Button
                asChild
                className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-all border-none"
              >
                <Link href="/objects/new" className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  {t("addObject")}
                </Link>
              </Button>
            </PermissionGate>
          </div>
        </div>

        {(filters.search !== "" ||
          filters.status !== "any" ||
          filters.objectType !== "" ||
          filters.locationId !== "" ||
          filters.collectionGroupId !== "") && (
          <div className="px-6 pb-4">
            <ObjectAppliedFilters
              filters={{
                search: filters.search,
                status: filters.status,
                objectType: filters.objectType,
                locationId: filters.locationId,
                collectionGroupId: filters.collectionGroupId,
              }}
              locations={locations}
              collectionGroups={collectionGroups}
              onChange={setFilters}
              onClearAll={resetFilters}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative bg-zinc-900/10">
        <CollectionList
          organizationId={organizationId}
          collections={collections}
          collectionsStatus={collectionsStatus}
          viewMode={viewMode}
          columns={columns ?? defaultColumns}
          selectedIds={selectedIds}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
          onLoadMore={() => loadMore(20)}
        />
      </div>

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        onAddToGroup={() => setShowAddToGroupDialog(true)}
        onMoveLocation={() => setShowMoveLocationDialog(true)}
        onExport={handleBulkExport}
        onPrintLabels={() => setShowBulkPrintLabelsDialog(true)}
        onDeaccession={() => setShowBulkDeaccessionDialog(true)}
      />

      <BulkMoveLocationDialog
        open={showMoveLocationDialog}
        onOpenChange={setShowMoveLocationDialog}
        selectedIds={Array.from(selectedIds)}
        organizationId={organizationId}
        onSuccess={handleBulkSuccess}
      />

      <BulkDeaccessionDialog
        open={showBulkDeaccessionDialog}
        onOpenChange={setShowBulkDeaccessionDialog}
        selectedIds={Array.from(selectedIds)}
        onSuccess={handleBulkSuccess}
      />

      <BulkAddToGroupDialog
        open={showAddToGroupDialog}
        onOpenChange={setShowAddToGroupDialog}
        selectedIds={Array.from(selectedIds)}
        organizationId={organizationId}
        onSuccess={handleBulkSuccess}
      />

      <BulkPrintLabelsDialog
        open={showBulkPrintLabelsDialog}
        onOpenChange={setShowBulkPrintLabelsDialog}
        selectedIds={Array.from(selectedIds)}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}

function CollectionList({
  organizationId,
  collections,
  collectionsStatus,
  viewMode,
  columns,
  selectedIds,
  onSelectItem,
  onSelectAll,
  onLoadMore,
}: {
  organizationId: Id<"organizations">;
  collections: Array<{
    _id: string;
    accessionNumber: string;
    title: string;
    objectType?: string;
    primaryImageUrl?: string;
    locationPath?: string;
    currentLocationId?: Id<"locations">;
    status: string;
    _creationTime: number;
  }>;
  collectionsStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  viewMode: ViewMode;
  columns: ColumnConfig[];
  selectedIds: Set<Id<"collections">>;
  onSelectItem: (id: Id<"collections">, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onLoadMore: () => void;
}) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isAutoLoadingRef = useRef(false);

  useEffect(() => {
    if (collectionsStatus !== "LoadingMore") {
      isAutoLoadingRef.current = false;
    }
  }, [collectionsStatus]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const target = loadMoreRef.current;

    if (!root || !target || collectionsStatus !== "CanLoadMore") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          !isAutoLoadingRef.current &&
          collectionsStatus === "CanLoadMore"
        ) {
          isAutoLoadingRef.current = true;
          onLoadMore();
        }
      },
      {
        root,
        rootMargin: "240px 0px",
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [collectionsStatus, onLoadMore]);

  if (collectionsStatus === "LoadingFirstPage" && collections.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <EmptyState
          icon={Package}
          title={t("emptyState.noObjectsFound")}
          description={t("emptyState.addFirstObject")}
        />
        <PermissionGate permission="collections.create">
          <Button asChild className="mt-4">
            <Link href="/objects/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("emptyState.addFirstObject")}
            </Link>
          </Button>
        </PermissionGate>
      </div>
    );
  }

  const allSelected =
    collections.length > 0 &&
    collections.every((item) =>
      selectedIds.has(item._id as Id<"collections">),
    );
  const someSelected =
    collections.some((item) => selectedIds.has(item._id as Id<"collections">)) &&
    !allSelected;

  return (
    <div className="h-full flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar relative"
      >
        {viewMode === "grid" ? (
          <div className="p-4 sm:p-6">
            {collections.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  checked={
                    allSelected || (someSelected ? "indeterminate" : false)
                  }
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                  aria-label={common("selectAllItems")}
                />
                <span className="text-sm text-muted-foreground">
                  {allSelected
                    ? common("allSelected")
                    : someSelected
                      ? common("selectedCount", { count: selectedIds.size })
                      : common("selectAll")}
                </span>
              </div>
            )}
            <ObjectGridView
              items={collections.map((item) => ({
                _id: item._id as Id<"collections">,
                accessionNumber: item.accessionNumber,
                title: item.title,
                objectType: item.objectType,
                primaryImageUrl: item.primaryImageUrl,
                status: item.status,
              }))}
              organizationId={organizationId}
              selectedIds={selectedIds}
              onSelectItem={onSelectItem}
            />
          </div>
        ) : (
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md shadow-sm">
              <tr>
                <th className="border-b border-zinc-800/80 px-4 py-3 w-10">
                  <Checkbox
                    checked={
                      allSelected || (someSelected ? "indeterminate" : false)
                    }
                    onCheckedChange={(checked) => onSelectAll(checked === true)}
                    className="border-zinc-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500 w-16">
                  Image
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500">
                  Object ID & Description
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500">
                  Collection
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500">
                  Location
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500">
                  Date Acquired
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500 text-right">
                  Status
                </th>
                <th className="border-b border-zinc-800/80 px-4 py-3 font-medium text-zinc-500 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {collections.map((item) => (
                <CollectionTableRow
                  key={item._id}
                  item={item as CollectionListItem}
                  organizationId={organizationId}
                  columns={columns}
                  isSelected={selectedIds.has(item._id as Id<"collections">)}
                  shouldEagerLoad={collections[0]?._id === item._id}
                  onSelect={(selected: boolean) =>
                    onSelectItem(item._id as Id<"collections">, selected)
                  }
                />
              ))}
            </tbody>
          </table>
        )}

        <div ref={loadMoreRef} className="h-6 w-full" />
      </div>

      <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950 px-6 py-3 text-xs text-zinc-500">
        {collectionsStatus === "LoadingMore" ? (
          <span>{common("loading")}</span>
        ) : (
          <>
            {t("pagination.showing")}{" "}
            <span className="text-zinc-300">{collections.length}</span>{" "}
            {t("pagination.items")}
          </>
        )}
      </div>
    </div>
  );
}

type CollectionListItem = FunctionReturnType<
  typeof api.collections.list
>["page"][number];

function CollectionTableRow({
  item,
  organizationId,
  columns,
  isSelected,
  onSelect,
  shouldEagerLoad = false,
}: {
  item: CollectionListItem;
  organizationId: Id<"organizations">;
  columns: ColumnConfig[];
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  shouldEagerLoad?: boolean;
}) {
  const isColumnVisible = (columnId: string) =>
    columns.find((c) => c.id === columnId)?.visible ?? true;
  const [isDeaccessionDialogOpen, setIsDeaccessionDialogOpen] = useState(false);

  const canDeaccession = item.status !== "deaccessioned";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "verified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium capitalize">
            {status}
          </span>
        );
      case "loaned":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium capitalize">
            {status}
          </span>
        );
      case "deaccessioned":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-medium capitalize">
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 font-medium capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <tr
        className={`group hover:bg-zinc-900/60 transition-colors ${isSelected ? "bg-zinc-900/80" : ""}`}
      >
        <td className="px-4 py-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(!!checked)}
            onClick={(e) => e.stopPropagation()}
            className="border-zinc-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
          />
        </td>
        <td className="px-4 py-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden relative">
            {item.primaryImageUrl ? (
              <Image
                src={item.primaryImageUrl}
                alt={item.title}
                fill
                sizes="40px"
                loading={shouldEagerLoad ? "eager" : "lazy"}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 className="h-4 w-4 text-zinc-600" />
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <Link
            href={`/objects/${item._id}`}
            className="flex flex-col group-hover:cursor-pointer"
          >
            <span className="text-zinc-200 font-medium group-hover:text-indigo-400 transition-colors truncate max-w-[200px]">
              {item.title}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {item.accessionNumber}
            </span>
          </Link>
        </td>
        <td className="px-4 py-3">
          <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 truncate max-w-[120px] inline-block">
            {(() => {
              if (!item.objectType) return "General";
              try {
                const parsed = JSON.parse(item.objectType);
                return Array.isArray(parsed) ? parsed[0] : item.objectType;
              } catch {
                return item.objectType;
              }
            })()}
          </span>
        </td>
        <td className="px-4 py-3 text-zinc-400 truncate max-w-[150px]">
          {item.locationPath ? (
            <span className="flex items-center gap-1">{item.locationPath}</span>
          ) : (
            <span className="text-zinc-600">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-zinc-500 font-mono text-[10px]">
          {new Date(item._creationTime).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-right">{getStatusBadge(item.status)}</td>
        <td className="px-4 py-3 text-right">
          {canDeaccession && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-white"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
                className="bg-zinc-950 border-zinc-800 text-zinc-300"
              >
                <PermissionGate permission="collections.update">
                  <DropdownMenuItem
                    className="hover:bg-zinc-900 focus:bg-zinc-900 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDeaccessionDialogOpen(true);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Remove / Transfer
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      </tr>

      <DeaccessionDialog
        open={isDeaccessionDialogOpen}
        onOpenChange={setIsDeaccessionDialogOpen}
        collectionId={item._id}
        collectionTitle={item.title}
        organizationId={organizationId}
      />
    </>
  );
}
