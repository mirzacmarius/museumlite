import { expect, test } from "vitest";
import {
  describeObjectDescriptionValue,
  formatDimensions,
  formatMeasuredPart,
  formatMeasurementSet,
  measurementSetLines,
  type ObjectDescriptionFormat,
} from "./object-description-format";

const PARTS = { overall: "Overall", framed: "Framed", other: "Other" };

const format: ObjectDescriptionFormat = {
  measurements: {
    labels: { height: "H", width: "W", depth: "D" },
    number: (value) => value.toLocaleString("en"),
    part: (part) => PARTS[part as keyof typeof PARTS] ?? part,
  },
  completeness: (value) => `completeness:${value}`,
  rightsStatement: (uri) => `name of ${uri}`,
};

test("dimensions read as labelled numbers with the unit only when recorded", () => {
  expect(
    formatDimensions({ height: 60, width: 45.5 }, " cm ", format.measurements),
  ).toBe("H: 60 × W: 45.5 cm");
  expect(formatDimensions({ depth: 0 }, undefined, format.measurements)).toBe(
    "D: 0",
  );
  expect(formatDimensions({}, "cm", format.measurements)).toBeUndefined();
});

test("a measured part reads with its note", () => {
  expect(formatMeasuredPart("other", " lid ", format.measurements)).toBe(
    "Other (lid)",
  );
  expect(formatMeasuredPart("framed", "  ", format.measurements)).toBe(
    "Framed",
  );
});

test("a further set reads on one line with its diameter and weight", () => {
  expect(
    formatMeasurementSet(
      {
        part: "framed",
        height: 60,
        width: 40,
        diameter: 12,
        unit: "cm",
        weight: 3,
        weightUnit: "kg",
      },
      format.measurements,
    ),
  ).toBe("Framed: H: 60 × W: 40 cm, Ø 12 cm, 3 kg");
  expect(
    formatMeasurementSet(
      { part: "other", partNote: "lid", weight: 1200 },
      format.measurements,
    ),
  ).toBe("Other (lid): 1,200");
});

test("stored description values read as names, numbers and lists", () => {
  const describe = (field: string, value: unknown) =>
    describeObjectDescriptionValue(field, value, format);

  expect(describe("numberOfObjects", 12000)).toBe("12,000");
  expect(describe("subjects", ["Portrait", " ", "Merchant "])).toBe(
    "Portrait, Merchant",
  );
  expect(describe("completeness", "fragment")).toBe("completeness:fragment");
  expect(describe("completenessNote", " Lid missing ")).toBe("Lid missing");
  expect(describe("dimensionMeasuredPart", "framed")).toBe("Framed");
  expect(
    describe("measurementSets", [
      { part: "framed", height: 60, unit: "cm" },
      { part: "not-a-part", height: 1 },
      { part: "other", partNote: "lid", width: 4 },
    ]),
  ).toBe("Framed: H: 60 cm; Other (lid): W: 4");
  expect(
    describe("rightsStatement", "http://rightsstatements.org/vocab/InC/1.0/"),
  ).toBe("name of http://rightsstatements.org/vocab/InC/1.0/");
});

test("cleared and unknown values state nothing", () => {
  const describe = (field: string, value: unknown) =>
    describeObjectDescriptionValue(field, value, format);

  expect(describe("numberOfObjects", null)).toBeNull();
  expect(describe("subjects", [])).toBeNull();
  expect(describe("completeness", "broken")).toBeNull();
  expect(describe("completenessNote", "")).toBeNull();
  expect(describe("dimensionMeasuredPart", null)).toBeNull();
  expect(describe("measurementSets", [])).toBeNull();
  expect(describe("rightsStatement", "https://example.org/rights")).toBeNull();
  expect(describe("culture", "Roman")).toBeNull();
});

test("further sets that read alike keep keys of their own", () => {
  expect(
    measurementSetLines(
      [
        { part: "framed", height: 60 },
        { part: "framed", height: 60 },
        { part: "base", width: 30 },
      ],
      format.measurements,
    ),
  ).toEqual([
    { key: "Framed: H: 60#0", line: "Framed: H: 60" },
    { key: "Framed: H: 60#1", line: "Framed: H: 60" },
    { key: "base: W: 30#0", line: "base: W: 30" },
  ]);
});
