// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { SidebarProvider } from "@v1/ui/sidebar";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { DashboardHeader } from "./dashboard-header";

vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganization: { name: "QA Museum" } }),
}));

test("a record's page names its section, not the record's identifier", async () => {
  const loanId = "xd72hn0sxbhpgw8jn0kbaw19qx8g0cj3";
  await renderOnPage(
    <SidebarProvider>
      <DashboardHeader>
        <button type="button">Search</button>
      </DashboardHeader>
    </SidebarProvider>,
    `/en/loans/${loanId}`,
    { id: loanId },
  );

  const header = screen.getByRole("banner");
  expect(header.textContent).toContain("Loans");
  expect(header.textContent).not.toMatch(/xd72hn0sxbhpgw8jn0kbaw19qx8g0cj3/i);
});
