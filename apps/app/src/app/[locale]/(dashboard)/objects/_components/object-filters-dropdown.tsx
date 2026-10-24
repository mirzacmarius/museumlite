"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Switch } from "@v1/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { Filter, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import type {
  ObjectDisplayStatus,
  ObjectPhotographFilter,
  ObjectStatus,
} from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import { CatalogFilterSelect } from "./catalog-filter-select";
import type { ColumnConfig } from "./column-config";
import { LocationTreeFilter } from "./location-tree-filter";
import type { ViewMode } from "./view-toggle";

interface LocationPathItem {
  _id?: Id<"locations">;
  name: string;
}

interface LocationOption {
  _id: Id<"locations">;
  name?: string;
  path: LocationPathItem[];
}

interface CollectionGroupOption {
  _id: Id<"collectionGroups">;
  name: string;
}

export interface ObjectFiltersDropdownValue {
  status: ObjectStatus;
  objectType: string;
  displayStatus: ObjectDisplayStatus;
  locationIds: string[];
  collectionGroupId: string;
  culture: string;
  period: string;
  materials: string;
  condition: string;
  photograph: ObjectPhotographFilter;
  catalogedFrom: string;
  catalogedTo: string;
}

interface FacetValue {
  value: string;
  label: string;
}

/** Values recorded on objects, for the facet filters. */
export interface ObjectFacetValues {
  cultures: FacetValue[];
  periods: FacetValue[];
  conditions: FacetValue[];
  materials: FacetValue[];
}

/**
 * A facet's options: any value, then each recorded value as staff spelled it.
 * A value from the URL that no record holds any more stays selectable.
 */
function facetOptions(
  anyLabel: string,
  facets: FacetValue[] | undefined,
  current: string,
) {
  const options = (facets ?? []).map((facet) => ({
    value: facet.label,
    label: facet.label,
  }));
  const folded = current.trim().toLowerCase();
  if (
    current &&
    !options.some((option) => option.value.toLowerCase() === folded)
  ) {
    options.push({ value: current, label: current });
  }
  const selected = options.find(
    (option) => option.value.toLowerCase() === folded,
  );
  return {
    value: selected?.value ?? "",
    options: [{ value: "", label: anyLabel }, ...options],
  };
}

interface ObjectFiltersDropdownProps {
  filters: ObjectFiltersDropdownValue;
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
  objectTypes: string[];
  facets?: ObjectFacetValues;
  locations?: LocationOption[];
  collectionGroups?: CollectionGroupOption[];
  hideCollectionGroupFilter?: boolean;
  /** Conditions in the advanced search; opens its dialog. */
  advancedConditionCount: number;
  onOpenAdvancedSearch: () => void;
  onClearAdvancedSearch: () => void;
  className?: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  columns: ColumnConfig[];
  onColumnToggle: (columnId: string, visible: boolean) => void;
}

function statusLabel(
  t: ReturnType<typeof useScopedI18n>,
  status: ObjectStatus,
) {
  switch (status) {
    case "any":
      return t("filters.anyStatus");
    case "all":
      return t("filters.allStatuses");
    case "active":
      return t("filters.active");
    case "deaccessioned":
      return t("filters.deaccessioned");
    case "loaned":
      return t("filters.loaned");
    case "archived":
      return t("filters.archived");
    case "deleted":
      return t("filters.deleted");
  }
}

function displayStatusLabel(
  t: ReturnType<typeof useScopedI18n>,
  displayStatus: ObjectDisplayStatus,
) {
  switch (displayStatus) {
    case "":
      return t("filters.anyDisplayStatus");
    case "on_display":
      return t("filters.onDisplay");
    case "not_on_display":
      return t("filters.notOnDisplay");
  }

  const exhaustiveDisplayStatus: never = displayStatus;
  return exhaustiveDisplayStatus;
}

export function ObjectFiltersDropdown({
  filters,
  onChange,
  objectTypes,
  facets,
  locations,
  collectionGroups,
  hideCollectionGroupFilter = false,
  advancedConditionCount,
  onOpenAdvancedSearch,
  onClearAdvancedSearch,
  className,
  viewMode,
  onViewModeChange,
  columns,
  onColumnToggle,
}: ObjectFiltersDropdownProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const displaySwitchId = useId();
  const catalogedFromId = useId();
  const catalogedToId = useId();
  const culture = facetOptions(
    t("filters.anyCulture"),
    facets?.cultures,
    filters.culture,
  );
  const period = facetOptions(
    t("filters.anyPeriod"),
    facets?.periods,
    filters.period,
  );
  const materials = facetOptions(
    t("filters.anyMaterial"),
    facets?.materials,
    filters.materials,
  );
  const condition = facetOptions(
    t("filters.anyCondition"),
    facets?.conditions,
    filters.condition,
  );
  const photographOptions: { value: ObjectPhotographFilter; label: string }[] =
    [
      { value: "", label: t("filters.anyPhotograph") },
      { value: "with", label: t("filters.withPhotograph") },
      { value: "without", label: t("filters.withoutPhotograph") },
    ];
  const statusOptions: { value: ObjectStatus; label: string }[] = [
    { value: "any", label: statusLabel(t, "any") },
    { value: "all", label: statusLabel(t, "all") },
    { value: "active", label: statusLabel(t, "active") },
    { value: "loaned", label: statusLabel(t, "loaned") },
    { value: "archived", label: statusLabel(t, "archived") },
    { value: "deleted", label: statusLabel(t, "deleted") },
  ];
  const activeFilterCount =
    (filters.status !== "any" ? 1 : 0) +
    (filters.objectType !== "" ? 1 : 0) +
    (filters.displayStatus !== "" ? 1 : 0) +
    (filters.locationIds.length > 0 ? 1 : 0) +
    (!hideCollectionGroupFilter && filters.collectionGroupId !== "" ? 1 : 0) +
    [
      filters.culture,
      filters.period,
      filters.materials,
      filters.condition,
      filters.photograph,
      filters.catalogedFrom,
      filters.catalogedTo,
    ].filter((value) => value !== "").length +
    (advancedConditionCount > 0 ? 1 : 0);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("filters.title")}
              className={cn(
                "relative rounded-md border border-border px-3 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                className,
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-indigo-500 ring-2 ring-background"
                />
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="border border-border bg-popover text-popover-foreground"
        >
          {t("filters.title")}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={4}
        collisionPadding={12}
        aria-label={t("filters.title")}
        className="flex max-h-[var(--available-height)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0"
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <fieldset
            className="grid grid-cols-2 gap-2 px-4 py-3"
            aria-label={t("title")}
          >
            {(
              [
                { value: "list", label: common("listView"), icon: List },
                { value: "grid", label: common("gridView"), icon: LayoutGrid },
              ] satisfies {
                value: ViewMode;
                label: string;
                icon: typeof List;
              }[]
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={viewMode === value}
                onClick={() => onViewModeChange(value)}
                className={cn(
                  "flex h-7 items-center justify-center gap-2 rounded-md border px-2 py-1 text-xs font-medium shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                  viewMode === value
                    ? "border-border bg-accent text-foreground dark:border-white/20 dark:bg-white/15"
                    : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/5",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </fieldset>
          <div className="space-y-2 px-4 pb-3">
            <CatalogFilterSelect
              label={t("filters.status")}
              value={filters.status}
              options={statusOptions}
              onChange={(status) => onChange({ status })}
            />
            <CatalogFilterSelect
              label={t("filters.objectType")}
              value={filters.objectType}
              options={[
                { value: "", label: t("filters.allTypes") },
                ...objectTypes
                  .toSorted((a, b) => a.localeCompare(b))
                  .map((type) => ({ value: type, label: type })),
              ]}
              onChange={(objectType) => onChange({ objectType })}
            />
            <LocationTreeFilter
              label={t("filters.location")}
              value={filters.locationIds}
              locations={locations ?? []}
              onChange={(locationIds) => onChange({ locationIds })}
            />
            {!hideCollectionGroupFilter ? (
              <CatalogFilterSelect
                label={t("filters.collectionGroup")}
                value={filters.collectionGroupId}
                options={[
                  { value: "", label: t("filters.allGroups") },
                  ...(collectionGroups ?? []).map((group) => ({
                    value: group._id,
                    label: group.name,
                  })),
                ]}
                onChange={(collectionGroupId) =>
                  onChange({ collectionGroupId })
                }
              />
            ) : null}
            <CatalogFilterSelect
              label={t("filters.materials")}
              value={materials.value}
              options={materials.options}
              onChange={(value) => onChange({ materials: value })}
            />
            <CatalogFilterSelect
              label={t("filters.culture")}
              value={culture.value}
              options={culture.options}
              onChange={(value) => onChange({ culture: value })}
            />
            <CatalogFilterSelect
              label={t("filters.period")}
              value={period.value}
              options={period.options}
              onChange={(value) => onChange({ period: value })}
            />
            <CatalogFilterSelect
              label={t("filters.condition")}
              value={condition.value}
              options={condition.options}
              onChange={(value) => onChange({ condition: value })}
            />
            <CatalogFilterSelect
              label={t("filters.photograph")}
              value={filters.photograph}
              options={photographOptions}
              onChange={(photograph) => onChange({ photograph })}
            />
            <fieldset className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-2">
              <legend className="sr-only">{t("filters.catalogedRange")}</legend>
              <label
                htmlFor={catalogedFromId}
                className="text-xs text-muted-foreground"
              >
                {t("filters.catalogedFrom")}
              </label>
              <Input
                id={catalogedFromId}
                type="date"
                value={filters.catalogedFrom}
                max={filters.catalogedTo || undefined}
                onChange={(event) =>
                  onChange({ catalogedFrom: event.target.value })
                }
                className="h-7 px-2 text-xs"
              />
              <label
                htmlFor={catalogedToId}
                className="text-xs text-muted-foreground"
              >
                {t("filters.catalogedTo")}
              </label>
              <Input
                id={catalogedToId}
                type="date"
                value={filters.catalogedTo}
                min={filters.catalogedFrom || undefined}
                onChange={(event) =>
                  onChange({ catalogedTo: event.target.value })
                }
                className="h-7 px-2 text-xs"
              />
            </fieldset>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAdvancedSearch}
              className="h-7 w-full justify-start gap-2 text-xs"
            >
              <Filter className="size-3.5" aria-hidden="true" />
              {advancedConditionCount > 0
                ? t("filters.advancedSearchActive", {
                    count: advancedConditionCount,
                  })
                : t("filters.advancedSearch")}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-2 dark:border-white/10">
            <label
              htmlFor={displaySwitchId}
              className="cursor-pointer text-xs text-muted-foreground"
            >
              {displayStatusLabel(t, "on_display")}
            </label>
            <Switch
              id={displaySwitchId}
              checked={filters.displayStatus === "on_display"}
              onCheckedChange={(checked) =>
                onChange({ displayStatus: checked ? "on_display" : "" })
              }
              className="data-[state=checked]:bg-indigo-500"
            />
          </div>
          {viewMode === "list" ? (
            <div className="border-t border-border/60 px-4 py-2 dark:border-white/10">
              <p className="mb-2 text-xs text-muted-foreground">
                {t("columnConfig.visibleColumns")}
              </p>
              <fieldset
                className="flex flex-wrap gap-2"
                aria-label={t("columnConfig.visibleColumns")}
              >
                {columns.map((column) =>
                  column.id === "checkbox" ? null : (
                    <button
                      key={column.id}
                      type="button"
                      aria-pressed={column.visible}
                      disabled={column.required}
                      onClick={() => onColumnToggle(column.id, !column.visible)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default",
                        column.visible
                          ? "border-border bg-accent text-foreground dark:border-white/10 dark:bg-white/15"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/5",
                      )}
                    >
                      {column.label}
                    </button>
                  ),
                )}
              </fieldset>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border/60 px-4 py-2 dark:border-white/10">
          <Button
            variant="ghost"
            size="sm"
            disabled={activeFilterCount === 0}
            onClick={() => {
              onClearAdvancedSearch();
              onChange({
                status: "any",
                objectType: "",
                displayStatus: "",
                locationIds: [],
                culture: "",
                period: "",
                materials: "",
                condition: "",
                photograph: "",
                catalogedFrom: "",
                catalogedTo: "",
                ...(!hideCollectionGroupFilter
                  ? { collectionGroupId: "" }
                  : {}),
              });
            }}
            className="h-7 rounded-md text-xs text-muted-foreground hover:text-foreground"
          >
            {common("clearAll")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
