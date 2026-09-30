import { describe, expect, test } from "vitest";
import { occupancyBar } from "./location-occupancy";
import { locationUnitCards } from "./location-unit-cards";

describe("occupancyBar", () => {
  test("marks a location over capacity and caps the bar", () => {
    expect(occupancyBar(12, 10)).toEqual({
      kind: "over",
      percent: 120,
      barWidthPercent: 100,
    });
  });

  test("keeps a partial fill within capacity", () => {
    expect(occupancyBar(4, 10)).toEqual({
      kind: "within",
      percent: 40,
      barWidthPercent: 40,
    });
  });

  test("treats an exact fill as within capacity", () => {
    expect(occupancyBar(10, 10)).toEqual({
      kind: "within",
      percent: 100,
      barWidthPercent: 100,
    });
  });

  test("treats a missing capacity as unconfigured", () => {
    expect(occupancyBar(3, 0)).toEqual({
      kind: "unconfigured",
      percent: 0,
      barWidthPercent: 0,
    });
  });
});

describe("locationUnitCards", () => {
  test("shows a zero count on an empty unit and no repeated count on object cards", () => {
    expect(locationUnitCards([])).toEqual([
      { key: "empty", objectId: null, unitCount: 0 },
    ]);
    expect(locationUnitCards(["obj-a", "obj-b", "obj-c"])).toEqual([
      { key: "obj-a", objectId: "obj-a", unitCount: null },
      { key: "obj-b", objectId: "obj-b", unitCount: null },
      { key: "obj-c", objectId: "obj-c", unitCount: null },
    ]);
  });
});
