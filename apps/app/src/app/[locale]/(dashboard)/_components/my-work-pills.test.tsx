// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { AlertCircle, ListTodo, ScrollText } from "lucide-react";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MyWorkPills } from "./my-work-pills";
import type { WorkColumn } from "./work-board";

function group(overrides: Partial<WorkColumn> & Pick<WorkColumn, "key">) {
  return {
    icon: ListTodo,
    accentClassName: "text-blue-400",
    title: overrides.key,
    loading: false,
    count: 0,
    hasMore: false,
    renderCards: () => null,
    ...overrides,
  } satisfies WorkColumn;
}

test("shows a pill per group with work waiting, linking to My work", async () => {
  await renderOnPage(
    <MyWorkPills
      groups={[
        group({ key: "tasks", title: "My tasks", count: 0 }),
        group({
          key: "approvals",
          icon: AlertCircle,
          title: "Pending Your Approval",
          count: 5,
        }),
        group({
          key: "provenance",
          icon: ScrollText,
          title: "Provenance review",
          count: 20,
          hasMore: true,
        }),
        group({
          key: "reviews",
          title: "Waiting for my review",
          loading: true,
        }),
      ]}
    />,
  );

  const approvals = screen.getByRole("link", {
    name: "5 Pending Your Approval",
  });
  expect(approvals.getAttribute("href")).toBe("/assignments");
  expect(
    screen.getByRole("link", { name: "20+ Provenance review" }),
  ).toBeTruthy();
  expect(screen.queryByText("My tasks")).toBeNull();
  expect(screen.queryByText("Waiting for my review")).toBeNull();
  expect(screen.getByRole("link", { name: "My work" })).toBeTruthy();
});

test("with nothing waiting, only the My work link remains", async () => {
  await renderOnPage(
    <MyWorkPills groups={[group({ key: "tasks", title: "My tasks" })]} />,
  );

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "My work",
  ]);
});
