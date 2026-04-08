"use client";

export type ObjectTabId =
  | "general"
  | "physical"
  | "media"
  | "digital"
  | "provenance"
  | "conservation"
  | "exhibitions"
  | "loans"
  | "logs"
  | "comments"
  | "fine_art"
  | "wine"
  | "automotive"
  | "natural_history"
  | "archive";

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
  { id: "digital", label: "Digital Assets", editable: true },
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
  { id: "provenance", label: "Provenance", editable: true },
  { id: "physical", label: "Physical Description", editable: true },
  { id: "media", label: "Media", editable: true },
  { id: "digital", label: "Digital Assets", editable: true },
];

const moduleTabMap: Partial<
  Record<
    "fine_art" | "wine" | "automotive" | "natural_history" | "archive",
    ObjectTabDefinition
  >
> = {
  fine_art: { id: "fine_art", label: "Fine Art Details", editable: false },
  wine: { id: "wine", label: "Wine & Spirits", editable: false },
  automotive: { id: "automotive", label: "Vehicle Details", editable: false },
  natural_history: {
    id: "natural_history",
    label: "Natural History",
    editable: false,
  },
  archive: { id: "archive", label: "Archive Details", editable: false },
};

export function getObjectViewTabs(options: {
  collectionType?: string;
  features: {
    conservation: boolean;
    exhibitions: boolean;
    loans: boolean;
  };
}) {
  const moduleTab =
    options.collectionType &&
    options.collectionType !== "general" &&
    options.collectionType in moduleTabMap
      ? moduleTabMap[options.collectionType as keyof typeof moduleTabMap]
      : undefined;

  const orderedTabs = moduleTab
    ? [viewBaseTabs[0], moduleTab, ...viewBaseTabs.slice(1)]
    : viewBaseTabs;

  return orderedTabs.filter((tab): tab is ObjectTabDefinition => {
    if (!tab) return false;
    if (!tab.featureKey) return true;
    return options.features[tab.featureKey];
  });
}

export function getObjectEditTabs() {
  return editBaseTabs.filter((tab) => tab.editable);
}
