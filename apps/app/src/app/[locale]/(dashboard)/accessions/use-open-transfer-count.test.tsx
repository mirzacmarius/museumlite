// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AccessionsWorkbenchNav } from "./accessions-workbench-nav";
import { useOpenTransferCount } from "./use-open-transfer-count";

type TransferRequest = FunctionReturnType<
  typeof api.objectMoves.listForOrganization
>[number];

const ORGANIZATION = "org" as Id<"organizations">;

const state = vi.hoisted(() => ({
  transfers: undefined as unknown,
  permissions: new Set<string>(),
  queried: [] as unknown[],
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    state.queried.push(args);
    return getFunctionName(query) === "objectMoves:listForOrganization"
      ? state.transfers
      : undefined;
  },
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    isLoading: false,
    hasPermission: (permission: string) => state.permissions.has(permission),
  }),
}));

function transfer(
  index: number,
  status: TransferRequest["status"],
  direction: TransferRequest["direction"],
): TransferRequest {
  return {
    _id: `move-${index}` as Id<"organizationMoveRequests">,
    collectionId: `object-${index}` as Id<"collections">,
    collectionTitle: `Object ${index}`,
    sourceAccessionNumber: `112-2026-${index}`,
    accessionMode: "keep",
    targetOrganizationId: "target" as Id<"organizations">,
    targetOrganizationName: "Museum Nord",
    reason: "Rotation",
    status,
    requestedBy: "user" as Id<"users">,
    requestedByName: "Ola Nordmann",
    requestedAt: Date.UTC(2026, 9, 1) + index,
    direction,
    awaitsSourceReapproval: false,
  };
}

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
  state.transfers = undefined;
  state.permissions = new Set(["organization.manage_settings"]);
  state.queried = [];
});

test("the Transfers tab counts transfers waiting for approval and incoming ones waiting for acceptance, as the board's Pending and Incoming columns do", async () => {
  state.transfers = [
    transfer(1, "pending_source_approval", "outgoing"),
    transfer(2, "awaiting_acceptance", "incoming"),
    transfer(3, "awaiting_acceptance", "outgoing"),
    transfer(4, "executed", "outgoing"),
    transfer(5, "rejected", "outgoing"),
    transfer(6, "cancelled", "outgoing"),
  ];

  await renderOnPage(<AccessionsView />, "/en/accessions");

  expect(within(transfersTab()).getByText("2")).toBeTruthy();
  expect(state.queried.length).toBeGreaterThan(0);
  for (const args of state.queried) {
    expect(args).toEqual({ organizationId: ORGANIZATION });
  }
});

test("an older approval the source must re-approve counts as waiting for approval, not for the receiver", async () => {
  state.transfers = [
    {
      ...transfer(1, "awaiting_acceptance", "outgoing"),
      awaitsSourceReapproval: true,
    },
    transfer(2, "awaiting_acceptance", "outgoing"),
  ];

  await renderOnPage(<AccessionsView />, "/en/accessions");

  expect(within(transfersTab()).getByText("1")).toBeTruthy();
});

test("the Transfers tab shows no count while loading or for members who cannot review transfers", async () => {
  const { rerender } = await renderOnPage(<AccessionsView />, "/en/accessions");
  expect(within(transfersTab()).getByText("-")).toBeTruthy();

  state.permissions = new Set();
  state.transfers = [transfer(1, "pending_source_approval", "outgoing")];
  state.queried = [];
  rerender(<AccessionsView />);

  expect(within(transfersTab()).getByText("-")).toBeTruthy();
  expect(state.queried).toEqual([]);
});
