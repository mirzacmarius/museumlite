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
    sourceOrganizationId: "source" as Id<"organizations">,
    sourceOrganizationName: "Museum Sør",
    targetOrganizationId: "target" as Id<"organizations">,
    targetOrganizationName: "Museum Nord",
    reason: "Rotation",
    status: "executed",
    requestedBy: "user" as Id<"users">,
    requestedByName: "Ola Nordmann",
    requestedAt: START + index * DAY,
    targetReviewedAt: START + index * DAY + DAY,
    direction: "outgoing",
    awaitsSourceReapproval: false,
    ...overrides,
  };
}

type Statuses = TransferRequest["status"][];

const LOG: Statuses = ["executed", "rejected", "cancelled"];

function column(
  statuses: Statuses,
  transferRequests: TransferRequest[],
  searchQuery = "",
  direction: TransferRequest["direction"] = "outgoing",
) {
  return (
    <TransferKanbanColumn
      statuses={statuses}
      direction={direction}
      title="Transfer log"
      searchQuery={searchQuery}
      transferRequests={transferRequests}
    />
  );
}

async function renderColumn(
  statuses: Statuses,
  transferRequests: TransferRequest[],
  direction: TransferRequest["direction"] = "outgoing",
) {
  return await renderOnPage(
    column(statuses, transferRequests, "", direction),
    "/en/accessions/transfers",
  );
}

test("executed transfers read as a log, latest decision first", async () => {
  await renderColumn(
    ["executed"],
    [
      transfer(1),
      transfer(2, { targetReviewedAt: START + 40 * DAY }),
      transfer(3, { direction: "incoming" }),
      transfer(4, { status: "rejected" }),
    ],
  );

  const entries = screen.getAllByRole("listitem");
  expect(entries).toHaveLength(2);
  const first = within(entries[0] as HTMLElement);
  expect(first.getByText("112-2026-0002")).toBeTruthy();
  expect(first.getByText("Oct 11, 2026")).toBeTruthy();
  expect(first.getByTitle("Object 2 · Sent to Museum Nord")).toBeTruthy();
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
  await renderColumn(
    ["rejected"],
    [
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
    ],
  );

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
  await renderColumn(["rejected"], [transfer(1, { status: "rejected" })]);

  expect(screen.getByTitle("Object 1 · Declined by Museum Nord")).toBeTruthy();
});

test("the log shows ten transfers and Show more adds the next ten", async () => {
  await renderColumn(
    ["executed"],
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
  const { rerender } = await renderColumn(["executed"], requests);

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(20);

  rerender(column(["executed"], requests, "museum"));

  expect(screen.getAllByRole("listitem")).toHaveLength(10);
  expect(screen.getByText("Showing 10 of 23")).toBeTruthy();
});

test("without a direction the log lists transfers sent and received, each saying which way it went", async () => {
  const requests = [
    transfer(1),
    transfer(2, {
      direction: "incoming",
      sourceOrganizationId: "sender" as Id<"organizations">,
      sourceOrganizationName: "Museum Vest",
      targetOrganizationName: "Museum Sør",
      targetReviewedAt: START + 40 * DAY,
    }),
  ];
  const log = (searchQuery: string) => (
    <TransferKanbanColumn
      statuses={LOG}
      title="Transfer log"
      searchQuery={searchQuery}
      transferRequests={requests}
    />
  );
  const { rerender } = await renderOnPage(log(""), "/en/accessions/transfers");

  const [received, sent, ...rest] = screen.getAllByRole("listitem");
  expect(rest).toEqual([]);
  expect(
    within(received as HTMLElement).getByTitle(
      "Object 2 · Received from Museum Vest",
    ),
  ).toBeTruthy();
  expect(
    within(sent as HTMLElement).getByTitle("Object 1 · Sent to Museum Nord"),
  ).toBeTruthy();

  rerender(log("museum vest"));

  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(
    screen.getByTitle("Object 2 · Received from Museum Vest"),
  ).toBeTruthy();
});

test("an empty log keeps its empty state", async () => {
  await renderColumn(LOG, []);

  expect(
    screen.getByText("No finished transfers match this search."),
  ).toBeTruthy();
});

test("the transfer log lists every outcome, each marked with its status", async () => {
  await renderColumn(LOG, [
    transfer(1, { targetReviewedAt: START + 3 * DAY }),
    transfer(2, {
      status: "rejected",
      targetReviewedAt: undefined,
      sourceReviewedAt: START + 2 * DAY,
      sourceReviewNotes: "Not eligible",
    }),
    transfer(3, {
      status: "cancelled",
      targetReviewedAt: undefined,
      reviewedAt: START + DAY,
      sourceReviewNotes: "Wrong object",
    }),
    transfer(4, { status: "awaiting_acceptance" }),
  ]);

  const [executed, rejected, cancelled, ...rest] =
    screen.getAllByRole("listitem");
  expect(rest).toEqual([]);
  expect(
    within(executed as HTMLElement).getByText("Transfer executed"),
  ).toBeTruthy();
  expect(within(rejected as HTMLElement).getByText("Rejected")).toBeTruthy();
  expect(within(cancelled as HTMLElement).getByText("Cancelled")).toBeTruthy();
  expect(
    within(cancelled as HTMLElement).getByTitle("Object 3 · Wrong object"),
  ).toBeTruthy();
  expect(screen.getByText("Showing 3 of 3")).toBeTruthy();
});

test("the sender sees its transfers awaiting the receiver's acceptance", async () => {
  await renderColumn(
    ["awaiting_acceptance"],
    [
      transfer(1, { status: "awaiting_acceptance" }),
      transfer(2, { status: "awaiting_acceptance", direction: "incoming" }),
    ],
  );

  expect(screen.getByText("Object 1")).toBeTruthy();
  expect(screen.queryByText("Object 2")).toBeNull();
  expect(screen.getByText("Awaiting acceptance")).toBeTruthy();
});

test("an empty awaiting-acceptance column says nothing waits for a receiver", async () => {
  await renderColumn(["awaiting_acceptance"], []);

  expect(
    screen.getByText("No transfers are waiting for a receiver to accept them."),
  ).toBeTruthy();
});

test("pending transfers keep their cards", async () => {
  await renderColumn(
    ["pending_source_approval"],
    [transfer(1, { status: "pending_source_approval" })],
  );

  expect(screen.queryAllByRole("listitem")).toEqual([]);
  expect(screen.getByText("Ola Nordmann")).toBeTruthy();
  expect(
    screen.getByText("Chosen by the receiving organization when it accepts"),
  ).toBeTruthy();
});

test("an older approval the source must re-approve waits in Pending, not for the receiver", async () => {
  const older = transfer(1, {
    status: "awaiting_acceptance",
    awaitsSourceReapproval: true,
  });
  const { unmount } = await renderColumn(["awaiting_acceptance"], [older]);
  expect(screen.queryByText("Object 1")).toBeNull();
  unmount();

  await renderColumn(["pending_source_approval"], [older]);
  expect(screen.getByText("Object 1")).toBeTruthy();
  expect(screen.getByText("Pending transfer approval")).toBeTruthy();
});
