"use client";

import { Button } from "@v1/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { ArrowUpDown, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { AdvancedSearchDialog } from "@/components/advanced-search-dialog";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import {
  advancedConditionCount,
  ObjectAppliedFilters,
} from "./object-applied-filters";
import { ObjectFiltersDropdown } from "./object-filters-dropdown";
import {
  OBJECT_SORTS,
  type useCollectionCatalogList,
} from "./use-collection-catalog-list";

interface CollectionCatalogToolbarProps {
  catalog: ReturnType<typeof useCollectionCatalogList>;
}

export function CollectionCatalogToolbar({
  catalog,
}: CollectionCatalogToolbarProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const collectionGroupT = useScopedI18n("objects.collectionGroup");
  const tList = useScopedI18n("listState");
  const {
    sort,
    setSort,
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
    facetValues,
    isSearching,
    activeCollectionGroup,
    handleViewModeChange,
    handleColumnToggle,
    setShowAddToCollectionDialog,
  } = catalog;

  const isCollectionGroupView = Boolean(activeCollectionGroup);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isAdvancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const advancedCount = advancedConditionCount(filters.advancedFilters);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "any" ||
    filters.objectType !== "" ||
    filters.displayStatus !== "" ||
    filters.locationIds.length > 0 ||
    (!isCollectionGroupView && filters.collectionGroupId !== "") ||
    filters.culture !== "" ||
    filters.period !== "" ||
    filters.materials !== "" ||
    filters.condition !== "" ||
    filters.photograph !== "" ||
    filters.catalogedFrom !== "" ||
    filters.catalogedTo !== "" ||
    filters.madeFrom !== "" ||
    filters.madeTo !== "" ||
    advancedCount > 0;

  const facetFilters = {
    culture: filters.culture,
    period: filters.period,
    materials: filters.materials,
    condition: filters.condition,
    photograph: filters.photograph,
    catalogedFrom: filters.catalogedFrom,
    catalogedTo: filters.catalogedTo,
    madeFrom: filters.madeFrom,
    madeTo: filters.madeTo,
  };

  const secondaryFilters = {
    search: filters.search,
    status: filters.status,
    objectType: filters.objectType,
    displayStatus: filters.displayStatus,
    locationIds: filters.locationIds,
    collectionGroupId: isCollectionGroupView ? "" : filters.collectionGroupId,
    ...facetFilters,
    advancedFilters: filters.advancedFilters,
  };

  return (
    <div className="z-20 flex flex-col border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
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
          <div className="group relative min-w-0">
            <Search
              aria-hidden="true"
              className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground"
            />
            <input
              ref={searchInputRef}
              type="text"
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-48 max-w-full rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isSearching ? (
            // A search ranks its results; the chosen order returns after it.
            <span
              title={t("search.rankedByRelevance")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-xs text-muted-foreground"
            >
              <ArrowUpDown className="size-3.5" aria-hidden="true" />
              {t("search.relevance")}
            </span>
          ) : (
            <Select
              value={sort}
              onValueChange={(value) => {
                const next = OBJECT_SORTS.find((option) => option === value);
                if (next) setSort(next);
              }}
            >
              <SelectTrigger
                aria-label={tList("sort.label")}
                className="h-8 w-auto gap-1.5 text-xs"
              >
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECT_SORTS.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {tList(`sort.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ObjectFiltersDropdown
            filters={{
              status: filters.status,
              objectType: filters.objectType,
              displayStatus: filters.displayStatus,
              locationIds: filters.locationIds,
              collectionGroupId: filters.collectionGroupId,
              ...facetFilters,
            }}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            columns={columns ?? defaultColumns}
            onColumnToggle={handleColumnToggle}
            onChange={setFilters}
            objectTypes={objectTypeOptions}
            facets={facetValues}
            locations={locations}
            collectionGroups={collectionGroups}
            hideCollectionGroupFilter={isCollectionGroupView}
            advancedConditionCount={advancedCount}
            onOpenAdvancedSearch={() => setAdvancedSearchOpen(true)}
            onClearAdvancedSearch={() => setFilters({ advancedFilters: [] })}
          />

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

      {isAdvancedSearchOpen ? (
        <AdvancedSearchDialog
          open
          onOpenChange={setAdvancedSearchOpen}
          initialFilterGroups={filters.advancedFilters}
          initialGroupOperator={filters.filterCombinations}
          onApply={(advancedFilters, filterCombinations) =>
            setFilters({ advancedFilters, filterCombinations })
          }
        />
      ) : null}

      {hasActiveFilters && (
        <div className="px-6 pb-4">
          <ObjectAppliedFilters
            filters={secondaryFilters}
            locations={locations}
            collectionGroups={collectionGroups}
            onChange={setFilters}
            onClearAll={resetFilters}
            returnFocusRef={searchInputRef}
            hideCollectionGroupFilter={isCollectionGroupView}
          />
        </div>
      )}
    </div>
  );
}
