import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface ParentOptionLocation {
  _id: Id<"locations">;
  name: string;
  type: string;
  parentLocationId?: Id<"locations">;
}

export interface ParentLocationOption {
  id: Id<"locations">;
  name: string;
  type: string;
  level: number;
}

export function getAvailableParentLocationOptions(
  locations: ParentOptionLocation[] | undefined,
  locationId: Id<"locations">,
) {
  if (!locations) {
    return [];
  }

  const locationsById = new Map(
    locations.map((location) => [location._id, location]),
  );
  const locationsByParentId = new Map<
    Id<"locations"> | undefined,
    ParentOptionLocation[]
  >();
  for (const location of locations) {
    const siblings = locationsByParentId.get(location.parentLocationId) ?? [];
    siblings.push(location);
    locationsByParentId.set(location.parentLocationId, siblings);
  }

  const isDescendant = (location: ParentOptionLocation) => {
    if (location._id === locationId) {
      return true;
    }

    let currentParentId = location.parentLocationId;
    while (currentParentId) {
      if (currentParentId === locationId) {
        return true;
      }

      const parent = locationsById.get(currentParentId);
      currentParentId = parent?.parentLocationId;
    }

    return false;
  };

  const result: ParentLocationOption[] = [];

  const appendLocation = (
    location: ParentOptionLocation,
    level = 0,
    prefix = "",
  ) => {
    if (isDescendant(location)) {
      return;
    }

    const displayName = prefix
      ? `${prefix} -> ${location.name}`
      : location.name;
    result.push({
      id: location._id,
      name: displayName,
      type: location.type,
      level,
    });

    const children = locationsByParentId.get(location._id) ?? [];
    for (const child of children) {
      appendLocation(child, level + 1, displayName);
    }
  };

  const rootLocations = locationsByParentId.get(undefined) ?? [];
  for (const rootLocation of rootLocations) {
    appendLocation(rootLocation);
  }

  return result;
}
