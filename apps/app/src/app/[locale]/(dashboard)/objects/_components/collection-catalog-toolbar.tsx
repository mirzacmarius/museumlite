"use client";

import { Button } from "@v1/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { ColumnConfigDropdown } from "./column-config";
import { ObjectAppliedFilters } from "./object-applied-filters";
import { ObjectFiltersDropdown } from "./object-filters-dropdown";
import type { useCollectionCatalogList } from "./use-collection-catalog-list";
import type { ViewMode } from "./view-toggle";

interface CollectionCatalogToolbarProps {
  catalog: ReturnType<typeof useCollectionCatalogList>;
}

export function CollectionCatalogToolbar({
  catalog,
}: CollectionCatalogToolbarProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const collectionGroupT = useScopedI18n("objects.collectionGroup");
  const {
    filters,
    setFilters,
    resetFilters,
    searchInput,
    setSearchInput,
    viewMode,
    columns,
    defaultColumns,
    collectionGroups,
    locations,
    objectTypeOptions,
    activeCollectionGroup,
    handleViewModeChange,
    handleColumnToggle,
    setShowAddToCollectionDialog,
  } = catalog;

  const isCollectionGroupView = Boolean(activeCollectionGroup);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "any" ||
    filters.objectType !== "" ||
    filters.displayStatus !== "" ||
    filters.locationId !== "" ||
    (!isCollectionGroupView && filters.collectionGroupId !== "");

  const secondaryFilters = {
    search: filters.search,
    status: filters.status,
    objectType: filters.objectType,
    displayStatus: filters.displayStatus,
    locationId: filters.locationId,
    collectionGroupId: isCollectionGroupView ? "" : filters.collectionGroupId,
  };

  return (
    <div className="z-20 flex flex-col border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {isCollectionGroupView
                ? collectionGroupT("viewingCollection", {
                    name: activeCollectionGroup?.name ?? "",
                  })
                : t("title")}
            </h2>
            {isCollectionGroupView ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{t("title")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setFilters({ collectionGroupId: "" })}
                >
                  <X className="mr-1 size-3" />
                  {common("viewAll")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="h-4 w-px shrink-0 bg-border" />
          <div className="relative group">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-64 rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
            />
          </div>
          <ObjectFiltersDropdown
            filters={{
              status: filters.status,
              objectType: filters.objectType,
              displayStatus: filters.displayStatus,
              locationId: filters.locationId,
              collectionGroupId: filters.collectionGroupId,
            }}
            onChange={setFilters}
            objectTypes={objectTypeOptions}
            locations={locations}
            collectionGroups={collectionGroups}
            hideCollectionGroupFilter={isCollectionGroupView}
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />

          {viewMode === "list" && (
            <ColumnConfigDropdown
              columns={columns ?? defaultColumns}
              onColumnToggle={handleColumnToggle}
            />
          )}

          {isCollectionGroupView ? (
            <PermissionGate permission="collections.update">
              <Button
                className="h-8 rounded-md border-none text-xs font-medium transition-all"
                onClick={() => setShowAddToCollectionDialog(true)}
              >
                <Plus className="size-3.5" />
                {collectionGroupT("addObjectsButton")}
              </Button>
            </PermissionGate>
          ) : (
            <PermissionGate permission="collections.create">
              <Button
                asChild
                className="h-8 rounded-md border-none text-xs font-medium transition-all"
              >
                <Link href="/objects/new" className="flex items-center gap-2">
                  <Plus className="size-3.5" />
                  {t("addObject")}
                </Link>
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="px-6 pb-4">
          <ObjectAppliedFilters
            filters={secondaryFilters}
            locations={locations}
            collectionGroups={collectionGroups}
            onChange={setFilters}
            onClearAll={resetFilters}
            hideCollectionGroupFilter={isCollectionGroupView}
          />
        </div>
      )}
    </div>
  );
}

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex rounded-md border border-border bg-muted p-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="List view"
            onClick={() => onChange("list")}
            className={`p-1.5 rounded shadow-sm transition-all ${
              viewMode === "list"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>List view</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => onChange("grid")}
            className={`p-1.5 rounded shadow-sm transition-all ${
              viewMode === "grid"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Grid view</TooltipContent>
      </Tooltip>
    </div>
  );
}
