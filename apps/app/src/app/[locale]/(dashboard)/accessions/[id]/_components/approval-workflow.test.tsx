// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { workflowApprovalError } from "@v1/backend/convex/utils/workflowApprovalErrors";
import { type FunctionReference, getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ApprovalWorkflow } from "./approval-workflow";

const approve = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">) =>
    getFunctionName(query) === "accessions:get"
      ? {
          _id: "acc-1",
          status: "pending",
          workflowStep: 1,
          canCurrentUserApprove: true,
          sourceVerified: true,
        }
      : {
          steps: [{ stepNumber: 1, name: "Registrar review" }],
          requireSourceVerification: false,
        },
  useMutation: () => approve,
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

beforeEach(() => {
  approve.mockReset();
});

async function approveStep(locale = "en") {
  await renderOnPage(
    <ApprovalWorkflow accessionId="acc-1" />,
    `/${locale}/accessions/acc-1`,
    { id: "acc-1" },
  );
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: /Registrar review/ }));
}

test("an approver without the step's role reads why, in their language", async () => {
  approve.mockRejectedValue(
    workflowApprovalError(
      "APPROVAL_NOT_PERMITTED",
      "Permission denied: cannot approve at this step",
    ),
  );
  await approveStep();

  expect(await screen.findByText("You can't approve this step")).toBeTruthy();
  expect(
    screen.getByText(
      "This workflow step is assigned to a different approver role. Ask someone assigned to this step to review the accession.",
    ),
  ).toBeTruthy();
});

test("an unexpected failure never shows the server's text", async () => {
  approve.mockRejectedValue(
    new Error(
      "[CONVEX M(accessions:approve)] [Request ID: 1a2b] Server Error Uncaught Error: Accession not found",
    ),
  );
  await approveStep();

  expect(
    await screen.findByText("Approval couldn't be completed"),
  ).toBeTruthy();
  expect(
    screen.getByText("Review the accession details and try again."),
  ).toBeTruthy();
  expect(screen.queryByText(/Server Error|Accession not found/)).toBeNull();
});
