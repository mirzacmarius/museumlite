import { expect, test } from "vitest";

import {
  formatLocationInfoWithId,
  formatLocationLabel,
  formatLocationSelectorLabel,
} from "./location-label";

test("formatLocationLabel returns location code and name", () => {
  expect(formatLocationLabel("A-12-3", "Shelf 3")).toBe("A-12-3 · Shelf 3");
});

test("formatLocationInfoWithId shows Location ID behind location info", () => {
  expect(formatLocationInfoWithId("Gallery A", "G-001")).toBe(
    "Gallery A (G-001)",
  );
});

test("formatLocationSelectorLabel includes Location ID behind the path", () => {
  expect(
    formatLocationSelectorLabel({
      name: "Gallery A",
      locationCode: "G-001",
      path: [{ name: "Gallery A" }],
    }),
  ).toBe("Gallery A (G-001)");

  expect(
    formatLocationSelectorLabel({
      name: "Shelf 3",
      locationCode: "SH-003",
      path: [{ name: "Building A" }, { name: "Room 12" }, { name: "Shelf 3" }],
    }),
  ).toBe("Building A → Room 12 → Shelf 3 (SH-003)");
});
