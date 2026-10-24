import { describe, expect, it } from "vitest";
import {
  distinctSubjectTerms,
  isNumberOfObjects,
  measurementSetsFromJson,
  normalizeMeasurementSet,
  normalizeMeasurementSets,
  normalizeSubjects,
} from "./objectDescription";

describe("object description values", () => {
  it("counts whole numbers from 1 to 100000", () => {
    expect(isNumberOfObjects(1)).toBe(true);
    expect(isNumberOfObjects(100_000)).toBe(true);
    for (const count of [0, -1, 1.5, 100_001, Number.NaN])
      expect(isNumberOfObjects(count)).toBe(false);
  });

  it("keeps subject terms trimmed and distinct in any letter case", () => {
    expect(
      distinctSubjectTerms([" Harbour ", "", "harbour", "Pilots"]),
    ).toEqual(["Harbour", "Pilots"]);
    expect(normalizeSubjects(["a".repeat(200)])).toEqual(["a".repeat(200)]);
    expect(normalizeSubjects(["a".repeat(201)])).toBeNull();
    const terms = Array.from({ length: 51 }, (_, index) => `Term ${index}`);
    expect(normalizeSubjects(terms)).toBeNull();
    // Repeats do not count towards the limit.
    expect(normalizeSubjects([...terms.slice(0, 50), "term 0"])).toHaveLength(
      50,
    );
  });

  it("stores a set of measurements with at least one value above 0", () => {
    expect(
      normalizeMeasurementSet({
        part: "other",
        partNote: "  Lid ",
        height: 4,
        unit: " ",
      }),
    ).toEqual({ part: "other", partNote: "Lid", height: 4 });
    expect(normalizeMeasurementSet({ part: "base" })).toBeNull();
    expect(normalizeMeasurementSet({ part: "base", width: 0 })).toBeNull();
    expect(
      normalizeMeasurementSet({
        part: "base",
        width: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
    expect(
      normalizeMeasurementSet({
        part: "base",
        width: 1,
        unit: "c".repeat(201),
      }),
    ).toBeNull();
    expect(
      normalizeMeasurementSets(
        Array.from({ length: 21 }, () => ({ part: "base" as const, width: 1 })),
      ),
    ).toBeNull();
  });

  it("reads further sets from the JSON an export writes", () => {
    expect(
      measurementSetsFromJson(
        '[{"part":"Unframed","height":20,"width":32,"unit":"in"}]',
      ),
    ).toEqual([{ part: "unframed", height: 20, width: 32, unit: "in" }]);
    expect(measurementSetsFromJson("[]")).toEqual([]);
    for (const text of [
      "not json",
      '{"part":"base","width":1}',
      '[{"part":"lid","width":1}]',
      '[{"part":"base","width":"1"}]',
      '[{"part":"base"}]',
      "[null]",
    ])
      expect(measurementSetsFromJson(text)).toBeNull();
  });
});
