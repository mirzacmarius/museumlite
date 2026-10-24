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
