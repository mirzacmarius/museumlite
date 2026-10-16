// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MyWorkSummary } from "./my-work-cards";
import { MyWorkBoard } from "./work-board";

const NOW = Date.UTC(2026, 9, 15, 9);
const NO_APPROVALS = {
  accession: 0,
  deaccession: 0,
  loan: 0,
  exhibition: 0,
  conservation: 0,
  imageDeletion: 0,
};

const work = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  pages: {} as Record<string, { results: unknown[]; status: string }>,
  permissions: new Set<string>(),
}));

function pageKey(query: never, args: unknown) {
  const status = (args as { status?: string }).status;
  return status
    ? `${getFunctionName(query)}:${status}`
    : getFunctionName(query);
}

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) =>
    args === "skip" ? undefined : work.queries[getFunctionName(query)],
  usePaginatedQuery: (query: never, args: unknown) =>
    args === "skip"
      ? { results: [], status: "LoadingFirstPage" }
      : (work.pages[pageKey(query, args)] ?? {
          results: [],
          status: "LoadingFirstPage",
        }),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    isLoading: false,
    hasPermission: (permission: string) => work.permissions.has(permission),
  }),
}));

function assignments(pendingApprovalsByType: typeof NO_APPROVALS) {
  return {
    pendingApprovals: [],
    myAssignedAccessions: [],
    recentlyModified: [],
    myCatalogedItems: [],
    stats: {
      totalPendingApprovals: Object.values(pendingApprovalsByType).reduce(
        (total, count) => total + count,
        0,
      ),
      pendingApprovalsByType,
      totalAssignedAccessions: 0,
      totalCatalogedItems: 0,
      itemsModifiedThisWeek: 0,
    },
  };
}

function page(count: number, status = "Exhausted") {
  return {
    results: Array.from({ length: count }, (_, index) => ({ _id: index })),
    status,
  };
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  work.permissions = new Set();
  work.queries = {
    "assignments:listMyAssignments": assignments(NO_APPROVALS),
    "caseTasks:listMyAssignedCases": { cases: [], truncated: false },
  };
  work.pages = {
    "caseTasks:listMyWork": page(0),
    "caseTasks:listReviewQueue": page(0),
  };
});

async function renderSummary() {
  await renderOnPage(
    <MyWorkSummary organizationId={"org" as Id<"organizations">} />,
  );
}

function hrefOf(name: string) {
  return screen.getByRole("link", { name }).getAttribute("href");
}

test("shows a card per kind of work waiting, each opening that kind's page", async () => {
  work.queries["assignments:listMyAssignments"] = assignments({
    accession: 3,
    deaccession: 2,
    loan: 0,
    exhibition: 1,
    conservation: 1,
    imageDeletion: 2,
  });
  work.pages["caseTasks:listMyWork"] = page(20, "CanLoadMore");

  await renderSummary();

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "My tasks 20+",
    "Pending accession approval 3",
    "Pending deaccession approval 2",
    "Pending exhibition approval 1",
    "Pending conservation approval 1",
    "Pending image deletion approval 2",
  ]);
  expect(hrefOf("My tasks 20+")).toBe("/assignments");
  expect(hrefOf("Pending accession approval 3")).toBe(
    "/accessions?status=pending",
  );
  expect(hrefOf("Pending deaccession approval 2")).toBe(
    "/deaccessions?status=pending",
  );
  expect(hrefOf("Pending exhibition approval 1")).toBe(
    `/exhibitions?lifecycle=proposed&asOf=${NOW}`,
  );
  expect(hrefOf("Pending conservation approval 1")).toBe(
    "/conservation?status=proposed",
  );
  expect(hrefOf("Pending image deletion approval 2")).toBe("/image-deletions");
});

test("condition assessments awaiting approval follow the other approval cards and open the approval page", async () => {
  work.queries["assignments:listMyAssignments"] = assignments({
    ...NO_APPROVALS,
    conservation: 1,
  });
  work.queries["conditionAssessments:pendingApprovalCount"] = {
    count: 99,
    hasMore: true,
  };
  work.permissions = new Set(["collections.accept_condition"]);

  await renderSummary();

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "View All",
    "Pending conservation approval 1",
    "Pending condition approval 99+",
  ]);
  expect(hrefOf("Pending condition approval 99+")).toBe(
    "/condition-assessments?status=pending",
  );
});

test("members who cannot accept condition assessments see no condition card", async () => {
  work.queries["conditionAssessments:pendingApprovalCount"] = {
    count: 2,
    hasMore: false,
  };

  await renderSummary();

  expect(screen.queryAllByRole("link")).toEqual([]);
  expect(screen.getByText("No work waiting for you.")).toBeTruthy();
});

test("provenance claims count only for members who review provenance", async () => {
  work.pages["provenance:reviewQueue:unreviewed"] = page(2);
  work.pages["provenance:reviewQueue:disputed"] = page(1);
  work.permissions = new Set(["collections.review_provenance"]);

  await renderSummary();

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Provenance claims to review 3",
  ]);
  expect(hrefOf("Provenance claims to review 3")).toBe("/assignments");
});

test("members who do not review provenance see no claims card", async () => {
  work.pages["provenance:reviewQueue:unreviewed"] = page(2);
  work.pages["provenance:reviewQueue:disputed"] = page(1);

  await renderSummary();

  expect(screen.queryAllByRole("link")).toEqual([]);
  expect(screen.getByText("No work waiting for you.")).toBeTruthy();
});

function pendingTransfers(count: number, truncated = false) {
  return {
    requests: Array.from({ length: count }, (_, index) => ({
      _id: `transfer-${index}`,
      collectionTitle: `Object ${index}`,
      sourceAccessionNumber: `SRC-${index}`,
      direction: index === 0 ? "incoming" : "outgoing",
    })),
    truncated,
  };
}

test("transfer managers see pending transfers after the approval cards, opening Transfers", async () => {
  work.queries["assignments:listMyAssignments"] = assignments({
    ...NO_APPROVALS,
    conservation: 1,
  });
  work.queries["objectMoves:listAwaitingDecision"] = pendingTransfers(2);
  work.permissions = new Set(["organization.manage_settings"]);

  await renderSummary();

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "View All",
    "Pending conservation approval 1",
    "Pending transfers 2",
  ]);
  expect(hrefOf("Pending transfers 2")).toBe("/accessions/transfers");
});

test("a capped transfer list reads as more than its count", async () => {
  work.queries["objectMoves:listAwaitingDecision"] = pendingTransfers(50, true);
  work.permissions = new Set(["organization.manage_settings"]);

  await renderSummary();

  expect(
    screen.getByRole("link", { name: "Pending transfers 50+" }),
  ).toBeTruthy();
});

test("members who cannot decide transfers see no transfers card", async () => {
  work.queries["objectMoves:listAwaitingDecision"] = pendingTransfers(2);

  await renderSummary();

  expect(screen.queryAllByRole("link")).toEqual([]);
  expect(screen.getByText("No work waiting for you.")).toBeTruthy();
});

test("the My work board lists each waiting transfer and links to the rest", async () => {
  work.queries["objectMoves:listAwaitingDecision"] = pendingTransfers(2, true);
  work.permissions = new Set(["organization.manage_settings"]);

  await renderOnPage(
    <MyWorkBoard organizationId={"org" as Id<"organizations">} />,
  );

  const column = within(
    screen.getByRole("heading", { name: /^Pending transfers\s*2\+$/ })
      .parentElement as HTMLElement,
  );
  expect(
    column
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    [
      "Object 0SRC-0 · Awaiting acceptance",
      "/objects/move-requests/transfer-0",
    ],
    [
      "Object 1SRC-1 · Pending transfer approval",
      "/objects/move-requests/transfer-1",
    ],
    ["View All", "/accessions/transfers"],
  ]);
});

test("links to My work when no card already opens it", async () => {
  work.queries["assignments:listMyAssignments"] = assignments({
    ...NO_APPROVALS,
    loan: 4,
  });

  await renderSummary();

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "View All",
    "Pending loan approval 4",
  ]);
  expect(hrefOf("Pending loan approval 4")).toBe("/loans?status=pending");
  expect(hrefOf("View All")).toBe("/assignments");
});

test("shows loaded work while another queue is still loading", async () => {
  work.queries["assignments:listMyAssignments"] = assignments({
    ...NO_APPROVALS,
    accession: 5,
  });
  work.pages["caseTasks:listReviewQueue"] = page(0, "LoadingFirstPage");

  await renderSummary();

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Pending accession approval 5",
  ]);
  expect(screen.queryByText("No work waiting for you.")).toBeNull();
});

test("with nothing waiting, one quiet line replaces the cards", async () => {
  await renderSummary();

  expect(screen.getByRole("heading", { name: "My work" })).toBeTruthy();
  expect(screen.getByText("No work waiting for you.")).toBeTruthy();
  expect(screen.queryAllByRole("link")).toEqual([]);
});
