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

export function isExhibitionLocation(type: string) {
  const normalizedType = type.toLowerCase();
  return exhibitionTypes.some((value) => normalizedType.includes(value));
}

export function isStorageLocation(type: string) {
  const normalizedType = type.toLowerCase();
  return storageTypes.some((value) => normalizedType.includes(value));
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
