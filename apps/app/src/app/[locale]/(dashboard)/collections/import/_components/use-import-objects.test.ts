import { expect, test } from "vitest";
import { parseCsvObjects } from "@/lib/csv-parser";
import {
  MAX_IMPORT_ROWS,
  OBJECT_IMPORT_TEMPLATE_CSV,
  OPTIONAL_COLUMNS,
  REQUIRED_COLUMNS,
  TARGET_FIELDS,
} from "./import-objects-types";
import { mapRawRows } from "./use-import-objects";

const readCsv = (text: string) =>
  parseCsvObjects(text, { maxRows: MAX_IMPORT_ROWS });

test("every template column is a field the wizard maps, the structured date right after the date made (MUS-857)", () => {
  const { headers } = readCsv(OBJECT_IMPORT_TEMPLATE_CSV);

  expect(
    headers.filter((header) => !TARGET_FIELDS.some((f) => f.id === header)),
  ).toEqual([]);
  expect(headers.indexOf("dateCreatedEdtf")).toBe(
    headers.indexOf("dateCreated") + 1,
  );
});

test("the wizard maps every column the server's row reads, in one order (MUS-865)", () => {
  expect(TARGET_FIELDS.map((field) => field.id)).toEqual([
    ...REQUIRED_COLUMNS,
    ...OPTIONAL_COLUMNS,
  ]);
});

test("the template's example row imports with its structured date, subject, completeness, measured parts and rights statement (MUS-857, MUS-865)", () => {
  expect(mapRawRows(readCsv(OBJECT_IMPORT_TEMPLATE_CSV).rows, [])).toEqual({
    rows: [
      {
        rowNumber: 2,
        title: "Portrait of a Lady",
        accessionNumber: "2024.001",
        creator: "Unknown Artist",
        objectType: "painting",
        numberOfObjects: "1",
        culture: "European",
        period: "19th Century",
        dateCreated: "c. 1850",
        dateCreatedEdtf: "1850~",
        materials: "Oil on canvas",
        dimensions: "24 x 18 inches",
        dimensionMeasuredPart: "unframed",
        measurementSets:
          '[{"part":"framed","height":30,"width":24,"unit":"in"}]',
        subjects: "Portraits; Women",
        condition: "Good",
        completeness: "complete",
        completenessNote: "With its original frame",
        rightsStatement: "https://creativecommons.org/publicdomain/mark/1.0/",
        location: "Main Gallery",
        collectionGroup: "European Art",
        collectionGroups: '["European Art"]',
      },
    ],
    validationErrors: [],
  });
});

test("columns mapped from another system's names import the new fields as written (MUS-865)", () => {
  const { rows } = readCsv(
    'Title,Count,Keywords,State,Rights,Parts\nTeapot,2,"Tea; Ceramics",fragment,CC BY 4.0,"[{""part"":""other"",""partNote"":""lid"",""diameter"":8.5}]"\n',
  );

  expect(
    mapRawRows(rows, [
      { sourceField: "Title", targetField: "title" },
      { sourceField: "Count", targetField: "numberOfObjects" },
      { sourceField: "Keywords", targetField: "subjects" },
      { sourceField: "State", targetField: "completeness" },
      { sourceField: "Rights", targetField: "rightsStatement" },
      { sourceField: "Parts", targetField: "measurementSets" },
    ]).rows,
  ).toEqual([
    {
      rowNumber: 2,
      title: "Teapot",
      numberOfObjects: "2",
      subjects: "Tea; Ceramics",
      completeness: "fragment",
      rightsStatement: "CC BY 4.0",
      measurementSets: '[{"part":"other","partNote":"lid","diameter":8.5}]',
    },
  ]);
});

test("a structured date mapped from another column name imports (MUS-857)", () => {
  const { rows } = readCsv("Title,Dated,EDTF\nKrukke,500 BC,'-0499\n");

  expect(
    mapRawRows(rows, [
      { sourceField: "Title", targetField: "title" },
      { sourceField: "Dated", targetField: "dateCreated" },
      { sourceField: "EDTF", targetField: "dateCreatedEdtf" },
    ]).rows,
  ).toEqual([
    {
      rowNumber: 2,
      title: "Krukke",
      dateCreated: "500 BC",
      dateCreatedEdtf: "'-0499",
    },
  ]);
});
