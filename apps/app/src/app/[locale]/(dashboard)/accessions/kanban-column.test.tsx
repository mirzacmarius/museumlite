// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { KanbanColumn } from "./kanban-column";

const loadMore = vi.fn();
const usePaginatedQuery = vi.fn();
vi.mock("convex/react", () => ({
  usePaginatedQuery: (...args: unknown[]) => usePaginatedQuery(...args),
}));

const approvedRows = [
  {
    _id: "acc-1",
    accessionNumber: "112-2026-0104",
    dateReceived: Date.UTC(2026, 0, 2),
    source: "Loge hammer",
    draftTitle: "Loge hammer",
    method: "gift",
    status: "approved",
    approvedAt: Date.UTC(2026, 9, 12, 12),
  },
  {
    _id: "acc-2",
    accessionNumber: "112-2026-0103",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Fjordheim estate",
    draftTitle: "Silver brooch",
    method: "bequest",
    status: "approved",
    approvedAt: Date.UTC(2026, 9, 3, 12),
  },
];

beforeEach(() => {
  loadMore.mockReset();
  usePaginatedQuery.mockReset();
  usePaginatedQuery.mockReturnValue({
    results: approvedRows,
    status: "CanLoadMore",
    loadMore,
  });
});

async function renderApprovedColumn() {
  await renderOnPage(
    <KanbanColumn
      organizationId={"org-1" as Id<"organizations">}
      column={{ kind: "approved" }}
      stepName="Approved"
      searchQuery=""
      total={63}
      returnPath="/accessions"
    />,
    "/en/accessions",
  );
}

test("the Approved column reads as a compact log of the latest ten approvals", async () => {
  await renderApprovedColumn();

  expect(usePaginatedQuery.mock.calls[0]?.[2]).toEqual({ initialNumItems: 10 });
  const entries = screen.getAllByRole("listitem");
  expect(entries).toHaveLength(2);
  const first = within(entries[0] as HTMLElement);
  expect(first.getByText("112-2026-0104")).toBeTruthy();
  expect(first.getAllByText("Loge hammer")).toHaveLength(1);
  expect(first.getByTitle("Loge hammer")).toBeTruthy();
  expect(first.getByText("Oct 12, 2026")).toBeTruthy();
  const second = within(entries[1] as HTMLElement);
  expect(second.getByTitle("Silver brooch · Fjordheim estate")).toBeTruthy();
  expect(screen.getByText("2 of 63")).toBeTruthy();
});

test("Show more under the last approval loads the next ten", async () => {
  await renderApprovedColumn();

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show more" }));

  expect(loadMore).toHaveBeenCalledWith(10);
});
