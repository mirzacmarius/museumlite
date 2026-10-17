import { COLLECTION_MODULE_IDS } from "@v1/backend/convex/utils/moduleCatalog";
import { expect, test } from "vitest";
import en from "@/locales/en";
import es from "@/locales/es";
import fr from "@/locales/fr";
import no from "@/locales/no";
import ro from "@/locales/ro";
import { getObjectEditTabs, getObjectViewTabs } from "./object-tab-config";

function translation(dictionary: object, key: string) {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

const everyObjectTab = [
  ...getObjectEditTabs({
    savedObject: true,
    permissions: ["collections.view_valuation"],
  }),
  ...COLLECTION_MODULE_IDS.flatMap((collectionType) =>
    getObjectViewTabs({
      collectionType,
      enabledModules: COLLECTION_MODULE_IDS,
      permissions: ["collections.view_valuation"],
      features: { conservation: true, exhibitions: true, loans: true },
      modules: { comments: true },
    }),
  ),
];

test("object form tabs have English names", () => {
  expect(
    getObjectEditTabs({
      savedObject: true,
      permissions: ["collections.view_valuation"],
    }).map((tab) => translation(en, tab.label)),
  ).toEqual([
    "General",
    "Physical Description",
    "Media",
    "Accession",
    "Provenance and History",
    "Valuation",
    "Placement and Relationships",
    "Visibility",
  ]);
});

for (const [locale, dictionary] of Object.entries({ en, es, fr, no, ro })) {
  test(`${locale} names every object tab`, () => {
    const unnamed = [...new Set(everyObjectTab.map((tab) => tab.label))].filter(
      (label) => !translation(dictionary, label)?.trim(),
    );
    expect(unnamed).toEqual([]);
  });
}

test("the Comments tab shows only while the Comments module is on, and edit mode never has one", () => {
  const tabIds = (comments: boolean) => ({
    view: getObjectViewTabs({
      permissions: ["collections.read", "collections.update"],
      features: { conservation: false, exhibitions: false, loans: false },
      modules: { comments },
    }).map((tab) => tab.id),
    edit: getObjectEditTabs({
      savedObject: true,
      permissions: ["collections.read", "collections.update"],
    }).map((tab) => tab.id),
  });

  expect(tabIds(true).view).toContain("comments");
  expect(tabIds(false).view).toEqual(
    tabIds(true).view.filter((id) => id !== "comments"),
  );
  expect(tabIds(true).edit).not.toContain("comments");
  expect(tabIds(false).edit).toEqual(tabIds(true).edit);
});

test("the Valuation tab needs valuation access in view and edit mode", () => {
  const tabIds = (permissions: string[]) => ({
    view: getObjectViewTabs({
      permissions,
      features: { conservation: true, exhibitions: true, loans: true },
      modules: { comments: true },
    }).map((tab) => tab.id),
    edit: getObjectEditTabs({ savedObject: true, permissions }).map(
      (tab) => tab.id,
    ),
  });

  expect(tabIds(["collections.read", "collections.update"])).toEqual({
    view: [
      "general",
      "physical",
      "media",
      "accession",
      "provenance",
      "placement",
      "conservation",
      "exhibitions",
      "loans",
      "comments",
      "logs",
    ],
    edit: [
      "general",
      "physical",
      "media",
      "accession",
      "provenance",
      "placement",
      "digital",
    ],
  });
  expect(
    tabIds([
      "collections.read",
      "collections.update",
      "collections.view_valuation",
    ]),
  ).toEqual({
    view: [
      "general",
      "physical",
      "media",
      "accession",
      "provenance",
      "valuation",
      "placement",
      "conservation",
      "exhibitions",
      "loans",
      "comments",
      "logs",
    ],
    edit: [
      "general",
      "physical",
      "media",
      "accession",
      "provenance",
      "valuation",
      "placement",
      "digital",
    ],
  });
});

test("a new object request has no Valuation tab", () => {
  expect(
    getObjectEditTabs({
      permissions: ["collections.view_valuation"],
    }).map((tab) => tab.id),
  ).toEqual([
    "general",
    "physical",
    "media",
    "accession",
    "provenance",
    "placement",
    "digital",
  ]);
});
