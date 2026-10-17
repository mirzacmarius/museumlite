"use client";

import {
  COLLECTION_MODULE_IDS,
  type CollectionModuleId,
  isCollectionModuleId,
  isCollectionTypeEnabled,
  type ModuleId,
} from "@v1/backend/convex/utils/moduleCatalog";

/** Every object tab, including collection-type detail tabs. */
export const OBJECT_TAB_IDS = [
  "general",
  "physical",
  "condition",
  "media",
  "accession",
  "placement",
  "digital",
  "provenance",
  "valuation",
  "conservation",
  "exhibitions",
  "loans",
  "logs",
  "comments",
  ...COLLECTION_MODULE_IDS,
] as const;

export type ObjectTabId = (typeof OBJECT_TAB_IDS)[number];

export interface ObjectTabDefinition {
  id: ObjectTabId;
  label: `untranslatedRecords.objects.tabs.${ObjectTabId}`;
  editable: boolean;
  requiredPermission?: string;
  requiresSavedObject?: true;
  featureKey?: "conservation" | "exhibitions" | "loans";
  moduleKey?: "comments";
}

const valuationTab: ObjectTabDefinition = {
  id: "valuation",
  label: "untranslatedRecords.objects.tabs.valuation",
  editable: true,
  requiredPermission: "collections.view_valuation",
  requiresSavedObject: true,
};

interface ObjectTabAccess {
  locationTrackingEnabled?: boolean;
  permissions?: ReadonlyArray<string>;
}

function isTabAvailable(tab: ObjectTabDefinition, access: ObjectTabAccess) {
  if (tab.id === "placement" && access.locationTrackingEnabled === false) {
    return false;
  }
  return (
    !tab.requiredPermission ||
    (access.permissions ?? []).includes(tab.requiredPermission)
  );
}

const viewBaseTabs: ObjectTabDefinition[] = [
  {
    id: "general",
    label: "untranslatedRecords.objects.tabs.general",
    editable: true,
  },
  {
    id: "physical",
    label: "untranslatedRecords.objects.tabs.physical",
    editable: true,
  },
  {
    id: "condition",
    label: "untranslatedRecords.objects.tabs.condition",
    editable: false,
  },
  {
    id: "media",
    label: "untranslatedRecords.objects.tabs.media",
    editable: true,
  },
  {
    id: "accession",
    label: "untranslatedRecords.objects.tabs.accession",
    editable: true,
  },
  {
    id: "provenance",
    label: "untranslatedRecords.objects.tabs.provenance",
    editable: true,
  },
  valuationTab,
  {
    id: "placement",
    label: "untranslatedRecords.objects.tabs.placement",
    editable: true,
  },
  {
    id: "conservation",
    label: "untranslatedRecords.objects.tabs.conservation",
    editable: false,
    featureKey: "conservation",
  },
  {
    id: "exhibitions",
    label: "untranslatedRecords.objects.tabs.exhibitions",
    editable: false,
    featureKey: "exhibitions",
  },
  {
    id: "loans",
    label: "untranslatedRecords.objects.tabs.loans",
    editable: false,
    featureKey: "loans",
  },
  {
    id: "comments",
    label: "untranslatedRecords.objects.tabs.comments",
    editable: false,
    moduleKey: "comments",
  },
  {
    id: "logs",
    label: "untranslatedRecords.objects.tabs.logs",
    editable: false,
  },
];

const editBaseTabs: ObjectTabDefinition[] = [
  {
    id: "general",
    label: "untranslatedRecords.objects.tabs.general",
    editable: true,
  },
  {
    id: "physical",
    label: "untranslatedRecords.objects.tabs.physical",
    editable: true,
  },
  {
    id: "media",
    label: "untranslatedRecords.objects.tabs.media",
    editable: true,
  },
  {
    id: "accession",
    label: "untranslatedRecords.objects.tabs.accession",
    editable: true,
  },
  {
    id: "provenance",
    label: "untranslatedRecords.objects.tabs.provenance",
    editable: true,
  },
  valuationTab,
  {
    id: "placement",
    label: "untranslatedRecords.objects.tabs.placement",
    editable: true,
  },
  {
    id: "digital",
    label: "untranslatedRecords.objects.tabs.digital",
    editable: true,
  },
];

const moduleTabMap: Record<CollectionModuleId, ObjectTabDefinition> = {
  fine_art: {
    id: "fine_art",
    label: "untranslatedRecords.objects.tabs.fine_art",
    editable: false,
  },
  wine: {
    id: "wine",
    label: "untranslatedRecords.objects.tabs.wine",
    editable: false,
  },
  automotive: {
    id: "automotive",
    label: "untranslatedRecords.objects.tabs.automotive",
    editable: false,
  },
  natural_history: {
    id: "natural_history",
    label: "untranslatedRecords.objects.tabs.natural_history",
    editable: false,
  },
  archive: {
    id: "archive",
    label: "untranslatedRecords.objects.tabs.archive",
    editable: false,
  },
  coins_stamps: {
    id: "coins_stamps",
    label: "untranslatedRecords.objects.tabs.coins_stamps",
    editable: false,
  },
};

interface ObjectViewTabOptions extends ObjectTabAccess {
  collectionType?: string;
  enabledModules?: ReadonlyArray<ModuleId>;
  features: {
    conservation: boolean;
    exhibitions: boolean;
    loans: boolean;
  };
  modules: {
    comments: boolean;
  };
}

interface ObjectEditTabOptions extends ObjectTabAccess {
  savedObject?: boolean;
  typeDetailsTab?: CollectionModuleId;
}

export function getObjectViewTabs(options: ObjectViewTabOptions) {
  const moduleTab =
    isCollectionModuleId(options.collectionType) &&
    isCollectionTypeEnabled(
      options.collectionType,
      options.enabledModules ?? [],
    )
      ? moduleTabMap[options.collectionType]
      : undefined;

  const orderedTabs = moduleTab
    ? [viewBaseTabs[0], moduleTab, ...viewBaseTabs.slice(1)]
    : viewBaseTabs;

  return orderedTabs.filter((tab): tab is ObjectTabDefinition => {
    if (!tab || !isTabAvailable(tab, options)) return false;
    if (tab.moduleKey && !options.modules[tab.moduleKey]) return false;
    if (!tab.featureKey) return true;
    return options.features[tab.featureKey];
  });
}

export function getObjectEditTabs(options: ObjectEditTabOptions = {}) {
  const tabs = editBaseTabs.filter(
    (tab) =>
      tab.editable &&
      isTabAvailable(tab, options) &&
      (!tab.requiresSavedObject || options.savedObject),
  );
  if (!options.typeDetailsTab) return tabs;

  const [generalTab, ...otherTabs] = tabs;
  const typeDetailsTab = {
    ...moduleTabMap[options.typeDetailsTab],
    editable: true,
  };
  return generalTab
    ? [generalTab, typeDetailsTab, ...otherTabs]
    : [typeDetailsTab, ...otherTabs];
}
