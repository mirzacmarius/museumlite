// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { NotificationBell } from "./notification-bell";

const state = vi.hoisted(() => ({ unreadCount: 0 }));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(query) === "notifications:getUnreadCount"
      ? state.unreadCount
      : undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("./organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

test("the bell shows the exact unread count up to nine", async () => {
  state.unreadCount = 9;
  await renderOnPage(<NotificationBell />);

  const bell = screen.getByRole("button", { name: "Notifications, 9 unread" });
  expect(bell.textContent).toBe("9");
});

test("the unread count stops at ten, which reads as 9+ in the badge and the label", async () => {
  state.unreadCount = 10;
  await renderOnPage(<NotificationBell />);

  const bell = screen.getByRole("button", {
    name: "Notifications, 9+ unread",
  });
  expect(bell.textContent).toBe("9+");
});
