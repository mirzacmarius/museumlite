"use client";

import type { ObjectStatus } from "@/hooks/use-url-filters";
import { useScopedI18n } from "@/locales/client";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  FilterOptionRow,
  FilterSection,
  FiltersDropdown,
  FiltersSearchInput,
} from "@v1/ui/filters-dropdown";
import { useMemo, useState } from "react";

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
  locationId: string;
  collectionGroupId: string;
}

interface ObjectFiltersDropdownProps {
  filters: ObjectFiltersDropdownValue;
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
  objectTypes: string[];
  locations?: LocationOption[];
  collectionGroups?: CollectionGroupOption[];
  className?: string;
}

function titleMatchesQuery(title: string, query: string) {
  if (query.trim() === "") return true;
  return title.toLowerCase().includes(query.trim().toLowerCase());
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

export function ObjectFiltersDropdown({
  filters,
  onChange,
  objectTypes,
  locations,
  collectionGroups,
  className,
}: ObjectFiltersDropdownProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const [searchQuery, setSearchQuery] = useState("");

  const statusOptions: Array<{ value: ObjectStatus; label: string }> = useMemo(
    () => [
      { value: "any", label: statusLabel(t, "any") },
      { value: "all", label: statusLabel(t, "all") },
      { value: "active", label: statusLabel(t, "active") },
      { value: "loaned", label: statusLabel(t, "loaned") },
      { value: "archived", label: statusLabel(t, "archived") },
      { value: "deleted", label: statusLabel(t, "deleted") },
    ],
    [t],
  );

  const activeFilterCount =
    (filters.status !== "any" ? 1 : 0) +
    (filters.objectType !== "" ? 1 : 0) +
    (filters.locationId !== "" ? 1 : 0) +
    (filters.collectionGroupId !== "" ? 1 : 0);

  const filteredStatuses = statusOptions.filter((o) =>
    titleMatchesQuery(o.label, searchQuery),
  );

  const filteredObjectTypes = objectTypes
    .filter((type) => titleMatchesQuery(type, searchQuery))
    .sort((a, b) => a.localeCompare(b));

  const filteredLocations = (locations ?? []).filter((location) => {
    const label = location.path.map((p) => p.name).join(" > ");
    return titleMatchesQuery(label, searchQuery);
  });

  const filteredGroups = (collectionGroups ?? []).filter((group) =>
    titleMatchesQuery(group.name, searchQuery),
  );

  return (
    <FiltersDropdown
      title={t("filters.title")}
      hasActiveFilters={activeFilterCount > 0}
      activeFilterCount={activeFilterCount}
      className={className}
      contentClassName="w-[23rem]"
    >
      <div className="flex max-h-[38rem] flex-col overflow-hidden">
        <FiltersSearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={common("search")}
        />

        <div className="mt-2 size-full overflow-y-auto">
          <div className="divide-y divide-border">
            <FilterSection
              title={t("filters.status")}
              count={filters.status !== "any" ? 1 : 0}
              defaultOpen
            >
              <div className="space-y-1">
                {filteredStatuses.length > 0 ? (
                  filteredStatuses.map((option) => (
                    <FilterOptionRow
                      key={option.value}
                      kind="single"
                      isChecked={filters.status === option.value}
                      onClick={() =>
                        onChange({
                          status:
                            filters.status === option.value
                              ? "any"
                              : option.value,
                        })
                      }
                      title={option.label}
                    />
                  ))
                ) : (
                  <p className="px-1.5 py-2 text-xs italic text-muted-foreground">
                    {common("noResults")}
                  </p>
                )}
              </div>
            </FilterSection>

            <FilterSection
              title={t("filters.objectType")}
              count={filters.objectType !== "" ? 1 : 0}
              defaultOpen
            >
              <div className="space-y-1">
                <FilterOptionRow
                  kind="single"
                  isChecked={filters.objectType === ""}
                  onClick={() => onChange({ objectType: "" })}
                  title={t("filters.allTypes")}
                />
                {filteredObjectTypes.length > 0 ? (
                  filteredObjectTypes.map((type) => (
                    <FilterOptionRow
                      key={type}
                      kind="single"
                      isChecked={filters.objectType === type}
                      onClick={() =>
                        onChange({
                          objectType: filters.objectType === type ? "" : type,
                        })
                      }
                      title={type}
                    />
                  ))
                ) : (
                  <p className="px-1.5 py-2 text-xs italic text-muted-foreground">
                    {common("noResults")}
                  </p>
                )}
              </div>
            </FilterSection>

            <FilterSection
              title={t("filters.location")}
              count={filters.locationId !== "" ? 1 : 0}
              defaultOpen
            >
              <div className="space-y-1">
                <FilterOptionRow
                  kind="single"
                  isChecked={filters.locationId === ""}
                  onClick={() => onChange({ locationId: "" })}
                  title={t("filters.allLocations")}
                />
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((location) => {
                    const label = location.path.map((p) => p.name).join(" > ");
                    return (
                      <FilterOptionRow
                        key={location._id}
                        kind="single"
                        isChecked={filters.locationId === location._id}
                        onClick={() =>
                          onChange({
                            locationId:
                              filters.locationId === location._id
                                ? ""
                                : location._id,
                          })
                        }
                        title={label}
                      />
                    );
                  })
                ) : (
                  <p className="px-1.5 py-2 text-xs italic text-muted-foreground">
                    {common("noResults")}
                  </p>
                )}
              </div>
            </FilterSection>

            <FilterSection
              title={t("filters.collectionGroup")}
              count={filters.collectionGroupId !== "" ? 1 : 0}
              defaultOpen
            >
              <div className="space-y-1">
                <FilterOptionRow
                  kind="single"
                  isChecked={filters.collectionGroupId === ""}
                  onClick={() => onChange({ collectionGroupId: "" })}
                  title={t("filters.allGroups")}
                />
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group) => (
                    <FilterOptionRow
                      key={group._id}
                      kind="single"
                      isChecked={filters.collectionGroupId === group._id}
                      onClick={() =>
                        onChange({
                          collectionGroupId:
                            filters.collectionGroupId === group._id
                              ? ""
                              : group._id,
                        })
                      }
                      title={group.name}
                    />
                  ))
                ) : (
                  <p className="px-1.5 py-2 text-xs italic text-muted-foreground">
                    {common("noResults")}
                  </p>
                )}
              </div>
            </FilterSection>
          </div>
        </div>
      </div>
    </FiltersDropdown>
  );
}
