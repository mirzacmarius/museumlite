import { expect, test } from "vitest";
import { parseCsvObjects } from "@/lib/csv-parser";
import {
  MAX_IMPORT_ROWS,
  OBJECT_IMPORT_TEMPLATE_CSV,
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

test("the template's example row imports with its structured date (MUS-857)", () => {
  expect(mapRawRows(readCsv(OBJECT_IMPORT_TEMPLATE_CSV).rows, [])).toEqual({
    rows: [
      {
        rowNumber: 2,
        title: "Portrait of a Lady",
        accessionNumber: "2024.001",
        creator: "Unknown Artist",
        objectType: "painting",
        culture: "European",
        period: "19th Century",
        dateCreated: "c. 1850",
        dateCreatedEdtf: "1850~",
        materials: "Oil on canvas",
        dimensions: "24 x 18 inches",
        condition: "Good",
        location: "Main Gallery",
        collectionGroup: "European Art",
        collectionGroups: '["European Art"]',
      },
    ],
    validationErrors: [],
  });
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
