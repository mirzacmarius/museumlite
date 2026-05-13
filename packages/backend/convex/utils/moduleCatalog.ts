export const MODULE_IDS = [
  "library",
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "accounts",
  "coins_stamps",
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
  },
  {
    value: "wine",
    label: "Wine & Spirits",
    description: "Wine cellar management",
    tabLabel: "Wine & Spirits",
  },
  {
    value: "automotive",
    label: "Automotive",
    description: "Classic cars, motorcycles",
    tabLabel: "Vehicle Details",
  },
  {
    value: "natural_history",
    label: "Natural History",
    description: "Specimens, fossils, minerals",
    tabLabel: "Natural History",
  },
  {
    value: "archive",
    label: "Corporate Archive",
    description: "Documents, records, DAM",
    tabLabel: "Archive Details",
  },
  {
    value: "coins_stamps",
    label: "Coins and Stamps",
    description: "Numismatic and philatelic records",
    tabLabel: "Coins and Stamps",
  },
] as const satisfies ReadonlyArray<{
  value: CollectionType;
  label: string;
  description: string;
  tabLabel: string;
}>;

export const COLLECTION_MODULE_TAB_LABELS = Object.fromEntries(
  COLLECTION_TYPE_OPTIONS.filter(
    (
      option,
    ): option is (typeof COLLECTION_TYPE_OPTIONS)[number] & {
      value: CollectionModuleId;
    } => option.value !== "general",
  ).map((option) => [option.value, option.tabLabel]),
) as Record<CollectionModuleId, string>;

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
