import { describe, expect, test } from "vitest";
import {
  CATEGORY_LINE_LIMIT,
  LINE_LENGTH_LIMIT,
  type ObjectIdSheetCollection,
  type ObjectIdSheetFormat,
  objectIdCategoryValues,
  SHORT_DESCRIPTION_LIMIT,
  shortDescription,
} from "./object-id-sheet-data";

const bare: ObjectIdSheetCollection = { title: "Bronze coin" };

const englishFormat: ObjectIdSheetFormat = {
  measurementLabels: { height: "H", width: "W", depth: "D" },
  number: (value) => value.toLocaleString("en-US"),
};

function valuesOf(
  collection: ObjectIdSheetCollection,
  distinguishingFeatures: string[] = [],
  format: ObjectIdSheetFormat = englishFormat,
) {
  return objectIdCategoryValues({
    collection,
    distinguishingFeatures,
    format,
  });
}

function linesOf(
  collection: ObjectIdSheetCollection,
  distinguishingFeatures: string[] = [],
) {
  return Object.fromEntries(
    valuesOf(collection, distinguishingFeatures).map((value) => [
      value.category,
      value.lines,
    ]),
  );
}

describe("objectIdCategoryValues", () => {
  test("prints the nine checklist categories in order, empty when not recorded", () => {
    const values = valuesOf(bare);
    expect(values.map((value) => value.category)).toEqual([
      "type_of_object",
      "materials_and_techniques",
      "measurements",
      "inscriptions_and_markings",
      "distinguishing_features",
      "title",
      "subject",
      "date_or_period",
      "maker",
    ]);
    expect(values.filter((value) => value.lines.length === 0)).toHaveLength(8);
    expect(linesOf(bare).title).toEqual(["Bronze coin"]);
  });

  test("reads stored lists, measured dimensions and inscription marks", () => {
    const lines = linesOf(
      {
        title: "Portrait of a man",
        alternativeTitle: "The merchant",
        objectType: '["Painting","Oil painting"]',
        objectName: "Portrait",
        materials: '["Oil paint","Canvas"]',
        technique: "Glazing",
        dimensionHeight: 60,
        dimensionWidth: 45.5,
        dimensionUnit: "cm",
        dimensionWeight: 3,
        dimensions: "60 x 45 cm (ignored once measured)",
        inscriptions: "Signed lower right",
        inscriptionMarks: [
          { label: "Verso", description: "Stamp of the Durand gallery" },
          { label: "Frame", description: "   " },
        ],
        tags: ["Portrait", "Merchant"],
        dateCreated: "1652",
        period: "Dutch Golden Age",
        creator: "Unknown Dutch painter",
      },
      ["Stable", "Lower left corner: old tear, repaired"],
    );
    expect(lines.type_of_object).toEqual([
      "Painting, Oil painting",
      "Portrait",
    ]);
    expect(lines.materials_and_techniques).toEqual([
      "Oil paint, Canvas",
      "Glazing",
    ]);
    expect(lines.measurements).toEqual(["H: 60 × W: 45.5 cm", "3 kg"]);
    expect(lines.inscriptions_and_markings).toEqual([
      "Signed lower right",
      "Verso: Stamp of the Durand gallery",
    ]);
    expect(lines.distinguishing_features).toEqual([
      "Stable",
      "Lower left corner: old tear, repaired",
    ]);
    expect(lines.title).toEqual(["Portrait of a man", "The merchant"]);
    expect(lines.subject).toEqual(["Portrait, Merchant"]);
    expect(lines.date_or_period).toEqual(["1652", "Dutch Golden Age"]);
    expect(lines.maker).toEqual(["Unknown Dutch painter"]);
  });

  test("keeps free-text dimensions and a diameter from older records", () => {
    expect(
      linesOf({
        title: "Plate",
        dimensions: "approx. 30 cm across",
        dimensionDiameter: "30",
      }).measurements,
    ).toEqual(["Ø 30", "approx. 30 cm across"]);
  });

  test("prints measurements with the app language's labels and number format", () => {
    const values = valuesOf(
      {
        title: "Armoire",
        dimensionHeight: 210,
        dimensionWidth: 1450.5,
        dimensionDepth: 60,
        dimensionWeight: 120.5,
        dimensionUnit: "mm",
      },
      [],
      {
        measurementLabels: { height: "H", width: "L", depth: "P" },
        number: (value) => String(value).replace(".", ","),
      },
    );
    expect(
      values.find((value) => value.category === "measurements")?.lines,
    ).toEqual(["H: 210 × L: 1450,5 × P: 60 mm", "120,5 kg"]);
  });

  test("counts the lines a one-page sheet has no room for and clips long ones", () => {
    const observations = Array.from(
      { length: CATEGORY_LINE_LIMIT + 3 },
      (_, index) => `Area ${index + 1}: ${"x".repeat(LINE_LENGTH_LIMIT + 20)}`,
    );
    const features = valuesOf(bare, observations).find(
      (value) => value.category === "distinguishing_features",
    );
    expect(features?.lines).toHaveLength(CATEGORY_LINE_LIMIT);
    expect(features?.omitted).toBe(3);
    expect(features?.lines[0]).toHaveLength(LINE_LENGTH_LIMIT);
    expect(features?.lines[0]?.endsWith("…")).toBe(true);
    expect(valuesOf(bare).every((value) => value.omitted === 0)).toBe(true);
  });
});

describe("shortDescription", () => {
  test("clips a long description to the page", () => {
    expect(shortDescription("  ")).toBeUndefined();
    expect(shortDescription("Short.")).toBe("Short.");
    const long = "x".repeat(SHORT_DESCRIPTION_LIMIT + 50);
    const clipped = shortDescription(long);
    expect(clipped).toHaveLength(SHORT_DESCRIPTION_LIMIT);
    expect(clipped?.endsWith("…")).toBe(true);
  });
});
