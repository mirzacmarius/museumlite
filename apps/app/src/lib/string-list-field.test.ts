import { describe, expect, test } from "vitest";
import {
  collectUniqueStringListValues,
  formatStringListField,
  parseStringListField,
  serializeStringListField,
} from "./string-list-field";

describe("parseStringListField", () => {
  test("parses JSON arrays into trimmed string lists", () => {
    expect(parseStringListField('[" Messing ","Bronze"]')).toEqual([
      "Messing",
      "Bronze",
    ]);
  });

  test("returns an empty list for empty values", () => {
    expect(parseStringListField("[]")).toEqual([]);
    expect(parseStringListField("")).toEqual([]);
    expect(parseStringListField(undefined)).toEqual([]);
  });

  test("preserves legacy plain-string values", () => {
    expect(parseStringListField("Oil on canvas")).toEqual(["Oil on canvas"]);
  });

  test("keeps non-list JSON as the original string", () => {
    expect(parseStringListField("123")).toEqual(["123"]);
    expect(parseStringListField("true")).toEqual(["true"]);
  });
});

describe("serializeStringListField", () => {
  test("serializes non-empty arrays as JSON", () => {
    expect(serializeStringListField([" Messing ", "Bronze"])).toBe(
      '["Messing","Bronze"]',
    );
  });

  test("returns undefined for empty arrays", () => {
    expect(serializeStringListField([])).toBeUndefined();
  });

  test("preserves plain strings", () => {
    expect(serializeStringListField("Oil on canvas")).toBe("Oil on canvas");
  });
});

describe("formatStringListField", () => {
  test("joins parsed values for display", () => {
    expect(formatStringListField('["Messing","Bronze"]')).toBe(
      "Messing, Bronze",
    );
  });

  test("returns the provided empty label when nothing is specified", () => {
    expect(formatStringListField("[]", "Not specified")).toBe("Not specified");
  });
});

describe("collectUniqueStringListValues", () => {
  test("unwraps JSON array object types and dedupes plain names", () => {
    expect(
      collectUniqueStringListValues([
        '["Painting"]',
        "Painting",
        '["Sculpture","Photograph"]',
        undefined,
      ]),
    ).toEqual(["Painting", "Photograph", "Sculpture"]);
  });
});
