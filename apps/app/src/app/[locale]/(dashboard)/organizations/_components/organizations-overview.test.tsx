// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { OrganizationsOverview } from "./organizations-overview";

const ORGANIZATIONS = [
  {
    _id: "org-gallery",
    name: "Alna Gallery",
    type: "gallery",
    subscriptionTier: "free",
    roleName: "Volunteer",
    joinedAt: Date.UTC(2026, 3, 1),
    metrics: null,
  },
  {
    _id: "org-museum",
    name: "Sandbekk Museum",
    type: "museum",
    subscriptionTier: "pro",
    roleName: "Registrar",
    joinedAt: Date.UTC(2026, 0, 5),
    metrics: {
      availability: "ready",
      objects: 1250,
      activeLoans: 3,
      locations: 12,
    },
  },
];

const setCurrentOrganizationId = vi.fn();
const push = vi.fn();
vi.mock("convex/react", () => ({ useQuery: () => ORGANIZATIONS }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({
    currentOrganizationId: "org-museum",
    setCurrentOrganizationId,
  }),
}));

beforeEach(() => {
  setCurrentOrganizationId.mockReset();
  push.mockReset();
});

test("each organization shows its role, plan and the counts the member may see (MUS-834)", async () => {
  await renderOnPage(<OrganizationsOverview />, "/en/organizations");

  const [gallery, museum] = screen.getAllByRole("listitem");
  expect(within(museum as HTMLElement).getByText("Current")).toBeTruthy();
  expect(within(museum as HTMLElement).getByText("1,250")).toBeTruthy();
  expect(
    within(museum as HTMLElement).getByText("Your role: Registrar"),
  ).toBeTruthy();
  expect(within(gallery as HTMLElement).queryByText("Objects")).toBeNull();
  expect(within(gallery as HTMLElement).getByText("Free")).toBeTruthy();
});

test("opening an organization makes it current and goes to its Dashboard", async () => {
  await renderOnPage(<OrganizationsOverview />, "/en/organizations");
  const user = userEvent.setup();

  const gallery = screen.getAllByRole("listitem")[0] as HTMLElement;
  await user.click(within(gallery).getByRole("button", { name: "Open" }));

  expect(setCurrentOrganizationId).toHaveBeenCalledWith("org-gallery");
  expect(push).toHaveBeenCalledWith("/");
});

test("search narrows the list by name", async () => {
  await renderOnPage(<OrganizationsOverview />, "/en/organizations");
  const user = userEvent.setup();

  await user.type(
    screen.getByRole("searchbox", { name: "Search organizations" }),
    "sand",
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(1);

  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "nowhere");
  expect(screen.getByText("No organization matches “nowhere”.")).toBeTruthy();
});
