import { describe, expect, test } from "vitest";

import { parseCSV } from "./import-csv";

describe("locations import CSV parsing", () => {
  test("requires locationCode values", () => {
    const result = parseCSV(`name,locationCode,type\nGallery A,,gallery`);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      {
        type: "locationCodeRequired",
        row: 2,
      },
    ]);
  });

  test("parses locationCode values into preview rows", () => {
    const result = parseCSV(
      `name,locationCode,type,parentLocation\nShelf A,SH-001,shelf,Storage A`,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        name: "Shelf A",
        locationCode: "SH-001",
        type: "shelf",
        parentLocation: "Storage A",
      },
    ]);
  });
});
