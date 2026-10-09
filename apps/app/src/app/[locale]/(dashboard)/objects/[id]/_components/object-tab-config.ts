"use client";

import {
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
  label: `untranslatedRecords.objects.tabs.${ObjectTabId}`;
  editable: boolean;
  featureKey?: "conservation" | "exhibitions" | "loans";
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
  /** Collection type whose intake details the form captures, if any. */
  typeDetailsTab?: CollectionModuleId;
}) {
  const tabs = editBaseTabs.filter((tab) => {
    if (tab.id === "placement" && options?.locationTrackingEnabled === false) {
      return false;
    }
    return tab.editable;
  });
  if (!options?.typeDetailsTab) return tabs;

  const [generalTab, ...otherTabs] = tabs;
  const typeDetailsTab = {
    ...moduleTabMap[options.typeDetailsTab],
    editable: true,
  };
  return generalTab
    ? [generalTab, typeDetailsTab, ...otherTabs]
    : [typeDetailsTab, ...otherTabs];
}
