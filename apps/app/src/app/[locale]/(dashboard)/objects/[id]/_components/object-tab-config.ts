"use client";

import {
  COLLECTION_MODULE_TAB_LABELS,
  type CollectionModuleId,
  isCollectionModuleId,
  isCollectionTypeEnabled,
  type ModuleId,
} from "@v1/backend/convex/utils/moduleCatalog";

export type ObjectTabId =
  | "general"
  | "physical"
  | "media"
  | "accession"
  | "placement"
  | "digital"
  | "provenance"
  | "conservation"
  | "exhibitions"
  | "loans"
  | "logs"
  | "comments"
  | CollectionModuleId;

export interface ObjectTabDefinition {
  id: ObjectTabId;
  label: string;
  editable: boolean;
  featureKey?: "conservation" | "exhibitions" | "loans";
}

const viewBaseTabs: ObjectTabDefinition[] = [
  { id: "general", label: "General", editable: true },
  { id: "physical", label: "Physical Description", editable: true },
  { id: "media", label: "Media", editable: true },
  { id: "accession", label: "Accession", editable: true },
  { id: "provenance", label: "Provenance and History", editable: true },
  { id: "placement", label: "Placement and Relationships", editable: true },
  {
    id: "conservation",
    label: "Conservation",
    editable: false,
    featureKey: "conservation",
  },
  {
    id: "exhibitions",
    label: "Exhibitions",
    editable: false,
    featureKey: "exhibitions",
  },
  { id: "loans", label: "Loans", editable: false, featureKey: "loans" },
  { id: "comments", label: "Comments", editable: false },
  { id: "logs", label: "Logs", editable: false },
];

const editBaseTabs: ObjectTabDefinition[] = [
  { id: "general", label: "General", editable: true },
  { id: "physical", label: "Physical Description", editable: true },
  { id: "media", label: "Media", editable: true },
  { id: "accession", label: "Accession", editable: true },
  { id: "provenance", label: "Provenance and History", editable: true },
  { id: "placement", label: "Placement and Relationships", editable: true },
  { id: "digital", label: "Visibility", editable: true },
];

const moduleTabMap: Record<CollectionModuleId, ObjectTabDefinition> = {
  fine_art: {
    id: "fine_art",
    label: COLLECTION_MODULE_TAB_LABELS.fine_art,
    editable: false,
  },
  wine: {
    id: "wine",
    label: COLLECTION_MODULE_TAB_LABELS.wine,
    editable: false,
  },
  automotive: {
    id: "automotive",
    label: COLLECTION_MODULE_TAB_LABELS.automotive,
    editable: false,
  },
  natural_history: {
    id: "natural_history",
    label: COLLECTION_MODULE_TAB_LABELS.natural_history,
    editable: false,
  },
  archive: {
    id: "archive",
    label: COLLECTION_MODULE_TAB_LABELS.archive,
    editable: false,
  },
  coins_stamps: {
    id: "coins_stamps",
    label: COLLECTION_MODULE_TAB_LABELS.coins_stamps,
    editable: false,
  },
};

export function getObjectViewTabs(options: {
  collectionType?: string;
  enabledModules?: ReadonlyArray<ModuleId>;
  locationTrackingEnabled?: boolean;
  features: {
    conservation: boolean;
    exhibitions: boolean;
    loans: boolean;
  };
}) {
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
    if (!tab) return false;
    if (tab.id === "placement" && options.locationTrackingEnabled === false) {
      return false;
    }
    if (!tab.featureKey) return true;
    return options.features[tab.featureKey];
  });
}

export function getObjectEditTabs(options?: {
  locationTrackingEnabled?: boolean;
}) {
  return editBaseTabs.filter((tab) => {
    if (tab.id === "placement" && options?.locationTrackingEnabled === false) {
      return false;
    }
    return tab.editable;
  });
}
