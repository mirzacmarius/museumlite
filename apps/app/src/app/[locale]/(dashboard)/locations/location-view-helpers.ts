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

export type LocationNavStorage = "standard" | "secure" | "cold";
export type LocationNavAccessoryKind = "cold" | "status";

const LOCATION_NAV_ACCESSORY_KIND: Record<
  LocationNavStorage,
  LocationNavAccessoryKind
> = {
  standard: "status",
  secure: "status",
  cold: "cold",
};

export function getLocationNavAccessoryKind(
  storage: LocationNavStorage,
): LocationNavAccessoryKind {
  return LOCATION_NAV_ACCESSORY_KIND[storage];
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
