// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import WorkflowsSettingsPage from "./page";

const ROLES = [
  { _id: "role-admin", name: "Administrator" },
  { _id: "role-cm", name: "Collection Manager" },
  { _id: "role-curator", name: "Curator" },
  { _id: "role-reviewer", name: "Board Reviewer" },
];
/** Only the custom Board Reviewer role is ticked to start accession review. */
const WORKFLOWS = [
  {
    workflowType: "accession",
    steps: [{ stepNumber: 1, roleId: "role-reviewer", name: "Board review" }],
    canInitiateRoles: ["role-reviewer"],
  },
];

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    if (name === "workflows:list") return WORKFLOWS;
    if (name === "roles:listRoles") return ROLES;
    return undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

const NOTE =
  "Staff with the Administrator, Collection Manager or Curator role can always submit accessions for approval and approve every step, whatever is chosen here.";

function workflowCard(title: string) {
  const heading = screen.getByRole("heading", { name: title });
  const card = heading.closest("div.rounded-xl");
  if (!(card instanceof HTMLElement)) throw new Error(`No card for ${title}`);
  return card;
}

test("the accession workflow says which roles always start and approve it", async () => {
  await renderOnPage(<WorkflowsSettingsPage />, "/en/settings/workflows");

  expect(
    within(workflowCard("Accession Workflow")).getByText(NOTE),
  ).toBeTruthy();
  expect(within(workflowCard("Loan Workflow")).queryByText(NOTE)).toBeNull();
});

test("editing the accession workflow keeps the note beside its initiators", async () => {
  const user = userEvent.setup();
  await renderOnPage(<WorkflowsSettingsPage />, "/en/settings/workflows");

  await user.click(
    within(workflowCard("Accession Workflow")).getByRole("button", {
      name: "Edit Workflow",
    }),
  );

  expect(within(screen.getByRole("dialog")).getByText(NOTE)).toBeTruthy();
});

test("other workflows have no such note when edited", async () => {
  const user = userEvent.setup();
  await renderOnPage(<WorkflowsSettingsPage />, "/en/settings/workflows");

  await user.click(
    within(workflowCard("Loan Workflow")).getByRole("button", {
      name: "Edit Workflow",
    }),
  );

  expect(within(screen.getByRole("dialog")).queryByText(NOTE)).toBeNull();
});
