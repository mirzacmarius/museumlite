// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { DataImportTab } from "./data-import-tab";

vi.mock("convex/react", () => ({
  useQuery: (query: never) =>
    getFunctionName(query) === "imports:getImportTemplateByType"
      ? {
          headers: ["title", "dateCreated", "dateCreatedEdtf"],
          exampleRow: [],
          description: "Import collection objects.",
          requiredFields: ["title"],
        }
      : undefined,
}));
vi.mock("./use-data-import", () => ({
  useDataImport: () => ({
    importing: false,
    fileInputRef: { current: null },
    downloadTemplate: vi.fn(),
    handleFileSelect: vi.fn(),
    uploadCorrection: vi.fn(),
  }),
}));

const EDTF_HINT = "Structured date in EDTF, such as 1850~, 185X or 1850/1860";

test("the Objects template explains its structured date column", async () => {
  await renderOnPage(
    <DataImportTab organizationId={"org" as Id<"organizations">} />,
    "/en/settings/data",
  );
  const user = userEvent.setup();

  expect(screen.getByText(EDTF_HINT, { exact: false }).textContent).toBe(
    `dateCreatedEdtf – ${EDTF_HINT}`,
  );

  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Locations" }));
  expect(screen.queryByText(EDTF_HINT, { exact: false })).toBeNull();
});

test("the Objects template says what its subject, completeness, measured part, further parts and rights statement columns accept (MUS-865)", async () => {
  await renderOnPage(
    <DataImportTab organizationId={"org" as Id<"organizations">} />,
    "/en/settings/data",
  );
  const hints = [
    [
      "subjects",
      "What the object depicts or is about; separate terms with semicolons",
    ],
    ["completeness", "One of complete, incomplete or fragment"],
    [
      "dimensionMeasuredPart",
      "Part the dimensions were taken from: overall, framed, unframed, image, sight, sheet, plate, mount, base or other",
    ],
    ["measurementSets", "JSON list of further measured parts"],
    ["rightsStatement", "as its URI or a code such as InC, CC0 or CC BY 4.0"],
  ];

  for (const [column, hint] of hints) {
    expect(
      screen
        .getByText(String(hint), { exact: false })
        .textContent?.split(" – ")[0],
    ).toBe(column);
  }

  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Locations" }));
  expect(screen.queryByText("rightsStatement")).toBeNull();
});
