import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { describe, expect, test } from "vitest";
import {
  buildObjectDraftPayload,
  type CollectionFormRuleMessages,
  collectionFieldLocation,
  createFormDataFromDraftObject,
  createInitialFormData,
  EMPTY_EDIT_FORM,
  parseNumberOfObjects,
  validateCollectionFormData,
} from "./utils";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";

describe("object draft form serialization", () => {
  test("round trips catalog fields without serializing editor-only IDs", () => {
    const formData = createFormDataFromDraftObject({
      title: "Bronze vessel",
      accessionNumber: "2026.14",
      alternateAccessionNumbers: ["ALT-14"],
      collectionType: "general",
      previous_owners: ["B. Antiquarian"],
      dimensionDiameter: "43 mm",
      dimensionWeight: 2,
      weightUnit: "kg",
      ownershipHistory: [
        {
          owner: "A. Collector",
          startYear: "1890",
          endYear: "1910",
          description: "Inherited by the family",
          verified: true,
          verificationSource: "Estate inventory",
        },
      ],
      links: [{ url: "https://example.org/object", label: "Archive record" }],
      isPubliclyVisible: true,
      isHighResDownloadable: true,
      isSearchable: false,
      isValuationVisible: true,
    });

    expect(formData.ownershipHistory?.[0]?.localId).toBeTruthy();
    expect(formData.links?.[0]?.localId).toBeTruthy();

    const payload = buildObjectDraftPayload(formData);

    expect(payload).toMatchObject({
      title: "Bronze vessel",
      accessionNumber: "2026.14",
      alternateAccessionNumbers: ["ALT-14"],
      collectionType: "general",
      previous_owners: ["B. Antiquarian"],
      dimensionDiameter: "43 mm",
      dimensionWeight: 2,
      weightUnit: "kg",
      ownershipHistory: [
        {
          owner: "A. Collector",
          startYear: "1890",
          endYear: "1910",
          description: "Inherited by the family",
          verified: true,
          verificationSource: "Estate inventory",
        },
      ],
      links: [{ url: "https://example.org/object", label: "Archive record" }],
      isPubliclyVisible: true,
      isHighResDownloadable: true,
      isSearchable: false,
      isValuationVisible: true,
    });
    expect(payload.ownershipHistory?.[0]).not.toHaveProperty("localId");
    expect(payload.links?.[0]).not.toHaveProperty("localId");
  });

  test("keeps every catalog field an intake draft can hold", () => {
    const formData = createFormDataFromDraftObject({
      title: "Herring net",
      alternativeTitle: "Sildegarn",
      technique: "Knotted",
      dimensionHeight: 120,
      dimensionWidth: 340.5,
      dimensionDepth: 4,
      dimensionUnit: "cm",
      inscriptionMarks: [
        { label: "Owner's mark", description: "Burnt initials H.O." },
      ],
      tags: ["fishing", "coastal"],
      creditLine: "Gift of the Olsen family, 2026",
      legalRestrictions: true,
    });

    const payload = buildObjectDraftPayload(formData);

    expect(payload).toMatchObject({
      alternativeTitle: "Sildegarn",
      technique: "Knotted",
      dimensionHeight: 120,
      dimensionWidth: 340.5,
      dimensionDepth: 4,
      dimensionUnit: "cm",
      inscriptionMarks: [
        { label: "Owner's mark", description: "Burnt initials H.O." },
      ],
      tags: ["fishing", "coastal"],
      creditLine: "Gift of the Olsen family, 2026",
      legalRestrictions: true,
    });
    expect(payload.inscriptionMarks?.[0]).not.toHaveProperty("localId");
  });

  test("carries the structured date made as EDTF", () => {
    const formData = createFormDataFromDraftObject({
      title: "Amphora",
      dateCreated: "c. 500 BC",
      dateCreatedEdtf: "-0499~",
    });
    expect(formData.dateCreatedEdtf?.from).toMatchObject({
      year: "500",
      era: "bc",
      qualifier: "circa",
    });
    expect(buildObjectDraftPayload(formData)).toMatchObject({
      dateCreated: "c. 500 BC",
      dateCreatedEdtf: "-0499~",
    });
    expect(
      buildObjectDraftPayload(createFormDataFromDraftObject({ title: "Jar" }))
        .dateCreatedEdtf,
    ).toBeUndefined();
  });
});

describe("number of objects, subject, completeness, measured parts and rights", () => {
  test("an intake draft keeps them, and rows lose their editor ids", () => {
    const formData = createFormDataFromDraftObject({
      title: "Tea set",
      numberOfObjects: 12,
      subjects: ["Tea", "Chinoiserie"],
      completeness: "incomplete",
      completenessNote: "One cup missing",
      dimensionMeasuredPart: "overall",
      measurementSets: [
        { part: "other", partNote: "teapot lid", diameter: 8.5, unit: "cm" },
      ],
      rightsStatement: IN_COPYRIGHT,
    });

    expect(formData).toMatchObject({
      numberOfObjects: "12",
      subjects: ["Tea", "Chinoiserie"],
      completeness: "incomplete",
      completenessNote: "One cup missing",
      dimensionMeasuredPart: "overall",
      rightsStatement: IN_COPYRIGHT,
    });
    expect(formData.measurementSets?.[0]).toMatchObject({
      part: "other",
      partNote: "teapot lid",
      diameter: "8.5",
      height: "",
      unit: "cm",
    });
    expect(formData.measurementSets?.[0]?.localId).toBeTruthy();

    expect(buildObjectDraftPayload(formData)).toMatchObject({
      numberOfObjects: 12,
      subjects: ["Tea", "Chinoiserie"],
      completeness: "incomplete",
      completenessNote: "One cup missing",
      dimensionMeasuredPart: "overall",
      measurementSets: [
        { part: "other", partNote: "teapot lid", diameter: 8.5, unit: "cm" },
      ],
      rightsStatement: IN_COPYRIGHT,
    });
  });

  test("blank inputs and untouched rows are left out of an intake draft", () => {
    const payload = buildObjectDraftPayload({
      ...createFormDataFromDraftObject({ title: "Jar" }),
      numberOfObjects: " ",
      subjects: [" ", "Storage "],
      completenessNote: "  ",
      measurementSets: [
        {
          localId: "row-1",
          partNote: "",
          height: "",
          width: "",
          depth: "",
          diameter: "",
          weight: "",
          unit: "",
          weightUnit: "",
        },
      ],
    });

    expect(payload.numberOfObjects).toBeUndefined();
    expect(payload.subjects).toEqual(["Storage"]);
    expect(payload.completeness).toBeUndefined();
    expect(payload.completenessNote).toBeUndefined();
    expect(payload.dimensionMeasuredPart).toBeUndefined();
    expect(payload.measurementSets).toEqual([]);
    expect(payload.rightsStatement).toBeUndefined();
  });

  test("an Object opens in the edit form with them filled in", () => {
    const formData = createInitialFormData({
      _id: "object-1",
      title: "Tea set",
      numberOfObjects: 12,
      subjects: ["Tea"],
      completeness: "fragment",
      completenessNote: "Shards only",
      dimensionMeasuredPart: "framed",
      measurementSets: [{ part: "base", width: 30, unit: "cm" }],
      rightsStatement: IN_COPYRIGHT,
    } as CollectionDoc);

    expect(formData).toMatchObject({
      numberOfObjects: "12",
      subjects: ["Tea"],
      completeness: "fragment",
      completenessNote: "Shards only",
      dimensionMeasuredPart: "framed",
      rightsStatement: IN_COPYRIGHT,
    });
    expect(formData.measurementSets?.[0]).toMatchObject({
      part: "base",
      width: "30",
      unit: "cm",
    });

    const unset = createInitialFormData({
      _id: "object-2",
      title: "Jar",
    } as CollectionDoc);
    expect(unset).toMatchObject({
      numberOfObjects: "",
      subjects: [],
      completenessNote: "",
      measurementSets: [],
    });
    expect(unset.completeness).toBeUndefined();
    expect(unset.rightsStatement).toBeUndefined();
  });

  test("a number of objects is blank or a whole number from 1", () => {
    expect(parseNumberOfObjects("")).toEqual({
      isValid: true,
      value: undefined,
    });
    expect(parseNumberOfObjects(" 12 ")).toEqual({ isValid: true, value: 12 });
    expect(parseNumberOfObjects("100000").value).toBe(100000);
    for (const typed of ["0", "1.5", "-3", "12a", "100001"]) {
      expect(parseNumberOfObjects(typed).isValid).toBe(false);
    }
  });

  test("their fields open on the tab that holds them", () => {
    expect(collectionFieldLocation("numberOfObjects").tab).toBe("general");
    expect(collectionFieldLocation("subjects").tab).toBe("general");
    for (const field of [
      "dimensionMeasuredPart",
      "measurementSets",
      "completeness",
      "completenessNote",
    ]) {
      expect(collectionFieldLocation(field)).toEqual({
        tab: "physical",
        elementId: field,
      });
    }
    expect(collectionFieldLocation("rightsStatement")).toEqual({
      tab: "accession",
      elementId: "rightsStatement",
    });
  });
});

describe("catalog form rules", () => {
  const messages: CollectionFormRuleMessages = {
    titleRequired: "title required",
    weightInvalid: "weight invalid",
    measurementInvalid: "measurement invalid",
    productionDateInvalid: "date invalid",
    productionDateOpenInRange: "date open",
    numberOfObjectsInvalid: "count invalid",
    subjectsInvalid: "subjects invalid",
    measurementSetPartRequired: "part required",
    measurementSetsInvalid: "sets invalid",
    completenessNoteTooLong: "note too long",
  };
  const row = {
    partNote: "",
    height: "",
    width: "",
    depth: "",
    diameter: "",
    weight: "",
    unit: "",
    weightUnit: "",
  };
  const errorsFor = (values: Partial<typeof EMPTY_EDIT_FORM>) =>
    validateCollectionFormData(
      { ...EMPTY_EDIT_FORM, title: "Vase", ...values },
      messages,
    );

  test("accept the limits the server accepts", () => {
    expect(
      errorsFor({
        numberOfObjects: "2",
        subjects: Array.from({ length: 50 }, (_, index) => `Term ${index}`),
        measurementSets: [
          row,
          { ...row, part: "framed", height: "60,5", unit: "cm" },
        ],
        completenessNote: "a".repeat(4000),
      }),
    ).toEqual({});
  });

  test("refuse what the server would refuse, at the field", () => {
    expect(errorsFor({ numberOfObjects: "0" })).toEqual({
      numberOfObjects: "count invalid",
    });
    expect(
      errorsFor({
        subjects: Array.from({ length: 51 }, (_, index) => `Term ${index}`),
      }),
    ).toEqual({ subjects: "subjects invalid" });
    expect(errorsFor({ subjects: ["a".repeat(201)] })).toEqual({
      subjects: "subjects invalid",
    });
    expect(errorsFor({ completenessNote: "a".repeat(4001) })).toEqual({
      completenessNote: "note too long",
    });
  });

  test("ask for each further set's part before its values", () => {
    expect(
      errorsFor({
        measurementSets: [
          { ...row, part: "base", height: "0" },
          { ...row, width: "12" },
        ],
      }),
    ).toEqual({ measurementSets: "part required" });
    expect(
      errorsFor({ measurementSets: [{ ...row, part: "base", height: "0" }] }),
    ).toEqual({ measurementSets: "sets invalid" });
    expect(
      errorsFor({ measurementSets: [{ ...row, part: "base", unit: "cm" }] }),
    ).toEqual({ measurementSets: "sets invalid" });
    expect(
      errorsFor({
        measurementSets: Array.from({ length: 21 }, () => ({
          ...row,
          part: "base" as const,
          height: "1",
        })),
      }),
    ).toEqual({ measurementSets: "sets invalid" });
  });
});
