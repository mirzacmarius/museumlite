"use client";

import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
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
  MapPin,
  MoreVertical,
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
  DEFAULT_COLUMNS,
} from "./_components/column-config";
import { ObjectGridView } from "./_components/object-grid-view";
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
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">{t("title")}</h2>
              <p className="text-sm font-normal text-primary/60">
                {t("description")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PermissionGate permission="collections.read">
                <ExportCSVButton onExport={handleExport} filename="objects" />
              </PermissionGate>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href="/objects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("addObject")}
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border/60" />
          </div>
          <CollectionFiltersAndList organizationId={currentOrganizationId} />
        </div>
      </div>
    </div>
  );
}

interface CollectionFilters {
  search: string;
  status: "active" | "deaccessioned" | "all";
  objectType: string;
  culture: string;
  period: string;
  materials: string;
  collectionGroupId: string;
  locationId: string;
  catalogedFrom: string;
  catalogedTo: string;
}

function CollectionFiltersAndList({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<CollectionFilters>({
    search: "",
    status: "all",
    objectType: "",
    culture: "",
    period: "",
    materials: "",
    collectionGroupId: "",
    locationId: "",
    catalogedFrom: "",
    catalogedTo: "",
  });

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
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

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
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            visible: parsed[col.id] ?? col.visible,
          })),
        );
      } catch {
        // Invalid JSON in preferences - use default columns
      }
    }
  }, [savedColumns]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setViewPreference({
      key: "objects.viewMode",
      value: mode,
      organizationId,
    });
  };

  const handleColumnToggle = (columnId: string, visible: boolean) => {
    const newColumns = columns.map((col) =>
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

  const hasActiveFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.objectType ||
    filters.culture ||
    filters.period ||
    filters.materials ||
    filters.collectionGroupId ||
    filters.locationId ||
    filters.catalogedFrom ||
    filters.catalogedTo;

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      objectType: "",
      culture: "",
      period: "",
      materials: "",
      collectionGroupId: "",
      locationId: "",
      catalogedFrom: "",
      catalogedTo: "",
    });
  };

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

  const handleExport = () => {
    if (!bulkExport || bulkExport.length === 0) {
      toast.error(t("form.toasts.noDataToExport"));
      return;
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

    const rows = bulkExport.map((item) => [
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
      `Exported ${bulkExport.length} item${bulkExport.length !== 1 ? "s" : ""}`,
    );
  };

  const handleBulkSuccess = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col">
      {/* Search and Filter Bar */}
      <div className="border-b border-border/60 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="pl-9"
              />
            </div>
            <ViewToggle value={viewMode} onChange={handleViewModeChange} />
            {viewMode === "list" && (
              <ColumnConfigDropdown
                columns={columns}
                onColumnToggle={handleColumnToggle}
              />
            )}
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      status: value as CollectionFilters["status"],
                    })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder={t("filters.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Active</SelectItem>
                    <SelectItem value="deaccessioned">Deaccessioned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objectType">Object Type</Label>
                <Select
                  value={filters.objectType || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      objectType: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="objectType">
                    <SelectValue placeholder={t("filters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueObjectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="culture">Culture</Label>
                <Input
                  id="culture"
                  placeholder={t("filters.filterByCulture")}
                  value={filters.culture}
                  onChange={(e) =>
                    setFilters({ ...filters, culture: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Input
                  id="period"
                  placeholder={t("filters.filterByPeriod")}
                  value={filters.period}
                  onChange={(e) =>
                    setFilters({ ...filters, period: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materials">Materials</Label>
                <Input
                  id="materials"
                  placeholder={t("filters.filterByMaterials")}
                  value={filters.materials}
                  onChange={(e) =>
                    setFilters({ ...filters, materials: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="collectionGroup">Collection Group</Label>
                <Select
                  value={filters.collectionGroupId || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      collectionGroupId: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="collectionGroup">
                    <SelectValue placeholder={t("filters.allGroups")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {collectionGroups?.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select
                  value={filters.locationId || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      locationId: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder={t("filters.allLocations")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations?.map((location) => (
                      <SelectItem key={location._id} value={location._id}>
                        {location.path.map((p) => p.name).join(" > ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalogedFrom">Date Acquired From</Label>
                <Input
                  id="catalogedFrom"
                  type="date"
                  value={filters.catalogedFrom}
                  onChange={(e) =>
                    setFilters({ ...filters, catalogedFrom: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalogedTo">Date Acquired To</Label>
                <Input
                  id="catalogedTo"
                  type="date"
                  value={filters.catalogedTo}
                  onChange={(e) =>
                    setFilters({ ...filters, catalogedTo: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collection List/Grid */}
      <CollectionList
        organizationId={organizationId}
        collections={collections}
        viewMode={viewMode}
        columns={columns}
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

      {/* Bulk Actions */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        onAddToGroup={() => setShowAddToGroupDialog(true)}
        onMoveLocation={() => setShowMoveLocationDialog(true)}
        onExport={handleExport}
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
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {t("emptyState.noObjectsFound")}
        </p>
        <PermissionGate permission="collections.create">
          <Button asChild>
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
    <div className="p-6">
      {collections.page.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            checked={allSelected || (someSelected ? "indeterminate" : false)}
            onCheckedChange={(checked) => onSelectAll(checked === true)}
            aria-label="Select all items"
          />
          <span className="text-sm text-muted-foreground">
            {allSelected
              ? "All selected"
              : someSelected
                ? `${selectedIds.size} selected`
                : "Select all"}
          </span>
        </div>
      )}
      {viewMode === "grid" ? (
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
      ) : (
        <div className="space-y-4">
          {collections.page.map((item) => (
            <CollectionListItem
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
        </div>
      )}
      {!collections.isDone && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>
            {t("pagination.loadMore")}
          </Button>
        </div>
      )}
      {collections.page.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Showing {collections.page.length}{" "}
          {collections.isDone
            ? t("pagination.items")
            : t("pagination.itemsMore")}
        </div>
      )}
    </div>
  );
}

type CollectionListItem = FunctionReturnType<
  typeof api.collections.list
>["page"][number];

function CollectionListItem({
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

  return (
    <>
      <div
        className={`group relative flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent ${
          isSelected
            ? "border-primary ring-2 ring-primary/20"
            : "border-border/60"
        }`}
      >
        {isColumnVisible("checkbox") && (
          <div className="flex-shrink-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <Link
          href={`/objects/${item._id}`}
          className="flex flex-1 items-center gap-4 min-w-0 pr-2"
        >
          {isColumnVisible("image") && (
            <div className="relative flex h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
              {primaryImageUrl ? (
                <Image
                  src={primaryImageUrl}
                  alt={item.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{item.title}</h3>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                {isColumnVisible("accessionNumber") && (
                  <span>{item.accessionNumber}</span>
                )}
                {isColumnVisible("location") &&
                  locationPath &&
                  locationPath.length > 0 && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {locationPath
                        .map(
                          (loc: {
                            _id: Id<"locations">;
                            name: string;
                            type: string;
                          }) => loc.name,
                        )
                        .join(" → ")}
                    </span>
                  )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              {isColumnVisible("objectType") && (
                <div className="flex flex-wrap justify-end gap-1 mb-1">
                  {(() => {
                    try {
                      const types = item.objectType
                        ? JSON.parse(item.objectType)
                        : [];
                      return Array.isArray(types) && types.length > 0 ? (
                        types.map((type: string) => (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
                          >
                            {type}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      );
                    } catch {
                      return (
                        <span className="text-sm text-muted-foreground">—</span>
                      );
                    }
                  })()}
                </div>
              )}
              {isColumnVisible("status") &&
                (item.status === "deaccessioned" ? (
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                    <Archive className="mr-1 h-3 w-3" />
                    Deaccessioned
                  </span>
                ) : (
                  <p className="text-xs text-muted-foreground capitalize">
                    {item.status}
                  </p>
                ))}
            </div>
          </div>
        </Link>

        {/* Quick Actions Dropdown - MUS-95 */}
        {canDeaccession && (
          <div className="flex-shrink-0 ml-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Quick actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <PermissionGate permission="collections.create">
                  <DropdownMenuItem
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
          </div>
        )}
      </div>

      {/* Deaccession Dialog */}
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
