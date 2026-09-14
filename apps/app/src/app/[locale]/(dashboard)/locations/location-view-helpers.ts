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

export interface ExhibitionSpaceOption {
  location: SidebarLocation;
  depth: number;
}

export function getExhibitionSpaceOptions(
  locations: SidebarLocation[] = [],
): ExhibitionSpaceOption[] {
  const { exhibitionLocations } = getVisibleSidebarLocations(locations);
  const childrenByParent = new Map<Id<"locations">, SidebarLocation[]>();

  for (const location of locations) {
    if (
      !location.parentLocationId ||
      !shouldShowInExhibitionSidebar(location.type)
    ) {
      continue;
    }

    const existingChildren = childrenByParent.get(location.parentLocationId);
    if (existingChildren) {
      existingChildren.push(location);
      continue;
    }

    childrenByParent.set(location.parentLocationId, [location]);
  }

  const options: ExhibitionSpaceOption[] = [];
  const pendingLocations: Array<{ location: SidebarLocation; depth: number }> =
    exhibitionLocations.map((location) => ({ location, depth: 0 }));
  const visitedLocationIds = new Set<Id<"locations">>();

  while (pendingLocations.length > 0) {
    const currentOption = pendingLocations.shift();
    if (!currentOption) {
      continue;
    }

    const locationId = currentOption.location._id;
    if (visitedLocationIds.has(locationId)) {
      continue;
    }

    visitedLocationIds.add(locationId);
    options.push(currentOption);

    const childLocations = childrenByParent.get(locationId) ?? [];
    pendingLocations.unshift(
      ...childLocations.map((location) => ({
        location,
        depth: currentOption.depth + 1,
      })),
    );
  }

  return options;
}

export function getExhibitionRootIds(
  exhibitionSpaceOptions: ExhibitionSpaceOption[],
) {
  const exhibitionRootIds = new Set<Id<"locations">>();

  for (const option of exhibitionSpaceOptions) {
    if (option.depth === 0) exhibitionRootIds.add(option.location._id);
  }

  return exhibitionRootIds;
}

export function getExhibitionDropdownLabel({
  selectedLocationId,
  selectedLocationPath,
  exhibitionSpaceOptions,
}: {
  selectedLocationId: Id<"locations"> | null;
  selectedLocationPath: Array<{ _id: Id<"locations">; name: string }>;
  exhibitionSpaceOptions: ExhibitionSpaceOption[];
}) {
  const exhibitionRootIds = getExhibitionRootIds(exhibitionSpaceOptions);
  const exhibitionRoot = selectedLocationPath.find((pathLocation) =>
    exhibitionRootIds.has(pathLocation._id),
  );

  if (exhibitionRoot) return exhibitionRoot.name;

  const selectedOption = exhibitionSpaceOptions.find(
    (option) => option.location._id === selectedLocationId,
  );

  return selectedOption?.location.name ?? "Exhibition Spaces";
}

export function getDefaultLocationId(locations: SidebarLocation[] = []) {
  const { exhibitionLocations, storageLocations } =
    getVisibleSidebarLocations(locations);

  return exhibitionLocations[0]?._id ?? storageLocations[0]?._id ?? null;
}
