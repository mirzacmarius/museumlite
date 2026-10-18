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

test.each([
  ["/en/loans/new", "Loans"],
  ["/en/accessions/import", "Accessions"],
  ["/en/collections/new", "Collection groups"],
  ["/en/library/fines", "Library"],
])("%s is titled by its section, never by an English route word", async (url, title) => {
  await renderOnPage(
    <SidebarProvider>
      <DashboardHeader>
        <button type="button">Search</button>
      </DashboardHeader>
    </SidebarProvider>,
    url,
  );

  const header = screen.getByRole("banner");
  expect(header.textContent).toContain(title);
  expect(header.textContent).not.toMatch(/\b(New|Import|Fines)\b/);
});

test.each([
  "/en/accessions",
  "/en/accessions/entries",
  "/en/accessions/transfers",
])("%s keeps the Accessions title on every tab", async (url) => {
  await renderOnPage(
    <SidebarProvider>
      <DashboardHeader>
        <button type="button">Search</button>
      </DashboardHeader>
    </SidebarProvider>,
    url,
  );

  expect(screen.getByRole("banner").textContent).toContain("Accessions");
});
