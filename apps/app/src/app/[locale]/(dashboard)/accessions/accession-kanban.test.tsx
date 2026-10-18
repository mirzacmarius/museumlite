// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AccessionKanban } from "./accession-kanban";

vi.mock("convex/react", () => ({
  useQuery: () => ({
    hasWorkflow: true,
    requireSourceVerification: false,
    steps: [
      { stepNumber: 0, name: "Draft" },
      {
        stepNumber: 1,
        name: "Registrar Review",
        roleName: "Collection Manager",
      },
      { stepNumber: 2, name: "Curator Approval", roleName: "Curator" },
      { stepNumber: -1, name: "Approved" },
    ],
  }),
}));

vi.mock("./kanban-column", () => ({
  KanbanColumn: ({ stepName }: { stepName: string }) => <h2>{stepName}</h2>,
}));

test("the board opened from Pending accession approval still shows the Approved list", async () => {
  await renderOnPage(
    <AccessionKanban
      organizationId={"org-1" as Id<"organizations">}
      searchQuery=""
      returnPath="/accessions?status=pending"
    />,
    "/en/accessions?status=pending",
  );

  expect(
    screen.getAllByRole("heading").map((heading) => heading.textContent),
  ).toEqual(["Draft", "Registrar Review", "Curator Approval", "Approved"]);
});
