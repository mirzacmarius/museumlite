import { describe, expect, it } from "vitest";
import { getImportValidationCopy } from "./import-validation-copy";

const translate = (key: string, values?: Record<string, string | number>) =>
  `${key}${values ? `: ${values.methods}` : ""}`;

describe("getImportValidationCopy", () => {
  it("translates known import diagnostics while preserving method identifiers", () => {
    expect(getImportValidationCopy("Title is required", translate)).toBe(
      "untranslatedComponents.importValidation.titleRequired",
    );
    expect(
      getImportValidationCopy("Accession number is required", translate),
    ).toBe("untranslatedComponents.importValidation.accessionNumberRequired");
    expect(
      getImportValidationCopy(
        "Invalid method. Must be one of: gift, purchase, transfer",
        translate,
      ),
    ).toBe(
      "untranslatedComponents.importValidation.invalidMethod: gift, purchase, transfer",
    );
  });

  it("preserves messages that are not a known backend diagnostic", () => {
    expect(getImportValidationCopy("Custom importer note", translate)).toBe(
      "Custom importer note",
    );
  });
});
