import { describe, expect, test } from "vitest";
import { parseAccountCsv } from "./import-csv";

describe("account import CSV parsing", () => {
  test("keeps invalid rows with their source line for server-side failure", () => {
    const result = parseAccountCsv(
      'accountType,businessName,notes\nlender,"Gallery, Ltd",ok\n\nunknown,Museum,',
    );
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        accountType: "lender",
        businessName: "Gallery, Ltd",
        notes: "ok",
      },
      { rowNumber: 4, accountType: "unknown", businessName: "Museum" },
    ]);
    expect(result.rowErrors).toEqual([
      expect.stringContaining('Row 4: Invalid accountType "unknown"'),
    ]);
  });

  test("rejects files without the accountType column", () => {
    expect(parseAccountCsv("businessName\nGallery").fileErrors).toEqual([
      "Missing required columns: accountType",
    ]);
  });
});
