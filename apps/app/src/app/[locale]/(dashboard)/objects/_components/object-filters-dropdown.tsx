"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Switch } from "@v1/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import type {
  ObjectDisplayStatus,
  ObjectStatus,
} from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import { CatalogFilterSelect } from "./catalog-filter-select";
import type { ColumnConfig } from "./column-config";
import type { ViewMode } from "./view-toggle";

interface LocationPathItem {
  name: string;
}

interface LocationOption {
  _id: Id<"locations">;
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
  locationId: string;
  collectionGroupId: string;
}

interface ObjectFiltersDropdownProps {
  filters: ObjectFiltersDropdownValue;
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
  objectTypes: string[];
  locations?: LocationOption[];
  collectionGroups?: CollectionGroupOption[];
  hideCollectionGroupFilter?: boolean;
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
  }

  const exhaustiveDisplayStatus: never = displayStatus;
  return exhaustiveDisplayStatus;
}

export function ObjectFiltersDropdown({
  filters,
  onChange,
  objectTypes,
  locations,
  collectionGroups,
  hideCollectionGroupFilter = false,
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
    (filters.locationId !== "" ? 1 : 0) +
    (!hideCollectionGroupFilter && filters.collectionGroupId !== "" ? 1 : 0);

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
        className="flex max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0"
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
                  .map((type) => ({
                    value: type,
                    label: type,
                  })),
              ]}
              onChange={(objectType) => onChange({ objectType })}
            />
            <CatalogFilterSelect
              label={t("filters.location")}
              value={filters.locationId}
              options={[
                { value: "", label: t("filters.allLocations") },
                ...(locations ?? []).map((location) => ({
                  value: location._id,
                  label: location.path.map((part) => part.name).join(" > "),
                })),
              ]}
              onChange={(locationId) => onChange({ locationId })}
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
                {columns
                  .filter((column) => column.id !== "checkbox")
                  .map((column) => (
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
                  ))}
              </fieldset>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border/60 px-4 py-2 dark:border-white/10">
          <Button
            variant="ghost"
            size="sm"
            disabled={activeFilterCount === 0}
            onClick={() =>
              onChange({
                status: "any",
                objectType: "",
                displayStatus: "",
                locationId: "",
                ...(!hideCollectionGroupFilter
                  ? { collectionGroupId: "" }
                  : {}),
              })
            }
            className="h-7 rounded-md text-xs text-muted-foreground hover:text-foreground"
          >
            {common("clearAll")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
