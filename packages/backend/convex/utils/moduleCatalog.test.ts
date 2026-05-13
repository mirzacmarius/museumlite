import { describe, expect, test } from "vitest";
import {
  COLLECTION_MODULE_IDS,
  COLLECTION_MODULE_TAB_LABELS,
  COLLECTION_TYPE_IDS,
  COLLECTION_TYPE_OPTIONS,
  MODULE_IDS,
  SETTINGS_MODULE_IDS,
  isCollectionModuleId,
  isCollectionType,
} from "./moduleCatalog";
import {
  collectionTypeValidator,
  enabledModuleValidator,
} from "./moduleValidators";

describe("module catalog", () => {
  test("keeps settings modules aligned with supported modules", () => {
    expect(new Set(SETTINGS_MODULE_IDS)).toEqual(new Set(MODULE_IDS));
  });

  test("keeps collection types aligned with their option metadata", () => {
    expect(COLLECTION_TYPE_OPTIONS.map((option) => option.value)).toEqual(
      COLLECTION_TYPE_IDS,
    );
  });

  test("keeps collection module tab labels aligned with collection modules", () => {
    expect(Object.keys(COLLECTION_MODULE_TAB_LABELS).sort()).toEqual(
      [...COLLECTION_MODULE_IDS].sort(),
    );
  });

  test("keeps Convex validators aligned with module ids", () => {
    expect(enabledModuleValidator.json).toEqual({
      type: "union",
      value: MODULE_IDS.map((value) => ({ type: "literal", value })),
    });

    expect(collectionTypeValidator.json).toEqual({
      type: "union",
      value: COLLECTION_TYPE_IDS.map((value) => ({ type: "literal", value })),
    });
  });

  test("distinguishes specialized modules from general collection type", () => {
    expect(isCollectionType("general")).toBe(true);
    expect(isCollectionModuleId("general")).toBe(false);
    expect(isCollectionModuleId("coins_stamps")).toBe(true);
    expect(isCollectionType("unknown")).toBe(false);
  });
});
