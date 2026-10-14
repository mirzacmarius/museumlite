"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { AppliedFilterChip, AppliedFiltersBar } from "@v1/ui/filters-dropdown";
import { type RefObject, useMemo } from "react";
import type {
  ObjectDisplayStatus,
  ObjectStatus,
} from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";

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
    (!hideCollectionGroupFilter && filters.collectionGroupId !== "");

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
    </AppliedFiltersBar>
  );
}
