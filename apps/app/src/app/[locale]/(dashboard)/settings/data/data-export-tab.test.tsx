// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { DataExportTab } from "./data-export-tab";
import { toTemplateRows } from "./use-data-import";

const exportRows = vi.hoisted(() => vi.fn());
const downloadCsv = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: () => exportRows,
  useConvex: () => ({ query: vi.fn() }),
}));
vi.mock("@/components/export-job-control", () => ({
  ExportJobControl: () => null,
}));
vi.mock("./data-csv-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./data-csv-utils")>()),
  downloadCsv,
}));

test("an objects export carries the structured date made, and re-imports it (MUS-857)", async () => {
  exportRows.mockResolvedValue([
    { title: "Krukke", dateCreated: "500 BC", dateCreatedEdtf: "-0499" },
    { title: "Vase", dateCreated: "c. 1850" },
  ]);
  await renderOnPage(
    <DataExportTab organizationId={"org-1" as Id<"organizations">} />,
    "/en/settings/data",
  );

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Export to CSV" }));

  await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
  const csv = String(downloadCsv.mock.calls[0]?.[1]);
  expect(csv.split("\n")[0]).toContain(",dateCreated,dateCreatedEdtf,");
  // The apostrophe guards spreadsheets against a formula; the server drops it.
  expect(
    toTemplateRows(csv, {
      headers: ["title", "dateCreated", "dateCreatedEdtf"],
      exampleRow: [],
      description: "",
      requiredFields: ["title"],
    }),
  ).toEqual({
    rows: [
      {
        rowNumber: 2,
        title: "Krukke",
        dateCreated: "500 BC",
        dateCreatedEdtf: "'-0499",
      },
      { rowNumber: 3, title: "Vase", dateCreated: "c. 1850" },
    ],
  });
});

test("an objects export carries number of objects, subject, completeness, measured parts and rights statement, and re-imports them (MUS-865)", async () => {
  downloadCsv.mockClear();
  const measurementSets = JSON.stringify([
    { part: "other", partNote: "lid", diameter: 8.5, unit: "cm" },
  ]);
  exportRows.mockResolvedValue([
    {
      title: "Teapot",
      numberOfObjects: 2,
      subjects: "Tea; Ceramics",
      completeness: "incomplete",
      completenessNote: "Lid chipped, saucer missing",
      dimensionMeasuredPart: "overall",
      measurementSets,
      rightsStatement: "http://rightsstatements.org/vocab/InC/1.0/",
    },
  ]);
  await renderOnPage(
    <DataExportTab organizationId={"org-1" as Id<"organizations">} />,
    "/en/settings/data",
  );

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Export to CSV" }));

  await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
  const csv = String(downloadCsv.mock.calls[0]?.[1]);
  const described = [
    "numberOfObjects",
    "subjects",
    "completeness",
    "completenessNote",
    "dimensionMeasuredPart",
    "measurementSets",
    "rightsStatement",
  ];
  expect(csv.split("\n")[0]).toContain(`,provenance,${described.join(",")},`);
  expect(
    toTemplateRows(csv, {
      headers: ["title", ...described],
      exampleRow: [],
      description: "",
      requiredFields: ["title"],
    }),
  ).toEqual({
    rows: [
      {
        rowNumber: 2,
        title: "Teapot",
        numberOfObjects: "2",
        subjects: "Tea; Ceramics",
        completeness: "incomplete",
        completenessNote: "Lid chipped, saucer missing",
        dimensionMeasuredPart: "overall",
        measurementSets,
        rightsStatement: "http://rightsstatements.org/vocab/InC/1.0/",
      },
    ],
  });
});
