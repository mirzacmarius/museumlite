// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { TooltipProvider } from "@v1/ui/tooltip";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { CatalogedByYouSection } from "./my-assignments-sections";

const state = vi.hoisted(() => ({ totalCatalogedItems: 0 }));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    myCatalogedItems: [
      {
        _id: "object-1",
        title: "Harbour at dusk",
        accessionNumber: "2026.14",
        catalogedAt: Date.UTC(2026, 9, 20),
        status: "active",
      },
    ],
    stats: { totalCatalogedItems: state.totalCatalogedItems },
  }),
}));

const organizationId = "org-1" as Id<"organizations">;

test.each([
  [99, "99"],
  [100, "99+"],
])("Cataloged by you with a count of %i shows %s", async (count, badge) => {
  state.totalCatalogedItems = count;
  await renderOnPage(
    <TooltipProvider>
      <CatalogedByYouSection organizationId={organizationId} />
    </TooltipProvider>,
  );

  expect(screen.getByText("Harbour at dusk")).toBeTruthy();
  expect(screen.getByText(badge)).toBeTruthy();
});
