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
  ...getObjectEditTabs(),
  ...COLLECTION_MODULE_IDS.flatMap((collectionType) =>
    getObjectViewTabs({
      collectionType,
      enabledModules: COLLECTION_MODULE_IDS,
      features: { conservation: true, exhibitions: true, loans: true },
    }),
  ),
];

test("object form tabs have English names", () => {
  expect(getObjectEditTabs().map((tab) => translation(en, tab.label))).toEqual([
    "General",
    "Physical Description",
    "Media",
    "Accession",
    "Provenance and History",
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
