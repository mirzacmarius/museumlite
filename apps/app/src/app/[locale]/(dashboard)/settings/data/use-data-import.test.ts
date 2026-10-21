import { expect, test } from "vitest";
import { toTemplateRows } from "./use-data-import";

const OBJECTS = {
  headers: ["accessionNumber", "title", "location"],
  exampleRow: [],
  description: "",
  requiredFields: ["title"],
};

test("a semicolon-separated export from a Norwegian spreadsheet imports by column name", () => {
  expect(
    toTemplateRows(
      "﻿accessionNumber;Title;dimensions\nFM-1;Vase;12,5 cm\nFM-2;;\n",
      OBJECTS,
    ),
  ).toEqual({
    rows: [
      { rowNumber: 2, accessionNumber: "FM-1", title: "Vase" },
      { rowNumber: 3, accessionNumber: "FM-2", title: "" },
    ],
  });
});

test("a Norwegian catalogue export imports by its own column names, without its Locations", () => {
  expect(
    toTemplateRows(
      "Tittel;Id;Sist endret;Id;Plassering\nKlubbe : Sandsten;10647;22.11.2016;99;Magasin 2\n",
      OBJECTS,
    ),
  ).toEqual({
    rows: [
      {
        rowNumber: 2,
        accessionNumber: "10647",
        title: "Klubbe : Sandsten",
      },
    ],
  });
});

test("the template's own column name wins over a Norwegian alias", () => {
  expect(
    toTemplateRows("Id;accessionNumber;title\n7;FM-1;Vase\n", OBJECTS),
  ).toEqual({
    rows: [{ rowNumber: 2, accessionNumber: "FM-1", title: "Vase" }],
  });
});

test("the template's own location column still imports", () => {
  expect(toTemplateRows("title;location\nVase;Magasin 2\n", OBJECTS)).toEqual({
    rows: [{ rowNumber: 2, title: "Vase", location: "Magasin 2" }],
  });
});

test("a file without a required column is refused before any row is sent", () => {
  expect(toTemplateRows("Navn;Dato\nVase;1850\n", OBJECTS)).toEqual({
    refusal: {
      code: "missingColumns",
      missing: ["title"],
      found: ["Navn", "Dato"],
    },
  });
});

test("a file without data rows is refused", () => {
  expect(toTemplateRows("title;location\n", OBJECTS)).toEqual({
    refusal: { code: "noDataRows" },
  });
});
