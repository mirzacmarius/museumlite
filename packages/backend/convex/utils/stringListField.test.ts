import { describe, expect, test } from "vitest";
import {
  parseStoredStringList,
  storedStringListIncludes,
} from "./stringListField";

describe("parseStoredStringList", () => {
  test("parses JSON arrays into trimmed string lists", () => {
    expect(parseStoredStringList('[" Painting ","Sculpture"]')).toEqual([
      "Painting",
      "Sculpture",
    ]);
  });

  test("preserves legacy plain-string values", () => {
    expect(parseStoredStringList("Painting")).toEqual(["Painting"]);
  });

  test("returns an empty list for empty values", () => {
    expect(parseStoredStringList("[]")).toEqual([]);
    expect(parseStoredStringList("")).toEqual([]);
    expect(parseStoredStringList(undefined)).toEqual([]);
  });
});

describe("storedStringListIncludes", () => {
  test("matches a type stored as a JSON array", () => {
    expect(storedStringListIncludes('["Painting"]', "Painting")).toBe(true);
    expect(
      storedStringListIncludes('["Painting","Sculpture"]', "Sculpture"),
    ).toBe(true);
  });

  test("matches a legacy plain-string type", () => {
    expect(storedStringListIncludes("Painting", "Painting")).toBe(true);
  });

  test("does not match unrelated types", () => {
    expect(storedStringListIncludes('["Painting"]', "Sculpture")).toBe(false);
    expect(storedStringListIncludes(undefined, "Painting")).toBe(false);
  });
});
