// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { TransferKanbanColumn } from "./transfer-kanban-column";

type TransferRequest = FunctionReturnType<
  typeof api.objectMoves.listForOrganization
>[number];

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 8, 1, 12);

function transfer(
  index: number,
  overrides: Partial<TransferRequest> = {},
): TransferRequest {
  return {
    _id: `move-${index}` as Id<"organizationMoveRequests">,
    collectionId: `object-${index}` as Id<"collections">,
    collectionTitle: `Object ${index}`,
    sourceAccessionNumber: `112-2026-${String(index).padStart(4, "0")}`,
    accessionMode: "keep",
    targetOrganizationId: "target" as Id<"organizations">,
    targetOrganizationName: "Museum Nord",
    reason: "Rotation",
    status: "executed",
    requestedBy: "user" as Id<"users">,
    requestedByName: "Ola Nordmann",
    requestedAt: START + index * DAY,
    targetReviewedAt: START + index * DAY + DAY,
    direction: "outgoing",
    ...overrides,
  };
}

function column(
  status: TransferRequest["status"],
  transferRequests: TransferRequest[],
  searchQuery = "",
) {
  return (
    <TransferKanbanColumn
      status={status}
      direction="outgoing"
      title="Executed transfers"
      searchQuery={searchQuery}
      transferRequests={transferRequests}
    />
  );
}

async function renderColumn(
  status: TransferRequest["status"],
  transferRequests: TransferRequest[],
) {
  return await renderOnPage(
    column(status, transferRequests),
    "/en/accessions/transfers",
  );
}

test("executed transfers read as a log, latest decision first", async () => {
  await renderColumn("executed", [
    transfer(1),
    transfer(2, { targetReviewedAt: START + 40 * DAY }),
    transfer(3, { direction: "incoming" }),
    transfer(4, { status: "rejected" }),
  ]);

  const entries = screen.getAllByRole("listitem");
  expect(entries).toHaveLength(2);
  const first = within(entries[0] as HTMLElement);
  expect(first.getByText("112-2026-0002")).toBeTruthy();
  expect(first.getByText("Oct 11, 2026")).toBeTruthy();
  expect(first.getByTitle("Object 2 · Museum Nord")).toBeTruthy();
  expect(first.getByRole("link").getAttribute("href")).toBe(
    "/objects/move-requests/move-2",
  );
  expect(
    within(entries[1] as HTMLElement).getByText("Sep 3, 2026"),
  ).toBeTruthy();
  expect(screen.queryByText("Ola Nordmann")).toBeNull();
  expect(screen.getByText("Showing 2 of 2")).toBeTruthy();
});

test("rejected transfers are dated and explained by whichever organization rejected them", async () => {
  await renderColumn("rejected", [
    transfer(1, {
      status: "rejected",
      targetReviewedAt: undefined,
      sourceReviewedAt: START + 5 * DAY,
      sourceReviewNotes: "Not eligible",
    }),
    transfer(2, {
      status: "rejected",
      sourceReviewedAt: START,
      sourceReviewNotes: "Approved by source",
      targetReviewNotes: "No storage space",
    }),
  ]);

  const [first, second] = screen.getAllByRole("listitem");
  expect(within(first as HTMLElement).getByText("Sep 6, 2026")).toBeTruthy();
  expect(
    within(first as HTMLElement).getByTitle("Object 1 · Not eligible"),
  ).toBeTruthy();
  expect(within(second as HTMLElement).getByText("Sep 4, 2026")).toBeTruthy();
  expect(
    within(second as HTMLElement).getByTitle(
      "Object 2 · Declined by Museum Nord: No storage space",
    ),
  ).toBeTruthy();
});

test("a receiver's decline without notes still says who declined", async () => {
  await renderColumn("rejected", [transfer(1, { status: "rejected" })]);

  expect(screen.getByTitle("Object 1 · Declined by Museum Nord")).toBeTruthy();
});

test("the log shows ten transfers and Show more adds the next ten", async () => {
  await renderColumn(
    "executed",
    Array.from({ length: 23 }, (_, index) => transfer(index)),
  );

  expect(screen.getAllByRole("listitem")).toHaveLength(10);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(20);
  await user.click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(23);
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("a new search starts the log again at ten", async () => {
  const requests = Array.from({ length: 23 }, (_, index) => transfer(index));
  const { rerender } = await renderColumn("executed", requests);

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(20);

  rerender(column("executed", requests, "museum"));

  expect(screen.getAllByRole("listitem")).toHaveLength(10);
  expect(screen.getByText("Showing 10 of 23")).toBeTruthy();
});

test("an empty log keeps its empty state", async () => {
  await renderColumn("rejected", []);

  expect(
    screen.getByText("No rejected transfers match this search."),
  ).toBeTruthy();
});

test("pending transfers keep their cards", async () => {
  await renderColumn("pending_source_approval", [
    transfer(1, { status: "pending_source_approval" }),
  ]);

  expect(screen.queryAllByRole("listitem")).toEqual([]);
  expect(screen.getByText("Ola Nordmann")).toBeTruthy();
  expect(
    screen.getByText("Chosen by the receiving organization when it accepts"),
  ).toBeTruthy();
});
