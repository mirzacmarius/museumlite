// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import {
  type DeaccessionBoardColumn,
  DeaccessionKanbanColumn,
} from "./deaccession-kanban-column";

const loadMore = vi.fn();
const usePaginatedQuery = vi.fn();
vi.mock("convex/react", () => ({
  usePaginatedQuery: (...args: unknown[]) => usePaginatedQuery(...args),
}));

const rows = [
  {
    _id: "da-1",
    deaccessionNumber: "DA-112-2026-006",
    collectionId: "obj-1",
    collectionTitle: "kn kn",
    accessionNumber: "112-2026-0102",
    dateDeaccessioned: Date.UTC(2026, 9, 2, 12),
    reason: "Damaged beyond repair",
    method: "destruction",
    targetCollectionStatus: "deaccessioned",
    status: "approved",
  },
  {
    _id: "da-2",
    deaccessionNumber: "DA-112-2026-005",
    collectionId: "obj-2",
    collectionTitle: "Loge hammer",
    dateDeaccessioned: Date.UTC(2026, 8, 20, 12),
    reason: "Duplicate",
    method: "sale",
    targetCollectionStatus: "deaccessioned",
    status: "approved",
  },
];

beforeEach(() => {
  loadMore.mockReset();
  usePaginatedQuery.mockReset();
  usePaginatedQuery.mockReturnValue({
    results: rows,
    status: "CanLoadMore",
    loadMore,
  });
});

async function renderColumn(column: DeaccessionBoardColumn) {
  await renderOnPage(
    <DeaccessionKanbanColumn
      organizationId={"org-1" as Id<"organizations">}
      column={column}
      search=""
      stepName="Deaccessions"
      total={12}
      returnPath="/deaccessions"
    />,
    "/en/deaccessions",
  );
}

test("the approved column reads as a compact log of the latest ten deaccessions", async () => {
  await renderColumn({ kind: "approved" });

  expect(usePaginatedQuery.mock.calls[0]?.[2]).toEqual({ initialNumItems: 10 });
  const entries = screen.getAllByRole("listitem");
  expect(entries).toHaveLength(2);
  const first = within(entries[0] as HTMLElement);
  expect(first.getByText("DA-112-2026-006")).toBeTruthy();
  expect(first.queryByText("112-2026-0102")).toBeNull();
  expect(first.getByText("Oct 2, 2026").getAttribute("title")).toBeNull();
  expect(first.getByTitle("kn kn · Damaged beyond repair")).toBeTruthy();
  expect(first.getByRole("link").getAttribute("href")).toBe(
    "/deaccessions/da-1?from=%2Fdeaccessions",
  );
  const second = within(entries[1] as HTMLElement);
  expect(second.getByText("DA-112-2026-005")).toBeTruthy();
  expect(screen.getByText("Showing 2 of 12")).toBeTruthy();
});

test("Show more under the last deaccession loads the next ten", async () => {
  await renderColumn({ kind: "approved" });

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show more" }));

  expect(loadMore).toHaveBeenCalledWith(10);
});

test("pending review steps keep their cards", async () => {
  await renderColumn({ kind: "step", step: 1 });

  expect(usePaginatedQuery.mock.calls[0]?.[2]).toEqual({ initialNumItems: 25 });
  expect(screen.queryAllByRole("listitem")).toEqual([]);
  expect(screen.getByText("Destruction (Witnessed)")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
});

test("a transfer the receiver declined says so instead of reading as a refused removal", async () => {
  usePaginatedQuery.mockReturnValue({
    results: [
      {
        _id: "da-3",
        deaccessionNumber: "TR-HERITA-1760000000000",
        collectionId: "obj-3",
        collectionTitle: "Silver beaker",
        dateDeaccessioned: Date.UTC(2026, 9, 20, 12),
        reason: "sold",
        method: "transfer",
        targetCollectionStatus: "deaccessioned",
        status: "rejected",
        transferDeclinedBy: "Fredrikstad Museum",
      },
      { ...rows[1], status: "rejected" },
    ],
    status: "Exhausted",
    loadMore,
  });

  await renderColumn({ kind: "rejected" });

  expect(
    screen.getByText("Transfer declined by Fredrikstad Museum"),
  ).toBeTruthy();
  expect(screen.queryByText("Transfer")).toBeNull();
  expect(screen.getByText("Sale / Auction")).toBeTruthy();
});
