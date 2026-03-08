"use client";

import type { ObjectStatus } from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { AppliedFilterChip, AppliedFiltersBar } from "@v1/ui/filters-dropdown";
import { useMemo } from "react";

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
  locationId: string;
  collectionGroupId: string;
}

interface ObjectAppliedFiltersProps {
  filters: ObjectAppliedFiltersValue;
  locations?: LocationOption[];
  collectionGroups?: CollectionGroupOption[];
  onChange: (filters: Partial<ObjectAppliedFiltersValue>) => void;
  onClearAll: () => void;
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

export function ObjectAppliedFilters({
  filters,
  locations,
  collectionGroups,
  onChange,
  onClearAll,
  className,
}: ObjectAppliedFiltersProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");

  const locationLabel = useMemo(() => {
    if (!filters.locationId) return null;
    const match = locations?.find((l) => l._id === filters.locationId);
    if (!match) return null;
    return match.path.map((p) => p.name).join(" > ");
  }, [filters.locationId, locations]);

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
    filters.locationId !== "" ||
    filters.collectionGroupId !== "";

  if (!showBar) return null;

  return (
    <AppliedFiltersBar className={className}>
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

      {filters.locationId !== "" && (
        <AppliedFilterChip
          label={t("filters.location")}
          value={locationLabel ?? filters.locationId}
          onRemove={() => onChange({ locationId: "" })}
        />
      )}

      {filters.collectionGroupId !== "" && (
        <AppliedFilterChip
          label={t("filters.collectionGroup")}
          value={groupLabel ?? filters.collectionGroupId}
          onRemove={() => onChange({ collectionGroupId: "" })}
        />
      )}

      <AppliedFilterChip
        label={common("clearAll")}
        onRemove={onClearAll}
        className="text-zinc-300 hover:text-zinc-100"
      />
    </AppliedFiltersBar>
  );
}
