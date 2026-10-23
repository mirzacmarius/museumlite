// @vitest-environment jsdom

import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { importRefusal } from "@v1/backend/convex/utils/importErrors";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import type { ImportType } from "./data-csv-utils";
import { toTemplateRows, useDataImport } from "./use-data-import";

const toasts = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));
const query = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());
const mutation = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: toasts }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("convex/react", () => ({
  useMutation: () => mutation,
  useConvex: () => ({ query }),
}));

const OBJECTS = {
  headers: ["accessionNumber", "title", "location"],
  exampleRow: [],
  description: "",
  requiredFields: ["title"],
};

beforeEach(() => {
  for (const toast of Object.values(toasts)) toast.mockReset();
  mutation.mockReset();
  query.mockReset();
  captureException.mockReset();
  query.mockResolvedValue(OBJECTS);
});

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

test("an empty file, or one of blank lines, is refused as having no data rows", () => {
  for (const text of ["", "\n\n", "\ufeff"]) {
    expect(toTemplateRows(text, OBJECTS)).toEqual({
      refusal: { code: "noDataRows" },
    });
  }
});

test("a quotation mark that is never closed is refused with its row", () => {
  expect(toTemplateRows('title\nVase\n"Krukke\nSkål\n', OBJECTS)).toEqual({
    refusal: { code: "unclosedQuote", row: 3 },
  });
});

let dataImport: ReturnType<typeof useDataImport> | undefined;

function ImportFile({ type }: { type: ImportType }) {
  dataImport = useDataImport("org-1" as Id<"organizations">, type, OBJECTS);
  return (
    <input
      type="file"
      aria-label="Choose file"
      ref={dataImport.fileInputRef}
      onChange={dataImport.handleFileSelect}
    />
  );
}

// The file is read and fingerprinted after the upload returns, so a test
// waits for what it shows.
async function chooseFile(text: string, name: string, type: ImportType) {
  await renderOnPage(<ImportFile type={type} />, "/en/settings/data");
  await userEvent
    .setup()
    .upload(screen.getByLabelText("Choose file"), new File([text], name));
}

test.each([
  ["", "The file has no data rows."],
  [
    'title\n"Vase\n',
    "A quotation mark in row 2 is never closed, so the file cannot be read. Check the quotation marks in that row.",
  ],
  [
    "Navn;Dato\nVase;1850\n",
    "The file has no title column, so no row can be imported. Use the template's column names. Columns found: Navn, Dato.",
  ],
])("a refused file says why before any row is sent: %j", async (text, message) => {
  await chooseFile(text, "catalogue.csv", "objects");

  await waitFor(() => expect(toasts.error).toHaveBeenCalledWith(message));
  expect(mutation).not.toHaveBeenCalled();
});

test("an XML file is refused for anything but objects", async () => {
  await chooseFile("<records/>", "records.xml", "accessions");

  await waitFor(() =>
    expect(toasts.error).toHaveBeenCalledWith(
      "XML import is only supported for objects.",
    ),
  );
  expect(mutation).not.toHaveBeenCalled();
});

test("a refused corrected file resolves with why, and sends no row", async () => {
  await renderOnPage(<ImportFile type="objects" />, "/en/settings/data");

  let refusal: string | undefined;
  await act(async () => {
    refusal = await dataImport?.uploadCorrection(
      { _id: "job-1" as Id<"importJobs">, entityType: "objects" },
      new File([""], "corrected.csv"),
    );
  });

  expect(refusal).toBe("The file has no data rows.");
  expect(mutation).not.toHaveBeenCalled();
});

test("a Dublin Core file the server refuses says why in the app's language (MUS-845)", async () => {
  query.mockResolvedValueOnce(null);
  mutation
    .mockResolvedValueOnce("job-1")
    .mockRejectedValueOnce(
      importRefusal("DUBLIN_CORE_TOO_MANY_RECORDS", { limit: 50 }),
    );

  await chooseFile("<records/>", "records.xml", "objects");

  await waitFor(() =>
    expect(toasts.error).toHaveBeenCalledWith(
      "A Dublin Core file can have at most 50 records. Split the file and import each part.",
    ),
  );
  expect(captureException).not.toHaveBeenCalled();
});

test("a failure without a code shows the fallback and is reported (MUS-844)", async () => {
  const failure = new Error(
    "[CONVEX M(imports:importObjectsDublinCore)] Server Error",
  );
  query.mockResolvedValueOnce(null);
  mutation.mockResolvedValueOnce("job-1").mockRejectedValueOnce(failure);

  await chooseFile("<records/>", "records.xml", "objects");

  await waitFor(() =>
    expect(toasts.error).toHaveBeenCalledWith("Import failed."),
  );
  expect(captureException).toHaveBeenCalledWith(failure);
});
