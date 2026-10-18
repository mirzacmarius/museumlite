// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AccessionDetailMainContent } from "./accession-detail-main-content";
import type {
  AccessionDetailRecord,
  AccessionDetailViewProps,
} from "./accession-detail-view-props";

vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
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

/** ACC-2025-0020: a bequest recorded on the accession form, still a draft. */
const caseDraft = {
  _id: "acc-20",
  organizationId: "org-1",
  accessionNumber: "ACC-2025-0020",
  source: "James Morrison Gallery",
  method: "bequest",
  status: "pending",
  workflowStep: 0,
} as unknown as AccessionDetailRecord;

function renderDraft(
  accession: AccessionDetailRecord,
  handleSubmitDraft = vi.fn(),
) {
  const props = {
    accession,
    locale: "en",
    accessionId: accession._id,
    isDraft: true,
    configuredWorkflowSteps: [],
    workflowSummary: "",
    canEditObjectDraft: false,
    draftEditHref: `/accessions/${accession._id}/edit`,
    draftActionError: null,
    isSubmittingDraft: false,
    handleSubmitDraft,
  } as unknown as AccessionDetailViewProps;
  return renderOnPage(
    <AccessionDetailMainContent {...props} />,
    `/en/accessions/${accession._id}`,
    { id: accession._id },
  );
}

test("a draft recorded without an object can have its object described and be submitted", async () => {
  const handleSubmitDraft = vi.fn();
  await renderDraft(caseDraft, handleSubmitDraft);

  expect(screen.getByText("Not submitted for approval yet")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Describe object" }).getAttribute("href"),
  ).toBe("/accessions/acc-20/edit-object");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Submit for approval" }));
  expect(handleSubmitDraft).toHaveBeenCalledOnce();
});

test("a draft begun from an entry already has its object and is only submitted", async () => {
  await renderDraft({
    ...caseDraft,
    collectionId: "object-1",
  } as unknown as AccessionDetailRecord);

  expect(screen.queryByRole("link", { name: "Describe object" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Submit for approval" }),
  ).toBeTruthy();
});
