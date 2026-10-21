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
    stage: "received",
    awaitsSenderReapproval: false,
    decision: { decidedAt: START + index * DAY + DAY, decidedBy: "receiver" },
    requestedBy: "user" as Id<"users">,
    requestedByName: "Ola Nordmann",
    requestedAt: START + index * DAY,
    direction: "outgoing",
    ...overrides,
  };
}

/** A transfer someone still has to decide, at `stage`. */
function open(
  index: number,
  stage: "waiting_for_sender" | "waiting_for_receiver",
  overrides: Partial<TransferRequest> = {},
) {
  return transfer(index, { stage, decision: undefined, ...overrides });
}

type Stages = TransferRequest["stage"][];

const LOG: Stages = ["received", "declined", "cancelled"];

function column(
  stages: Stages,
  transferRequests: TransferRequest[],
  searchQuery = "",
  direction: TransferRequest["direction"] = "outgoing",
) {
  return (
    <TransferKanbanColumn
      stages={stages}
      direction={direction}
      title="Transfer log"
      searchQuery={searchQuery}
      transferRequests={transferRequests}
    />
  );
}

async function renderColumn(
  stages: Stages,
  transferRequests: TransferRequest[],
  direction: TransferRequest["direction"] = "outgoing",
) {
  return await renderOnPage(
    column(stages, transferRequests, "", direction),
    "/en/accessions/transfers",
  );
}

test("received transfers read as a log, latest decision first", async () => {
  await renderColumn(
    ["received"],
    [
      transfer(1),
      transfer(2, {
        decision: { decidedAt: START + 40 * DAY, decidedBy: "receiver" },
      }),
      transfer(3, { direction: "incoming" }),
      transfer(4, { stage: "declined" }),
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

test("declined transfers are dated and explained by whichever organization declined them", async () => {
  await renderColumn(
    ["declined"],
    [
      transfer(1, {
        stage: "declined",
        decision: {
          decidedAt: START + 5 * DAY,
          decidedBy: "sender",
          notes: "Not eligible",
        },
      }),
      transfer(2, {
        stage: "declined",
        sourceReviewNotes: "Approved by source",
        decision: {
          decidedAt: START + 3 * DAY,
          decidedBy: "receiver",
          notes: "No storage space",
        },
      }),
    ],
  );

  const [first, second] = screen.getAllByRole("listitem");
  expect(within(first as HTMLElement).getByText("Sep 6, 2026")).toBeTruthy();
  expect(
    within(first as HTMLElement).getByTitle(
      "Object 1 · Declined by Museum Sør: Not eligible",
    ),
  ).toBeTruthy();
  expect(within(second as HTMLElement).getByText("Sep 4, 2026")).toBeTruthy();
  expect(
    within(second as HTMLElement).getByTitle(
      "Object 2 · Declined by Museum Nord: No storage space",
    ),
  ).toBeTruthy();
});

test("a receiver's decline without notes still says who declined", async () => {
  await renderColumn(["declined"], [transfer(1, { stage: "declined" })]);

  expect(screen.getByTitle("Object 1 · Declined by Museum Nord")).toBeTruthy();
});

test("the log shows ten transfers and Show more adds the next ten", async () => {
  await renderColumn(
    ["received"],
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
  const { rerender } = await renderColumn(["received"], requests);

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(20);

  rerender(column(["received"], requests, "museum"));

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
      decision: { decidedAt: START + 40 * DAY, decidedBy: "receiver" },
    }),
  ];
  await renderOnPage(
    <TransferKanbanColumn
      stages={LOG}
      title="Transfer log"
      searchQuery=""
      transferRequests={requests}
    />,
    "/en/accessions/transfers",
  );

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
});

test("an empty log keeps its empty state", async () => {
  await renderColumn(LOG, []);

  expect(
    screen.getByText("No finished transfers match this search."),
  ).toBeTruthy();
});

test("the transfer log lists every outcome, each marked with its stage", async () => {
  await renderColumn(LOG, [
    transfer(1, {
      decision: { decidedAt: START + 3 * DAY, decidedBy: "receiver" },
    }),
    transfer(2, {
      stage: "declined",
      decision: {
        decidedAt: START + 2 * DAY,
        decidedBy: "sender",
        notes: "Not eligible",
      },
    }),
    transfer(3, {
      stage: "cancelled",
      decision: {
        decidedAt: START + DAY,
        decidedBy: "sender",
        notes: "Wrong object",
      },
    }),
    open(4, "waiting_for_receiver"),
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
    within(cancelled as HTMLElement).getByTitle(
      "Object 3 · Cancelled by Museum Sør: Wrong object",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Showing 3 of 3")).toBeTruthy();
});

test("the sender sees its transfers awaiting the receiver's acceptance", async () => {
  await renderColumn(
    ["waiting_for_receiver"],
    [
      open(1, "waiting_for_receiver"),
      open(2, "waiting_for_receiver", { direction: "incoming" }),
    ],
  );

  expect(screen.getByText("Object 1")).toBeTruthy();
  expect(screen.queryByText("Object 2")).toBeNull();
  expect(screen.getByText("Awaiting acceptance")).toBeTruthy();
});

test("an empty awaiting-acceptance column says nothing waits for a receiver", async () => {
  await renderColumn(["waiting_for_receiver"], []);

  expect(
    screen.getByText("No transfers are waiting for a receiver to accept them."),
  ).toBeTruthy();
});

test("pending transfers keep their cards", async () => {
  await renderColumn(["waiting_for_sender"], [open(1, "waiting_for_sender")]);

  expect(screen.queryAllByRole("listitem")).toEqual([]);
  expect(screen.getByText("Ola Nordmann")).toBeTruthy();
  expect(
    screen.getByText("Chosen by the receiving organization when it accepts"),
  ).toBeTruthy();
});

test("a transfer the sender must approve again says so on its card", async () => {
  await renderColumn(
    ["waiting_for_sender"],
    [open(1, "waiting_for_sender", { awaitsSenderReapproval: true })],
  );

  expect(screen.getByText("Object 1")).toBeTruthy();
  expect(screen.getByText("Pending transfer approval")).toBeTruthy();
  expect(
    screen.getByText(
      "Approved under an earlier version of transfers, so the sending organization has to approve it again before the receiving organization decides.",
    ),
  ).toBeTruthy();
});
