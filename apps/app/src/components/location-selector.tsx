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

interface LocationPathSegment {
  name: string;
  locationCode: string;
}

function formatLocationPathLabel(
  path: LocationPathSegment[],
  emptyLabel: string,
): string {
  const currentLocation = path.at(-1);
  if (!currentLocation) {
    return emptyLabel;
  }

  return formatLocationSelectorLabel({
    name: currentLocation.name,
    locationCode: currentLocation.locationCode,
    path,
  });
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

  const sortedLocations = locations.toSorted((a, b) => {
    if (a.path.length !== b.path.length) {
      return a.path.length - b.path.length;
    }
    const aPath = a.path.map((segment) => segment.name).join(" → ");
    const bPath = b.path.map((segment) => segment.name).join(" → ");
    return aPath.localeCompare(bPath);
  });

  const hasConcreteValue = !!value && value !== "__none__";
  const selectedLocation = hasConcreteValue
    ? sortedLocations.find((location) => location._id === value)
    : undefined;
  const inactiveLocationPath =
    hasConcreteValue &&
    !selectedLocation &&
    Array.isArray(currentLocationPath) &&
    currentLocationPath.length > 0
      ? currentLocationPath
      : null;
  const currentInactiveLocationLabel = inactiveLocationPath
    ? `${formatLocationPathLabel(inactiveLocationPath, placeholder)} (current)`
    : null;
  const selectedLabel = selectedLocation
    ? formatLocationSelectorLabel(selectedLocation)
    : (currentInactiveLocationLabel ?? placeholder);

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
        {value && currentInactiveLocationLabel ? (
          <SelectItem value={value}>{currentInactiveLocationLabel}</SelectItem>
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
