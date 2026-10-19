import { expect, test } from "vitest";
import { toTemplateRows } from "./use-data-import";

const OBJECTS = {
  headers: ["accessionNumber", "title", "location"],
  exampleRow: [],
  description: "",
  requiredFields: ["title"],
};

function translate(key: string, values?: Record<string, string | number>) {
  return `${key}:${JSON.stringify(values ?? {})}`;
}

test("a semicolon-separated export from a Norwegian spreadsheet imports by column name", () => {
  expect(
    toTemplateRows(
      "﻿accessionNumber;Title;dimensions\nFM-1;Vase;12,5 cm\nFM-2;;\n",
      OBJECTS,
      translate as never,
    ),
  ).toEqual([
    { rowNumber: 2, accessionNumber: "FM-1", title: "Vase" },
    { rowNumber: 3, accessionNumber: "FM-2", title: "" },
  ]);
});

test("a file without a required column is refused before any row is sent", () => {
  expect(() =>
    toTemplateRows(
      "Inventarnr;Tittel\nFM-1;Vase\n",
      OBJECTS,
      translate as never,
    ),
  ).toThrow('missingColumns:{"missing":"title","found":"Inventarnr, Tittel"}');
});
