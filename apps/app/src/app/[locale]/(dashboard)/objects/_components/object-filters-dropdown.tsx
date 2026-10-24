"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Switch } from "@v1/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { Filter, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { Fragment, useId, useState } from "react";
import type {
  ObjectDisplayStatus,
  ObjectPhotographFilter,
  ObjectStatus,
} from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import { CatalogFilterSelect } from "./catalog-filter-select";
import type { ColumnConfig } from "./column-config";
import { LocationTreeFilter } from "./location-tree-filter";
import { madeYearBound } from "./use-collection-catalog-list";
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
  /** Years as written: "1850", or "-500" for 500 BC. */
  madeFrom: string;
  madeTo: string;
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
      filters.madeFrom,
      filters.madeTo,
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
          <ViewModePicker viewMode={viewMode} onChange={onViewModeChange} />
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
            <FacetFilters
              filters={filters}
              facets={facets}
              onChange={onChange}
            />
            <MadeRangeFilter
              madeFrom={filters.madeFrom}
              madeTo={filters.madeTo}
              onChange={onChange}
            />
            <CatalogedRangeFilter
              from={filters.catalogedFrom}
              to={filters.catalogedTo}
              onChange={onChange}
            />
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
            <VisibleColumnsPicker columns={columns} onToggle={onColumnToggle} />
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
                madeFrom: "",
                madeTo: "",
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

function ViewModePicker({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  return (
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
          onClick={() => onChange(value)}
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
  );
}

/** The recorded-value facets and the photograph filter. */
function FacetFilters({
  filters,
  facets,
  onChange,
}: {
  filters: ObjectFiltersDropdownValue;
  facets: ObjectFacetValues | undefined;
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
}) {
  const t = useScopedI18n("objects");
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
  return (
    <>
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
    </>
  );
}

type MadeEra = "ad" | "bc";

interface MadeYearDraft {
  year: string;
  era: MadeEra;
}

interface MadeRangeDraft {
  from: MadeYearDraft;
  to: MadeYearDraft;
  /** The range in the URL when it was last edited. */
  base: { madeFrom: string; madeTo: string };
}

/** A year from the URL as its year and era inputs show it. */
function madeYearDraft(value: string): MadeYearDraft {
  return value.startsWith("-")
    ? { year: value.slice(1), era: "bc" }
    : { year: value, era: "ad" };
}

/**
 * The URL value for a year as entered: "" when left empty, null unless it is
 * a whole year from 1 to 9999.
 */
function madeYearValue({ year, era }: MadeYearDraft) {
  const text = year.trim();
  if (!text) return "";
  if (!/^\d{1,4}$/.test(text) || Number(text) < 1) return null;
  return `${era === "bc" ? "-" : ""}${Number(text)}`;
}

/** Why a range as entered is not applied, if it is not. */
function madeRangeProblem(madeFrom: string | null, madeTo: string | null) {
  if (madeFrom === null || madeTo === null) return "year";
  const from = madeYearBound(madeFrom);
  const to = madeYearBound(madeTo);
  return from !== undefined && to !== undefined && from > to
    ? "order"
    : undefined;
}

/**
 * When objects were made, as an inclusive range of years either side of
 * 1 AD. A range applies once both years are valid and in order.
 */
function MadeRangeFilter({
  madeFrom,
  madeTo,
  onChange,
}: {
  madeFrom: string;
  madeTo: string;
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
}) {
  const t = useScopedI18n("objects");
  const id = useId();
  const [edited, setEdited] = useState<MadeRangeDraft | null>(null);
  // An edit stands while the URL holds the range it last applied; Clear all
  // starts again from the URL.
  const draft: MadeRangeDraft =
    edited?.base.madeFrom === madeFrom && edited.base.madeTo === madeTo
      ? edited
      : {
          from: madeYearDraft(madeFrom),
          to: madeYearDraft(madeTo),
          base: { madeFrom, madeTo },
        };
  const values = {
    from: madeYearValue(draft.from),
    to: madeYearValue(draft.to),
  };
  const problem = madeRangeProblem(values.from, values.to);
  const errorId = `${id}-error`;

  const update = (side: "from" | "to", change: Partial<MadeYearDraft>) => {
    const next: MadeRangeDraft = {
      ...draft,
      [side]: { ...draft[side], ...change },
    };
    const nextFrom = madeYearValue(next.from);
    const nextTo = madeYearValue(next.to);
    if (
      nextFrom !== null &&
      nextTo !== null &&
      !madeRangeProblem(nextFrom, nextTo)
    ) {
      next.base = { madeFrom: nextFrom, madeTo: nextTo };
      if (nextFrom !== madeFrom || nextTo !== madeTo) {
        onChange({ madeFrom: nextFrom, madeTo: nextTo });
      }
    }
    setEdited(next);
  };

  const rows = [
    { side: "from", label: t("filters.madeFrom") },
    { side: "to", label: t("filters.madeTo") },
  ] as const;

  return (
    <fieldset className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-2">
      <legend className="sr-only">{t("filters.madeRange")}</legend>
      <span id={`${id}-era`} hidden>
        {t("filters.era")}
      </span>
      {rows.map(({ side, label }) => {
        const invalid = values[side] === null || problem === "order";
        return (
          <Fragment key={side}>
            <label
              id={`${id}-${side}-label`}
              htmlFor={`${id}-${side}`}
              className="text-xs text-muted-foreground"
            >
              {label}
            </label>
            <div className="flex min-w-0 gap-1">
              <Input
                id={`${id}-${side}`}
                inputMode="numeric"
                autoComplete="off"
                value={draft[side].year}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? errorId : undefined}
                onChange={(event) => update(side, { year: event.target.value })}
                className="h-7 min-w-0 px-2 text-xs"
              />
              <select
                aria-labelledby={`${id}-${side}-label ${id}-era`}
                value={draft[side].era}
                onChange={(event) =>
                  update(side, {
                    era: event.target.value === "bc" ? "bc" : "ad",
                  })
                }
                className="h-7 shrink-0 rounded-lg border border-input bg-background px-1.5 text-xs dark:border-border"
              >
                <option value="ad">{t("filters.eraAd")}</option>
                <option value="bc">{t("filters.eraBc")}</option>
              </select>
            </div>
          </Fragment>
        );
      })}
      {problem ? (
        <p id={errorId} className="col-span-2 text-xs text-destructive">
          {problem === "order"
            ? t("filters.madeRangeReversed")
            : t("filters.madeYearInvalid")}
        </p>
      ) : null}
    </fieldset>
  );
}

/** When objects were cataloged, as an inclusive date range. */
function CatalogedRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
}) {
  const t = useScopedI18n("objects");
  const fromId = useId();
  const toId = useId();
  return (
    <fieldset className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-2">
      <legend className="sr-only">{t("filters.catalogedRange")}</legend>
      <label htmlFor={fromId} className="text-xs text-muted-foreground">
        {t("filters.catalogedFrom")}
      </label>
      <Input
        id={fromId}
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => onChange({ catalogedFrom: event.target.value })}
        className="h-7 px-2 text-xs"
      />
      <label htmlFor={toId} className="text-xs text-muted-foreground">
        {t("filters.catalogedTo")}
      </label>
      <Input
        id={toId}
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => onChange({ catalogedTo: event.target.value })}
        className="h-7 px-2 text-xs"
      />
    </fieldset>
  );
}

function VisibleColumnsPicker({
  columns,
  onToggle,
}: {
  columns: ColumnConfig[];
  onToggle: (columnId: string, visible: boolean) => void;
}) {
  const t = useScopedI18n("objects");
  return (
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
              onClick={() => onToggle(column.id, !column.visible)}
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
  );
}
