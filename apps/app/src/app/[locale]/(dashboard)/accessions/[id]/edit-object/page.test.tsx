// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import EditAccessionObjectPage from "./page";

const { redirectTo } = vi.hoisted(() => ({ redirectTo: vi.fn() }));
let accession: Record<string, unknown>;

vi.mock("convex/react", () => ({
  useQuery: () => accession,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: redirectTo,
}));
vi.mock(
  "../../../objects/_components/object-request-form/object-request-form-page",
  () => ({ ObjectRequestFormPage: () => <p>Object form</p> }),
);

/** ACC-2025-0020: a bequest recorded on the accession form, no object yet. */
const caseDraft = {
  _id: "acc-20",
  organizationId: "org-1",
  accessionNumber: "ACC-2025-0020",
  source: "Anna Berg",
  method: "bequest",
  status: "pending",
  workflowStep: 0,
};

function renderPage() {
  return renderOnPage(
    <EditAccessionObjectPage />,
    "/en/accessions/acc-20/edit-object",
    { id: "acc-20" },
  );
}

const draftOnly =
  "Only pending accession object drafts can be edited from this screen.";

beforeEach(() => {
  redirectTo.mockReset();
  accession = caseDraft;
});

test("a draft recorded without an object has its object described here", async () => {
  await renderPage();

  expect(screen.getByText("Object form")).toBeTruthy();
  expect(redirectTo).not.toHaveBeenCalled();
});

test("an accession in review without an object is not opened from a typed address", async () => {
  accession = { ...caseDraft, workflowStep: 1 };
  await renderPage();

  expect(screen.getByText(draftOnly)).toBeTruthy();
  expect(screen.queryByText("Object form")).toBeNull();
});

test("a draft begun from an entry already has its object and opens the accession form", async () => {
  accession = { ...caseDraft, collectionId: "object-1" };
  await renderPage();

  expect(redirectTo).toHaveBeenCalledWith("/accessions/acc-20/edit");
  expect(screen.queryByText("Object form")).toBeNull();
});

test("an accession in review keeps its described object editable", async () => {
  accession = {
    ...caseDraft,
    workflowStep: 1,
    draftObjectData: { title: "Self-portrait", creator: "Anna Berg" },
  };
  await renderPage();

  expect(screen.getByText("Object form")).toBeTruthy();
});
