import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface SidebarLocation {
  _id: Id<"locations">;
  name: string;
  locationCode: string;
  type: string;
  isActive: boolean;
  parentLocationId?: Id<"locations">;
}

const exhibitionTypes = [
  "gallery",
  "exhibition",
  "hall",
  "wing",
  "room",
  "building",
  "floor",
];

const storageTypes = ["vault", "storage", "cabinet", "shelf", "archive"];
const autoDisplayContainerTypes = [
  "building",
  "floor",
  "room",
  "gallery",
  "exhibition",
  "hall",
  "wing",
];
const vitrineTypes = ["vitrine", "display case", "displaycase", "case"];
const wallTypes = ["wall"];
const cabinetTypes = ["cabinet"];
const shelfTypes = ["shelf"];

export function isExhibitionLocation(type: string) {
  const normalizedType = type.toLowerCase();
  return exhibitionTypes.some((value) => normalizedType.includes(value));
}

export function isStorageLocation(type: string) {
  const normalizedType = type.toLowerCase();
  return storageTypes.some((value) => normalizedType.includes(value));
}

export function shouldAutoDisplayChildLocations(type: string) {
  const normalizedType = type.toLowerCase();
  return autoDisplayContainerTypes.some((value) =>
    normalizedType.includes(value),
  );
}

export function shouldShowInExhibitionSidebar(type: string) {
  const normalizedType = type.toLowerCase();

  return (
    shouldAutoDisplayChildLocations(type) ||
    vitrineTypes.some((value) => normalizedType.includes(value)) ||
    wallTypes.some((value) => normalizedType.includes(value)) ||
    cabinetTypes.some((value) => normalizedType.includes(value))
  );
}

export function getDescendantLocations(
  locations: SidebarLocation[],
  parentLocationId: Id<"locations">,
) {
  const childrenByParent = new Map<Id<"locations">, SidebarLocation[]>();

  for (const location of locations) {
    if (!location.parentLocationId) {
      continue;
    }

    const existingChildren = childrenByParent.get(location.parentLocationId);
    if (existingChildren) {
      existingChildren.push(location);
      continue;
    }

    childrenByParent.set(location.parentLocationId, [location]);
  }

  const descendants: SidebarLocation[] = [];
  const pendingLocationIds: Id<"locations">[] = [parentLocationId];

  while (pendingLocationIds.length > 0) {
    const currentLocationId = pendingLocationIds.shift();
    if (!currentLocationId) {
      continue;
    }

    const children = childrenByParent.get(currentLocationId) ?? [];
    for (const child of children) {
      descendants.push(child);
      pendingLocationIds.push(child._id);
    }
  }

  return descendants;
}

export function getAutomaticDisplayUnitCounts(
  locations: SidebarLocation[],
  parentLocationId: Id<"locations">,
) {
  const descendants = getDescendantLocations(locations, parentLocationId);

  const countMatchingTypes = (types: string[]) =>
    descendants.filter((location) => {
      const normalizedType = location.type.toLowerCase();
      return types.some((value) => normalizedType.includes(value));
    }).length;

  return {
    vitrineCount: countMatchingTypes(vitrineTypes),
    wallCount: countMatchingTypes(wallTypes),
    cabinetCount: countMatchingTypes(cabinetTypes),
    shelfCount: countMatchingTypes(shelfTypes),
  };
}

export function getVisibleSidebarLocations(locations: SidebarLocation[] = []) {
  return {
    exhibitionLocations: locations.filter(
      (location) =>
        !location.parentLocationId && isExhibitionLocation(location.type),
    ),
    storageLocations: locations.filter(
      (location) =>
        !location.parentLocationId && isStorageLocation(location.type),
    ),
  };
}

export function getDefaultLocationId(locations: SidebarLocation[] = []) {
  const { exhibitionLocations, storageLocations } =
    getVisibleSidebarLocations(locations);

  return exhibitionLocations[0]?._id ?? storageLocations[0]?._id ?? null;
}

export function resolveMenuLocationSelection({
  knownLocationIds,
  requestedLocationId,
  selectedLocationId,
  isSelectedLocationMissing,
  defaultLocationId,
}: {
  knownLocationIds: ReadonlySet<Id<"locations">>;
  requestedLocationId: string | null;
  selectedLocationId: Id<"locations"> | null;
  isSelectedLocationMissing: boolean;
  defaultLocationId: Id<"locations"> | null;
}) {
  const requestedId = requestedLocationId as Id<"locations"> | null;
  const hasRequestedLocation = Boolean(
    requestedId && knownLocationIds.has(requestedId),
  );
  const hasSelectedLocation = Boolean(
    selectedLocationId && knownLocationIds.has(selectedLocationId),
  );
  const fallbackLocationId =
    !hasSelectedLocation || isSelectedLocationMissing
      ? (defaultLocationId ?? selectedLocationId)
      : selectedLocationId;

  if (requestedLocationId && !hasRequestedLocation) {
    return {
      selectedLocationId: fallbackLocationId,
      clearRequestedLocation: true,
    };
  }

  if (hasRequestedLocation && requestedId) {
    return {
      selectedLocationId: requestedId,
      clearRequestedLocation: false,
    };
  }

  return {
    selectedLocationId: fallbackLocationId,
    clearRequestedLocation: false,
  };
}

export function getAncestorLocationIds(
  locations: SidebarLocation[],
  locationId: Id<"locations">,
) {
  const locationsById = new Map(
    locations.map((location) => [location._id, location]),
  );
  const ancestorIds = new Set<Id<"locations">>();
  const visitedParentIds = new Set<Id<"locations">>();
  let parentLocationId = locationsById.get(locationId)?.parentLocationId;

  while (parentLocationId && !visitedParentIds.has(parentLocationId)) {
    visitedParentIds.add(parentLocationId);
    ancestorIds.add(parentLocationId);
    parentLocationId = locationsById.get(parentLocationId)?.parentLocationId;
  }

  return ancestorIds;
}
