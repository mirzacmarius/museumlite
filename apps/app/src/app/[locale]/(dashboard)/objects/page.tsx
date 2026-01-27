"use client";

import { AdvancedSearchDialog } from "@/components/advanced-search-dialog";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { SearchAutocomplete } from "@/components/search-autocomplete";
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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  Building2,
  Filter,
  LayoutGrid,
  List,
  MapPin,
  MoreVertical,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BulkActionsBar } from "./_components/bulk-actions-bar";
import { BulkAddToGroupDialog } from "./_components/bulk-add-to-group-dialog";
import { BulkDeaccessionDialog } from "./_components/bulk-deaccession-dialog";
import { BulkMoveLocationDialog } from "./_components/bulk-move-location-dialog";
import {
  type ColumnConfig,
  ColumnConfigDropdown,
  useDefaultColumns,
} from "./_components/column-config";
import { ObjectGridView } from "./_components/object-grid-view";
import { SavedViewsDropdown } from "./_components/saved-views-dropdown";
import { type ViewMode, ViewToggle } from "./_components/view-toggle";

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
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { filters, setFilters, resetFilters, hasActiveFilters } =
    useObjectFilters();

  const [cursor, setCursor] = useState<string | null>(null);
  const prevFiltersRef = useRef(filters);

  const [selectedIds, setSelectedIds] = useState<Set<Id<"collections">>>(
    new Set(),
  );
  const [showMoveLocationDialog, setShowMoveLocationDialog] = useState(false);
  const [showBulkDeaccessionDialog, setShowBulkDeaccessionDialog] =
    useState(false);
  const [showAddToGroupDialog, setShowAddToGroupDialog] = useState(false);

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

  // Reset cursor when filters change
  useEffect(() => {
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      prevFiltersRef.current = filters;
      setCursor(null);
    }
  }, [filters]);

  const collections = useQuery(
    api.collections.list,
    organizationId
      ? {
          organizationId,
          paginationOpts: { numItems: 50, cursor },
          search: filters.search || undefined,
          status:
            filters.status !== "all"
              ? (filters.status as "deaccessioned")
              : undefined,
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
  );

  const uniqueObjectTypes = useMemo(() => {
    if (!collections?.page) return [];
    const types = new Set<string>();
    collections.page.forEach((item) => {
      if (item.objectType) types.add(item.objectType);
    });
    return Array.from(types).sort();
  }, [collections]);

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
    if (selected && collections?.page) {
      setSelectedIds(new Set(collections.page.map((item) => item._id)));
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
            <SearchAutocomplete
              value={filters.search || ""}
              onValueChange={(value) => setFilters({ search: value })}
              placeholder={t("searchPlaceholder")}
              className="w-64"
            />
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                  : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              {t("filters.title")}
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(true)}
              className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs transition-colors bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              <Search className="h-3.5 w-3.5" />
              Advanced Filters
            </button>

            <SavedViewsDropdown
              organizationId={organizationId}
              currentFilters={{
                search: filters.search || "",
                status: filters.status,
                objectType: filters.objectType || "",
                culture: filters.culture || "",
                period: filters.period || "",
                materials: filters.materials || "",
                collectionGroupId: filters.collectionGroupId || "",
                locationId: filters.locationId || "",
                catalogedFrom: filters.catalogedFrom || "",
                catalogedTo: filters.catalogedTo || "",
              }}
              onApplyView={(savedFilters) => {
                setFilters({
                  search: savedFilters.search,
                  status: savedFilters.status,
                  objectType: savedFilters.objectType,
                  culture: savedFilters.culture,
                  period: savedFilters.period,
                  materials: savedFilters.materials,
                  collectionGroupId: savedFilters.collectionGroupId,
                  locationId: savedFilters.locationId,
                  catalogedFrom: savedFilters.catalogedFrom,
                  catalogedTo: savedFilters.catalogedTo,
                });
              }}
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
                {t("filters.clear")}
              </button>
            )}
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

        {showFilters && (
          <div className="px-6 py-3 border-t border-zinc-800/60 bg-zinc-900/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-medium">
                {t("filters.status")}
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({
                    status: value as "active" | "deaccessioned" | "all",
                  })
                }
              >
                <SelectTrigger className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded text-xs px-2 text-zinc-300 focus:ring-0 focus:border-zinc-700">
                  <SelectValue placeholder={t("filters.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.active")}</SelectItem>
                  <SelectItem value="deaccessioned">
                    {t("filters.deaccessioned")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-medium">
                {t("filters.objectType")}
              </label>
              <Select
                value={filters.objectType || "all"}
                onValueChange={(value) =>
                  setFilters({ objectType: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded text-xs px-2 text-zinc-300 focus:ring-0 focus:border-zinc-700">
                  <SelectValue placeholder={t("filters.allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
                  {uniqueObjectTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-medium">
                {t("filters.location")}
              </label>
              <Select
                value={filters.locationId || "all"}
                onValueChange={(value) =>
                  setFilters({ locationId: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded text-xs px-2 text-zinc-300 focus:ring-0 focus:border-zinc-700">
                  <SelectValue placeholder={t("filters.allLocations")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("filters.allLocations")}
                  </SelectItem>
                  {locations?.map((location) => (
                    <SelectItem key={location._id} value={location._id}>
                      {location.path.map((p) => p.name).join(" > ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-medium">
                {t("filters.collectionGroup")}
              </label>
              <Select
                value={filters.collectionGroupId || "all"}
                onValueChange={(value) =>
                  setFilters({
                    collectionGroupId: value === "all" ? "" : value,
                  })
                }
              >
                <SelectTrigger className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded text-xs px-2 text-zinc-300 focus:ring-0 focus:border-zinc-700">
                  <SelectValue placeholder={t("filters.allGroups")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allGroups")}</SelectItem>
                  {collectionGroups?.map((group) => (
                    <SelectItem key={group._id} value={group._id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative bg-zinc-900/10">
        <CollectionList
          organizationId={organizationId}
          collections={collections}
          viewMode={viewMode}
          columns={columns ?? defaultColumns}
          selectedIds={selectedIds}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
          onLoadMore={() => {
            if (collections && !collections.isDone) {
              setCursor(collections.continueCursor);
            }
          }}
          onReset={() => setCursor(null)}
        />
      </div>

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        onAddToGroup={() => setShowAddToGroupDialog(true)}
        onMoveLocation={() => setShowMoveLocationDialog(true)}
        onExport={handleBulkExport}
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

      <AdvancedSearchDialog
        open={showAdvancedFilters}
        onOpenChange={setShowAdvancedFilters}
        initialFilterGroups={filters.advancedFilters}
        initialGroupOperator={filters.filterCombinations}
        onApply={(filterGroups, groupOperator) => {
          setFilters({
            advancedFilters: filterGroups,
            filterCombinations: groupOperator,
          });
          setShowAdvancedFilters(false);
          toast.success(
            `Applied ${filterGroups.reduce((sum, g) => sum + g.filters.length, 0)} advanced filters`,
          );
        }}
      />
    </div>
  );
}

function CollectionList({
  organizationId,
  collections,
  viewMode,
  columns,
  selectedIds,
  onSelectItem,
  onSelectAll,
  onLoadMore,
  onReset,
}: {
  organizationId: Id<"organizations">;
  collections:
    | {
        page: Array<{
          _id: string;
          accessionNumber: string;
          title: string;
          objectType?: string;
          currentLocationId?: Id<"locations">;
          status: string;
          _creationTime: number;
        }>;
        isDone: boolean;
        continueCursor: string;
      }
    | undefined;
  viewMode: ViewMode;
  columns: ColumnConfig[];
  selectedIds: Set<Id<"collections">>;
  onSelectItem: (id: Id<"collections">, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onLoadMore: () => void;
  onReset: () => void;
}) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");

  if (collections === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (collections.page.length === 0) {
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
    collections.page.length > 0 &&
    collections.page.every((item) =>
      selectedIds.has(item._id as Id<"collections">),
    );
  const someSelected =
    collections.page.some((item) =>
      selectedIds.has(item._id as Id<"collections">),
    ) && !allSelected;

  return (
    <div className="h-full flex flex-col">
      {viewMode === "grid" ? (
        <div className="p-4 sm:p-6 overflow-y-auto">
          {collections.page.length > 0 && (
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
            items={collections.page.map((item) => ({
              _id: item._id as Id<"collections">,
              accessionNumber: item.accessionNumber,
              title: item.title,
              objectType: item.objectType,
              status: item.status,
            }))}
            organizationId={organizationId}
            selectedIds={selectedIds}
            onSelectItem={onSelectItem}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
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
              {collections.page.map((item) => (
                <CollectionTableRow
                  key={item._id}
                  item={item as CollectionListItem}
                  organizationId={organizationId}
                  columns={columns}
                  isSelected={selectedIds.has(item._id as Id<"collections">)}
                  onSelect={(selected: boolean) =>
                    onSelectItem(item._id as Id<"collections">, selected)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-3 border-t border-zinc-800/60 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <div>
          {t("pagination.showing")}{" "}
          <span className="text-zinc-300">{collections.page.length}</span>{" "}
          {t("pagination.items")}
        </div>
        <div className="flex gap-2">
          {!collections.isDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              className="h-7 text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
            >
              {t("pagination.loadMore")}
            </Button>
          )}
        </div>
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
}: {
  item: CollectionListItem;
  organizationId: Id<"organizations">;
  columns: ColumnConfig[];
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const isColumnVisible = (columnId: string) =>
    columns.find((c) => c.id === columnId)?.visible ?? true;
  const [isDeaccessionDialogOpen, setIsDeaccessionDialogOpen] = useState(false);

  const locationPath = useQuery(
    api.locations.getLocationPath,
    item.currentLocationId && organizationId
      ? { locationId: item.currentLocationId }
      : "skip",
  );

  const primaryImageUrl = useQuery(api.media.getPrimaryImageUrl, {
    collectionId: item._id,
  });

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
            {primaryImageUrl ? (
              <Image
                src={primaryImageUrl}
                alt={item.title}
                fill
                sizes="40px"
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
          {locationPath && locationPath.length > 0 ? (
            <span className="flex items-center gap-1">
              {locationPath[locationPath.length - 1]?.name}
            </span>
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
                <PermissionGate permission="collections.create">
                  <DropdownMenuItem
                    className="hover:bg-zinc-900 focus:bg-zinc-900 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDeaccessionDialogOpen(true);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Deaccession
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
