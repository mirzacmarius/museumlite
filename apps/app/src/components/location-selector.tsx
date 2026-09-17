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
import { formatLocationSelectorLabel } from "@/app/[locale]/(dashboard)/locations/location-label";

interface LocationSelectorProps {
  organizationId: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
}

export function LocationSelector({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select a location",
  allowNone = true,
}: LocationSelectorProps) {
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
        <SelectTrigger>
          <SelectValue placeholder="Loading locations..." />
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

  const formatLocationPathLabel = (
    path: Array<{ name: string; locationCode: string }>,
  ) => {
    const currentLocation = path[path.length - 1];
    if (!currentLocation) {
      return placeholder;
    }

    return formatLocationSelectorLabel({
      name: currentLocation.name,
      locationCode: currentLocation.locationCode,
      path,
    });
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
    ? formatLocationSelectorLabel(selectedLocation)
    : shouldShowCurrentInactiveLocation
      ? `${formatLocationPathLabel(currentLocationPath)} (current)`
      : placeholder;

  return (
    <Select
      value={value || (allowNone ? "__none__" : undefined)}
      onValueChange={(val) => onValueChange(val === "__none__" ? "" : val)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
        )}
        {shouldShowCurrentInactiveLocation ? (
          <SelectItem value={value}>
            {`${formatLocationPathLabel(currentLocationPath)} (current)`}
          </SelectItem>
        ) : null}
        {sortedLocations.map((location) => (
          <SelectItem key={location._id} value={location._id}>
            {formatLocationSelectorLabel(location)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
