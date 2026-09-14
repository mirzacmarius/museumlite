import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getDescendantLocations } from "../../location-view-helpers";

export function buildLocationPath(
  locations: Array<{
    _id: Id<"locations">;
    name: string;
    parentLocationId?: Id<"locations">;
  }>,
  locationId: Id<"locations">,
) {
  const locationsById = new Map(
    locations.map((location) => [location._id, location]),
  );
  const path: Array<{ _id: Id<"locations">; name: string }> = [];
  const visitedLocationIds = new Set<Id<"locations">>();
  let currentLocation = locationsById.get(locationId);

  while (currentLocation && !visitedLocationIds.has(currentLocation._id)) {
    path.unshift({
      _id: currentLocation._id,
      name: currentLocation.name,
    });
    visitedLocationIds.add(currentLocation._id);
    currentLocation = currentLocation.parentLocationId
      ? locationsById.get(currentLocation.parentLocationId)
      : undefined;
  }

  return path;
}

function isVitrineLocation(type: string) {
  const normalizedType = type.toLowerCase();
  return (
    normalizedType.includes("vitrine") ||
    normalizedType.includes("display case") ||
    normalizedType.includes("displaycase")
  );
}

function isWallLocation(type: string) {
  return type.toLowerCase().includes("wall");
}

function isCabinetLocation(type: string) {
  return type.toLowerCase().includes("cabinet");
}

function isShelfLocation(type: string) {
  return type.toLowerCase().includes("shelf");
}

export function getDisplayUnitLocations(
  descendantLocations: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
  }>,
  allLocations: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
    parentLocationId?: Id<"locations">;
  }>,
) {
  const toDisplayUnitLocation = (
    location: (typeof descendantLocations)[number],
  ) => ({
    _id: location._id,
    name: location.name,
    locationCode: location.locationCode,
    type: location.type,
    isActive: location.isActive,
    descendantLocationIds: getDescendantLocations(
      allLocations,
      location._id,
    ).map((descendantLocation) => descendantLocation._id),
  });

  return {
    vitrines: descendantLocations.flatMap((location) =>
      isVitrineLocation(location.type) ? [toDisplayUnitLocation(location)] : [],
    ),
    walls: descendantLocations.flatMap((location) =>
      isWallLocation(location.type) ? [toDisplayUnitLocation(location)] : [],
    ),
    cabinets: descendantLocations.flatMap((location) =>
      isCabinetLocation(location.type) ? [toDisplayUnitLocation(location)] : [],
    ),
    shelves: descendantLocations.flatMap((location) =>
      isShelfLocation(location.type) ? [toDisplayUnitLocation(location)] : [],
    ),
  };
}
