import { describe, expect, test } from "vitest";
import {
  csvTextCell,
  protectSpreadsheetText,
  quotedCsvText,
} from "./spreadsheetText";

describe("spreadsheet text cells", () => {
  test("protectSpreadsheetText prefixes formulas and leading control characters", () => {
    expect(protectSpreadsheetText("Lender Inc")).toBe("Lender Inc");
    expect(protectSpreadsheetText('=HYPERLINK("https://x.test")')).toBe(
      '\'=HYPERLINK("https://x.test")',
    );
    expect(protectSpreadsheetText("+1 555 0100")).toBe("'+1 555 0100");
    expect(protectSpreadsheetText("  -5")).toBe("'  -5");
    expect(protectSpreadsheetText("@sum")).toBe("'@sum");
    expect(protectSpreadsheetText("\tindented")).toBe("'\tindented");
  });

  test("quotedCsvText doubles quotes", () => {
    expect(quotedCsvText('say "hi"')).toBe('"say ""hi"""');
  });

  test("csvTextCell quotes text with formulas disarmed", () => {
    expect(csvTextCell("Lender Inc")).toBe('"Lender Inc"');
    expect(csvTextCell('=HYPERLINK("https://x.test","open")')).toBe(
      '"\'=HYPERLINK(""https://x.test"",""open"")"',
    );
    expect(csvTextCell("a,b\nc")).toBe('"a,b\nc"');
    expect(csvTextCell("")).toBe('""');
  });
});
