import { describe, expect, test } from "vitest";
import {
  COLLECTION_DETAIL_LIFECYCLE_MODULES,
  COLLECTION_MODULE_IDS,
  COLLECTION_MODULE_TAB_LABELS,
  COLLECTION_TYPE_IDS,
  COLLECTION_TYPE_MODULE_REQUIREMENTS,
  COLLECTION_TYPE_OPTIONS,
  getAvailableCollectionTypeOptions,
  isCollectionModuleId,
  isCollectionType,
  isCollectionTypeEnabled,
  isModuleSwitchedOn,
  MODULE_IDS,
  moduleSwitchPatch,
  SETTINGS_MODULE_IDS,
} from "./moduleCatalog";
import {
  COLLECTION_TYPE_VALIDATOR_IDS,
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
    expect(Object.keys(COLLECTION_MODULE_TAB_LABELS).toSorted()).toEqual(
      COLLECTION_MODULE_IDS.toSorted(),
    );
  });

  test("keeps collection module access requirements aligned with collection modules", () => {
    expect(Object.keys(COLLECTION_TYPE_MODULE_REQUIREMENTS).toSorted()).toEqual(
      COLLECTION_MODULE_IDS.toSorted(),
    );
  });

  test("keeps collection detail lifecycle aligned with collection modules", () => {
    expect(new Set(COLLECTION_DETAIL_LIFECYCLE_MODULES)).toEqual(
      new Set(COLLECTION_MODULE_IDS),
    );
  });

  test("keeps each module in exactly one stored list", () => {
    expect(new Set(MODULE_IDS).size).toBe(MODULE_IDS.length);
  });

  test("keeps Convex validators aligned with module ids", () => {
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

  test("Comments is on until switched off; other modules are off until switched on", () => {
    expect(isModuleSwitchedOn({}, "comments")).toBe(true);
    expect(isModuleSwitchedOn({}, "accounts")).toBe(false);

    const switchedOff = moduleSwitchPatch({}, "comments", false);
    expect(switchedOff).toEqual({ disabledModules: ["comments"] });
    expect(isModuleSwitchedOn(switchedOff, "comments")).toBe(false);
    expect(moduleSwitchPatch(switchedOff, "comments", false)).toEqual(
      switchedOff,
    );
    expect(moduleSwitchPatch(switchedOff, "comments", true)).toEqual({
      disabledModules: [],
    });

    const accountsOn = moduleSwitchPatch(
      { enabledModules: ["wine"], disabledModules: ["comments"] },
      "accounts",
      true,
    );
    expect(accountsOn).toEqual({ enabledModules: ["wine", "accounts"] });
    expect(moduleSwitchPatch(accountsOn, "accounts", true)).toEqual(accountsOn);
    expect(moduleSwitchPatch(accountsOn, "accounts", false)).toEqual({
      enabledModules: ["wine"],
    });
  });
});
