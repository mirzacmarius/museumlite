// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AccessionsWorkbenchNav } from "./accessions-workbench-nav";
import { useOpenTransferCount } from "./use-open-transfer-count";

const ORGANIZATION = "org" as Id<"organizations">;

const state = vi.hoisted(() => ({
  counts: undefined as unknown,
  queried: [] as unknown[],
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    state.queried.push(args);
    return getFunctionName(query) === "objectMoves:getBoardCounts"
      ? state.counts
      : undefined;
  },
}));

/** What the overview, Entries and Transfers views each render. */
function AccessionsView() {
  return (
    <AccessionsWorkbenchNav
      activeView="overview"
      pendingAccessions={0}
      openTransfers={useOpenTransferCount(ORGANIZATION)}
    />
  );
}

function transfersTab() {
  return screen.getByRole("link", { name: /Transfers/ });
}

beforeEach(() => {
  state.counts = undefined;
  state.queried = [];
});

test("the Transfers tab shows what waits on the organization's decision, as the backend counts it", async () => {
  state.counts = {
    waitingForApproval: 1,
    waitingForReceiver: 3,
    incoming: 1,
    received: 4,
    declined: 1,
    cancelled: 1,
    awaitingDecision: 2,
  };

  await renderOnPage(<AccessionsView />, "/en/accessions");

  expect(within(transfersTab()).getByText("2")).toBeTruthy();
  for (const args of state.queried) {
    expect(args).toEqual({ organizationId: ORGANIZATION });
  }
});

test("the Transfers tab shows no count while loading or for members who cannot decide transfers", async () => {
  const { rerender } = await renderOnPage(<AccessionsView />, "/en/accessions");
  expect(within(transfersTab()).getByText("-")).toBeTruthy();

  state.counts = null;
  rerender(<AccessionsView />);

  expect(within(transfersTab()).getByText("-")).toBeTruthy();
});
