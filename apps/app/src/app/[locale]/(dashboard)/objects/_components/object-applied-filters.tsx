"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { AppliedFilterChip, AppliedFiltersBar } from "@v1/ui/filters-dropdown";
import { type RefObject, useMemo } from "react";
import type {
  FilterGroup,
  ObjectDisplayStatus,
  ObjectPhotographFilter,
  ObjectStatus,
} from "@/hooks/use-url-filters";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

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

export interface ObjectAppliedFiltersValue {
  search: string;
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
  advancedFilters: FilterGroup[];
}

/** Conditions the advanced search applies. */
export function advancedConditionCount(groups: FilterGroup[]) {
  return groups.reduce((count, group) => count + group.filters.length, 0);
}

/** A date input's value (YYYY-MM-DD) in the app language. */
function dateLabel(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return formatDate(new Date(year, month - 1, day), locale, {
    dateStyle: "medium",
  });
}

interface ObjectAppliedFiltersProps {
  filters: ObjectAppliedFiltersValue;
  locations?: LocationOption[];
  collectionGroups?: CollectionGroupOption[];
  onChange: (filters: Partial<ObjectAppliedFiltersValue>) => void;
  onClearAll: () => void;
  /** Takes focus when the last filter is removed. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  hideCollectionGroupFilter?: boolean;
  className?: string;
}

function statusLabel(
  t: ReturnType<typeof useScopedI18n>,
  status: ObjectStatus,
) {
  switch (status) {
    case "any":
      return "";
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
      return "";
    case "on_display":
      return t("filters.onDisplay");
    case "not_on_display":
      return t("filters.notOnDisplay");
  }

  const exhaustiveDisplayStatus: never = displayStatus;
  return exhaustiveDisplayStatus;
}

export function ObjectAppliedFilters({
  filters,
  locations,
  collectionGroups,
  onChange,
  onClearAll,
  returnFocusRef,
  hideCollectionGroupFilter = false,
  className,
}: ObjectAppliedFiltersProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const locale = useCurrentLocale();
  const advancedCount = advancedConditionCount(filters.advancedFilters);
  const catalogedFrom = filters.catalogedFrom
    ? dateLabel(filters.catalogedFrom, locale)
    : "";
  const catalogedTo = filters.catalogedTo
    ? dateLabel(filters.catalogedTo, locale)
    : "";
  const facetChips = [
    { key: "materials", label: t("filters.materials") },
    { key: "culture", label: t("filters.culture") },
    { key: "period", label: t("filters.period") },
    { key: "condition", label: t("filters.condition") },
  ] as const;

  const locationLabels = useMemo(() => {
    if (filters.locationIds.length === 0) return [];
    return filters.locationIds.map((locationId) => {
      const match = locations?.find((location) => location._id === locationId);
      if (!match) return locationId;
      return (
        match.path[match.path.length - 1]?.name ??
        match.path.map((part) => part.name).join(" > ")
      );
    });
  }, [filters.locationIds, locations]);

  const groupLabel = useMemo(() => {
    if (!filters.collectionGroupId) return null;
    const match = collectionGroups?.find(
      (g) => g._id === filters.collectionGroupId,
    );
    return match?.name ?? null;
  }, [collectionGroups, filters.collectionGroupId]);

  const showBar =
    filters.search !== "" ||
    filters.status !== "any" ||
    filters.objectType !== "" ||
    filters.displayStatus !== "" ||
    filters.locationIds.length > 0 ||
    (!hideCollectionGroupFilter && filters.collectionGroupId !== "") ||
    facetChips.some(({ key }) => filters[key] !== "") ||
    filters.photograph !== "" ||
    filters.catalogedFrom !== "" ||
    filters.catalogedTo !== "" ||
    advancedCount > 0;

  if (!showBar) return null;

  return (
    <AppliedFiltersBar
      className={className}
      onClearAll={onClearAll}
      returnFocusRef={returnFocusRef}
    >
      {filters.search !== "" && (
        <AppliedFilterChip
          label={common("search")}
          value={filters.search}
          onRemove={() => onChange({ search: "" })}
        />
      )}

      {filters.status !== "any" && (
        <AppliedFilterChip
          label={t("filters.status")}
          value={statusLabel(t, filters.status)}
          onRemove={() => onChange({ status: "any" })}
        />
      )}

      {filters.objectType !== "" && (
        <AppliedFilterChip
          label={t("filters.objectType")}
          value={filters.objectType}
          onRemove={() => onChange({ objectType: "" })}
        />
      )}

      {filters.displayStatus !== "" && (
        <AppliedFilterChip
          label={t("filters.displayStatus")}
          value={displayStatusLabel(t, filters.displayStatus)}
          onRemove={() => onChange({ displayStatus: "" })}
        />
      )}

      {locationLabels.map((label, index) => {
        const locationId = filters.locationIds[index];
        if (!locationId) return null;
        return (
          <AppliedFilterChip
            key={locationId}
            label={t("filters.location")}
            value={label}
            onRemove={() =>
              onChange({
                locationIds: filters.locationIds.filter(
                  (id) => id !== locationId,
                ),
              })
            }
          />
        );
      })}

      {!hideCollectionGroupFilter && filters.collectionGroupId !== "" && (
        <AppliedFilterChip
          label={t("filters.collectionGroup")}
          value={groupLabel ?? filters.collectionGroupId}
          onRemove={() => onChange({ collectionGroupId: "" })}
        />
      )}

      {facetChips.map(({ key, label }) =>
        filters[key] !== "" ? (
          <AppliedFilterChip
            key={key}
            label={label}
            value={filters[key]}
            onRemove={() => onChange({ [key]: "" })}
          />
        ) : null,
      )}

      {filters.photograph !== "" && (
        <AppliedFilterChip
          label={t("filters.photograph")}
          value={
            filters.photograph === "with"
              ? t("filters.withPhotograph")
              : t("filters.withoutPhotograph")
          }
          onRemove={() => onChange({ photograph: "" })}
        />
      )}

      {filters.catalogedFrom !== "" && (
        <AppliedFilterChip
          label={t("filters.catalogedFrom")}
          value={catalogedFrom}
          onRemove={() => onChange({ catalogedFrom: "" })}
        />
      )}

      {filters.catalogedTo !== "" && (
        <AppliedFilterChip
          label={t("filters.catalogedTo")}
          value={catalogedTo}
          onRemove={() => onChange({ catalogedTo: "" })}
        />
      )}

      {advancedCount > 0 && (
        <AppliedFilterChip
          label={t("filters.advancedChip")}
          value={t("filters.advancedConditions", { count: advancedCount })}
          onRemove={() => onChange({ advancedFilters: [] })}
        />
      )}
    </AppliedFiltersBar>
  );
}
