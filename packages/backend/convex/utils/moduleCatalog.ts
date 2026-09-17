export const MODULE_IDS = [
  "library",
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "accounts",
  "coins_stamps",
  "inventory_valuation",
  "insurance",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export const SETTINGS_MODULE_IDS = [
  "accounts",
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "library",
  "coins_stamps",
  "inventory_valuation",
  "insurance",
] as const satisfies ReadonlyArray<ModuleId>;

export const COLLECTION_MODULE_IDS = [
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "coins_stamps",
] as const;

export type CollectionModuleId = (typeof COLLECTION_MODULE_IDS)[number];

export const COLLECTION_TYPE_IDS = [
  "general",
  ...COLLECTION_MODULE_IDS,
] as const;

export type CollectionType = (typeof COLLECTION_TYPE_IDS)[number];

export const COLLECTION_TYPE_MODULE_REQUIREMENTS: Partial<
  Record<CollectionType, CollectionModuleId>
> = {
  fine_art: "fine_art",
  wine: "wine",
  automotive: "automotive",
  natural_history: "natural_history",
  archive: "archive",
  coins_stamps: "coins_stamps",
};

export const MODULE_INTEGRATION_REQUIREMENTS: Partial<
  Record<ModuleId, string>
> = {
  library: "library",
};

export const COLLECTION_TYPE_OPTIONS = [
  {
    value: "general",
    label: "General",
    description: "Standard collection item",
    tabLabel: "General",
  },
  {
    value: "fine_art",
    label: "Fine Art",
    description: "Paintings, sculptures, artworks",
    tabLabel: "Fine Art Details",
    hasDetailLifecycle: true,
  },
  {
    value: "wine",
    label: "Wine & Spirits",
    description: "Wine cellar management",
    tabLabel: "Wine & Spirits",
    hasDetailLifecycle: true,
  },
  {
    value: "automotive",
    label: "Automotive",
    description: "Classic cars, motorcycles",
    tabLabel: "Vehicle Details",
    hasDetailLifecycle: true,
  },
  {
    value: "natural_history",
    label: "Natural History",
    description: "Specimens, fossils, minerals",
    tabLabel: "Natural History",
    hasDetailLifecycle: true,
  },
  {
    value: "archive",
    label: "Corporate Archive",
    description: "Documents, records, DAM",
    tabLabel: "Archive Details",
    hasDetailLifecycle: true,
  },
  {
    value: "coins_stamps",
    label: "Coins and Stamps",
    description: "Numismatic and philatelic records",
    tabLabel: "Coins and Stamps",
    hasDetailLifecycle: true,
  },
] as const satisfies ReadonlyArray<{
  value: CollectionType;
  label: string;
  description: string;
  tabLabel: string;
  hasDetailLifecycle?: boolean;
}>;

export const COLLECTION_MODULE_TAB_LABELS = Object.fromEntries(
  COLLECTION_TYPE_OPTIONS.flatMap((option) =>
    option.value === "general" ? [] : [[option.value, option.tabLabel]],
  ),
) as Record<CollectionModuleId, string>;

export const COLLECTION_DETAIL_LIFECYCLE_MODULES =
  COLLECTION_TYPE_OPTIONS.flatMap((option) =>
    option.value !== "general" && option.hasDetailLifecycle === true
      ? [option.value]
      : [],
  );

export function isCollectionModuleId(
  value: string | undefined,
): value is CollectionModuleId {
  return COLLECTION_MODULE_IDS.some((moduleId) => moduleId === value);
}

export function isCollectionType(
  value: string | undefined,
): value is CollectionType {
  return COLLECTION_TYPE_IDS.some((collectionType) => collectionType === value);
}

export function getCollectionTypeModuleRequirement(
  collectionType: CollectionType | undefined,
): CollectionModuleId | null {
  if (!collectionType) return null;
  return COLLECTION_TYPE_MODULE_REQUIREMENTS[collectionType] ?? null;
}

export function isCollectionTypeEnabled(
  collectionType: CollectionType | undefined,
  enabledModules: ReadonlyArray<ModuleId>,
) {
  const requiredModule = getCollectionTypeModuleRequirement(collectionType);
  return requiredModule ? enabledModules.includes(requiredModule) : true;
}

export function getAvailableCollectionTypeOptions(
  enabledModules: ReadonlyArray<ModuleId>,
) {
  return COLLECTION_TYPE_OPTIONS.filter((option) =>
    isCollectionTypeEnabled(option.value, enabledModules),
  );
}
