import { describe, expect, test } from "vitest";

import { parseCSV } from "./import-csv";

describe("locations import CSV parsing", () => {
  test("reports a missing locationCode but keeps the row for the server", () => {
    const result = parseCSV("name,locationCode,type\nGallery A,,gallery");

    expect(result.rows).toEqual([
      { rowNumber: 2, name: "Gallery A", locationCode: "", type: "gallery" },
    ]);
    expect(result.errors).toEqual([{ type: "locationCodeRequired", row: 2 }]);
  });

  test("parses quoted values with their source line numbers", () => {
    const result = parseCSV(
      'name,locationCode,type,parentLocation\n\n"Shelf, A",SH-001,shelf,Storage A',
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 3,
        name: "Shelf, A",
        locationCode: "SH-001",
        type: "shelf",
        parentLocation: "Storage A",
      },
    ]);
  });

  test("rejects files without required columns or with unclosed quotes", () => {
    expect(parseCSV("name,type\nA,room").errors).toEqual([
      { type: "missingRequiredColumns", columns: "locationCode" },
    ]);
    expect(parseCSV('name,locationCode,type\n"A,B1,room').errors[0]?.type).toBe(
      "unreadableFile",
    );
  });
});
