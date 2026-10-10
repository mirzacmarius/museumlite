"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useQuery } from "convex/react";
import { getLocationTypeLabel } from "@/lib/record-enum-labels";
import { useI18n } from "@/locales/client";

interface LocationSelectorProps {
  organizationId: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  /** Lets a `<Label htmlFor>` name the control. */
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function LocationSelector({
  organizationId,
  value,
  onValueChange,
  placeholder,
  allowNone = true,
  id,
  disabled,
  ...aria
}: LocationSelectorProps) {
  const translate = useI18n();
  const locations = useQuery(
    api.locations.listAllWithPaths,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );
  const currentLocationPath = useQuery(
    api.locations.getLocationPath,
    value && value !== "__none__"
      ? { locationId: value as Id<"locations"> }
      : "skip",
  );

  if (locations === undefined) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled>
        <SelectTrigger id={id} {...aria}>
          <SelectValue
            placeholder={translate(
              "untranslatedComponents.labels.loadingLocations",
            )}
          />
        </SelectTrigger>
      </Select>
    );
  }

  // Sort locations by path depth and name for better UX
  const sortedLocations = locations.toSorted((a, b) => {
    // First sort by path length (shallow to deep)
    if (a.path.length !== b.path.length) {
      return a.path.length - b.path.length;
    }
    // Then sort by path string (alphabetically)
    const aPath = a.path.map((p) => p.name).join(" → ");
    const bPath = b.path.map((p) => p.name).join(" → ");
    return aPath.localeCompare(bPath);
  });

  const withType = (location: { name: string; type: string }) =>
    `${location.name} (${getLocationTypeLabel(location.type, translate)})`;

  const formatLocationLabel = (location: {
    name: string;
    type: string;
    path: Array<{ name: string; type: string }>;
  }) => {
    if (location.path.length <= 1) {
      return withType(location);
    }
    const pathString = location.path
      .slice(0, -1)
      .map((p) => p.name)
      .join(" → ");
    return `${pathString} → ${withType(location)}`;
  };

  const formatLocationPathLabel = (
    path: Array<{ name: string; type: string }>,
  ) => {
    const currentLocation = path[path.length - 1];
    if (!currentLocation) {
      return (
        placeholder ??
        translate("untranslatedComponents.labels.selectALocation")
      );
    }

    if (path.length <= 1) {
      return withType(currentLocation);
    }

    const pathString = path
      .slice(0, -1)
      .map((p) => p.name)
      .join(" → ");
    return `${pathString} → ${withType(currentLocation)}`;
  };

  const hasSelectedLocation =
    !!value &&
    value !== "__none__" &&
    sortedLocations.some((location) => location._id === value);
  const selectedLocation =
    value && value !== "__none__"
      ? sortedLocations.find((location) => location._id === value)
      : undefined;
  const shouldShowCurrentInactiveLocation =
    !!value &&
    value !== "__none__" &&
    !hasSelectedLocation &&
    Array.isArray(currentLocationPath) &&
    currentLocationPath.length > 0;
  const selectedLabel = selectedLocation
    ? formatLocationLabel(selectedLocation)
    : shouldShowCurrentInactiveLocation
      ? translate("untranslatedComponents.labels.currentLocationOption", {
          location: formatLocationPathLabel(currentLocationPath),
        })
      : (placeholder ??
        translate("untranslatedComponents.labels.selectALocation"));

  return (
    <Select
      value={value || (allowNone ? "__none__" : undefined)}
      onValueChange={(val) => onValueChange(val === "__none__" ? "" : val)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className="h-auto min-h-9 whitespace-normal text-left [&>span]:line-clamp-none"
        {...aria}
      >
        <SelectValue
          placeholder={
            placeholder ??
            translate("untranslatedComponents.labels.selectALocation")
          }
        >
          {selectedLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">
              {translate("untranslatedComponents.labels.none")}
            </span>
          </SelectItem>
        )}
        {shouldShowCurrentInactiveLocation ? (
          <SelectItem value={value} disabled>
            {translate("untranslatedComponents.labels.currentLocationPath", {
              path: formatLocationPathLabel(currentLocationPath),
            })}
          </SelectItem>
        ) : null}
        {sortedLocations.map((location) => (
          <SelectItem
            key={location._id}
            value={location._id}
            disabled={location.status !== "active"}
          >
            {formatLocationLabel(location)}
            {location.status !== "active" ? ` (${location.status})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
