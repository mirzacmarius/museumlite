// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AccessionDetailPageClient } from "./accession-detail-page-client";
import type { AccessionDetailRecord } from "./accession-detail-view-props";

let accession: AccessionDetailRecord;

vi.mock("convex/react", () => ({
  useQuery: (reference: never) => {
    switch (getFunctionName(reference)) {
      case "accessions:get":
        return accession;
      case "accessions:getWorkflowSteps":
        return { steps: [], requireSourceVerification: false };
      default:
        return undefined;
    }
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./accession-catalog-identifier", () => ({
  AccessionCatalogIdentifier: () => null,
}));
vi.mock("@/components/target-party-links", () => ({
  TargetPartyLinks: () => null,
}));
vi.mock("@/components/case-tasks/case-task-panel", () => ({
  CaseTaskPanel: () => null,
}));
vi.mock("@/components/audit-case-history", () => ({
  AuditCaseHistory: () => null,
}));
vi.mock("./intake-review-decision", () => ({
  IntakeReviewDecision: () => null,
}));
vi.mock("./accession-detail-review-panel", () => ({
  AccessionDetailReviewPanel: () => null,
}));

/**
 * ACC-2025-0020: a bequest from Anna Berg recorded on the accession form,
 * whose object a Curator has since described. Still a draft.
 */
const describedCaseDraft = {
  _id: "acc-20",
  organizationId: "org-1",
  accessionNumber: "ACC-2025-0020",
  source: "Anna Berg",
  method: "bequest",
  dateReceived: Date.UTC(2025, 2, 4),
  status: "pending",
  workflowStep: 0,
  startedInObjectForm: false,
  canCurrentUserSubmit: true,
  draftObjectData: { title: "Self-portrait", creator: "Anna Berg" },
} as unknown as AccessionDetailRecord;

function renderAccession() {
  return renderOnPage(<AccessionDetailPageClient />, "/en/accessions/acc-20", {
    id: "acc-20",
  });
}

function hrefOf(name: string) {
  return screen.getByRole("link", { name }).getAttribute("href");
}

beforeEach(() => {
  accession = describedCaseDraft;
});

test("a draft recorded on the accession form keeps both its forms once its object is described", async () => {
  await renderAccession();

  // The header Edit opens the accession form: source, method, cost, notes.
  expect(hrefOf("Edit draft")).toBe("/accessions/acc-20/edit");
  // The proposed object has its own button to the object form.
  expect(hrefOf("Edit object")).toBe("/accessions/acc-20/edit-object");
});

test("a draft started in the object form is edited in the object form", async () => {
  accession = {
    ...describedCaseDraft,
    startedInObjectForm: true,
  } as unknown as AccessionDetailRecord;
  await renderAccession();

  const editLinks = screen.getAllByRole("link", { name: "Edit draft" });
  expect(editLinks.map((link) => link.getAttribute("href"))).toEqual([
    "/accessions/acc-20/edit-object",
    "/accessions/acc-20/edit-object",
  ]);
  expect(screen.queryByRole("link", { name: "Edit object" })).toBeNull();
});

test("an accession in review recorded on the accession form is edited in the accession form", async () => {
  accession = {
    ...describedCaseDraft,
    workflowStep: 1,
    canCurrentUserSubmit: false,
  } as unknown as AccessionDetailRecord;
  await renderAccession();

  expect(hrefOf("Edit")).toBe("/accessions/acc-20/edit");
  expect(hrefOf("Edit object")).toBe("/accessions/acc-20/edit-object");
});
