import { describe, expect, it } from "vitest";
import {
  COMPLETENESS_LABELS,
  completenessFromText,
  distinctSubjectTerms,
  isNumberOfObjects,
  MEASURED_PART_LABELS,
  measuredPartFromText,
  measurementSetsFromJson,
  normalizeMeasurementSet,
  normalizeMeasurementSets,
  normalizeSubjects,
  subjectsThatFit,
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

  it("keeps the first subject terms that fit and returns the rest whole", () => {
    const long = "a".repeat(201);
    const terms = Array.from({ length: 52 }, (_, index) => `Term ${index}`);
    const { subjects, rest } = subjectsThatFit([
      long,
      ...terms.slice(0, 2),
      "term 0",
      ...terms.slice(2),
    ]);

    expect(subjects).toEqual(terms.slice(0, 50));
    expect(rest).toEqual([long, "Term 50", "Term 51"]);
    expect(subjectsThatFit([" Harbour ", "harbour"])).toEqual({
      subjects: ["Harbour"],
      rest: [],
    });
  });

  it("reads completeness and measured parts as codes or as the labels the app shows, in any letter case", () => {
    for (const [code, labels] of Object.entries(COMPLETENESS_LABELS)) {
      expect(completenessFromText(code.toUpperCase())).toBe(code);
      for (const label of labels) {
        expect(completenessFromText(label)).toBe(code);
        expect(completenessFromText(` ${label.toUpperCase()} `)).toBe(code);
      }
    }
    for (const [code, labels] of Object.entries(MEASURED_PART_LABELS)) {
      expect(measuredPartFromText(code)).toBe(code);
      for (const label of labels) {
        expect(measuredPartFromText(label)).toBe(code);
        expect(measuredPartFromText(label.toLowerCase())).toBe(code);
      }
    }
    expect(completenessFromText("Ufullstendig")).toBe("incomplete");
    expect(measuredPartFromText("med ramme")).toBe("framed");
    // A decomposed accent, as some spreadsheets write it.
    expect(measuredPartFromText("A\u0300 vue")).toBe("sight");
    expect(measuredPartFromText("lid")).toBeUndefined();
    expect(completenessFromText("broken")).toBeUndefined();
    expect(completenessFromText(undefined)).toBeUndefined();
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
    expect(
      measurementSetsFromJson('[{"part":"Sokkel","diameter":12}]'),
    ).toEqual([{ part: "base", diameter: 12 }]);
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
