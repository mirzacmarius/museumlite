import { describe, expect, test } from "vitest";
import {
  COLLECTION_MODULE_IDS,
  COLLECTION_MODULE_TAB_LABELS,
  COLLECTION_TYPE_IDS,
  COLLECTION_TYPE_MODULE_REQUIREMENTS,
  COLLECTION_TYPE_OPTIONS,
  MODULE_IDS,
  SETTINGS_MODULE_IDS,
  getAvailableCollectionTypeOptions,
  isCollectionModuleId,
  isCollectionType,
  isCollectionTypeEnabled,
} from "./moduleCatalog";
import {
  COLLECTION_TYPE_VALIDATOR_IDS,
  ENABLED_MODULE_VALIDATOR_IDS,
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

  test("keeps collection module access requirements aligned with collection modules", () => {
    expect(Object.keys(COLLECTION_TYPE_MODULE_REQUIREMENTS).sort()).toEqual(
      [...COLLECTION_MODULE_IDS].sort(),
    );
  });

  test("keeps Convex validators aligned with module ids", () => {
    expect(ENABLED_MODULE_VALIDATOR_IDS).toEqual(MODULE_IDS);
    expect(COLLECTION_TYPE_VALIDATOR_IDS).toEqual(COLLECTION_TYPE_IDS);
    expect(enabledModuleValidator.isOptional).toBe("required");
    expect(collectionTypeValidator.isOptional).toBe("required");
  });

  test("distinguishes specialized modules from general collection type", () => {
    expect(isCollectionType("general")).toBe(true);
    expect(isCollectionModuleId("general")).toBe(false);
    expect(isCollectionModuleId("coins_stamps")).toBe(true);
    expect(isCollectionType("unknown")).toBe(false);
  });

  test("filters collection type options by enabled modules", () => {
    expect(
      getAvailableCollectionTypeOptions([]).map((option) => option.value),
    ).toEqual(["general"]);
    expect(isCollectionTypeEnabled("wine", [])).toBe(false);
    expect(isCollectionTypeEnabled("wine", ["wine"])).toBe(true);
    expect(isCollectionTypeEnabled("general", [])).toBe(true);
  });
});
