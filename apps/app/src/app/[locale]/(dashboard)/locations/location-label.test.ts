import { expect, test } from "vitest";

import { formatLocationLabel } from "./location-label";

test("formatLocationLabel returns location code and name", () => {
  expect(formatLocationLabel("A-12-3", "Shelf 3")).toBe("A-12-3 · Shelf 3");
});
