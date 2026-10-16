// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ConditionAssessmentsPageClient } from "./condition-assessments-page-client";

const board = vi.hoisted(() => ({
  permissions: new Set<string>(),
  columnArgs: [] as unknown[],
  accept: vi.fn(),
  reject: vi.fn(),
}));

function row(
  id: string,
  status: "draft" | "submitted" | "accepted" | "rejected",
  overrides: Record<string, unknown> = {},
) {
  return {
    _id: id,
    _creationTime: 1,
    collectionId: `object-${id}`,
    objectTitle: `Vase ${id}`,
    accessionNumber: `A-${id}`,
    status,
    condition: "Poor",
    summary: `Summary ${id}`,
    observationCount: 1,
    photoCount: 0,
    assessedAt: Date.UTC(2026, 9, 1, 12),
    assessorName: "Kari",
    submittedAt: status === "draft" ? null : Date.UTC(2026, 9, 2, 12),
    decidedAt:
      status === "accepted" || status === "rejected"
        ? Date.UTC(2026, 9, 3, 12)
        : null,
    decidedByName:
      status === "accepted" || status === "rejected" ? "Ola" : null,
    rejectionReason: null,
    ...overrides,
  };
}

const rows = {
  draft: [row("1", "draft")],
  submitted: [row("2", "submitted")],
  accepted: [row("3", "accepted")],
  rejected: [row("4", "rejected", { rejectionReason: "Photos missing" })],
};

vi.mock("convex/react", () => ({
  useQuery: (query: never) =>
    getFunctionName(query) === "conditionAssessments:getBoardCounts"
      ? {
          draft: { count: 1, hasMore: false },
          submitted: { count: 1, hasMore: false },
          accepted: { count: 999, hasMore: true },
          rejected: { count: 1, hasMore: false },
        }
      : undefined,
  usePaginatedQuery: (_query: never, args: { column: keyof typeof rows }) => {
    board.columnArgs.push(args);
    return {
      results: rows[args.column],
      status: "Exhausted",
      loadMore: () => {},
    };
  },
  useMutation: (mutation: never) =>
    getFunctionName(mutation) === "conditionAssessments:accept"
      ? board.accept
      : board.reject,
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    isLoading: false,
    hasPermission: (permission: string) => board.permissions.has(permission),
  }),
}));

beforeEach(() => {
  board.permissions = new Set(["collections.read"]);
  board.columnArgs = [];
  board.accept.mockReset().mockResolvedValue(null);
  board.reject.mockReset().mockResolvedValue(null);
});

async function renderBoard(url: string) {
  await renderOnPage(
    <ConditionAssessmentsPageClient
      organizationId={"org" as Id<"organizations">}
    />,
    url,
  );
  return userEvent.setup();
}

function columnTitles() {
  return screen
    .getAllByRole("region")
    .map((region) => region.getAttribute("aria-label"));
}

test("the board shows drafts, assessments awaiting approval and the accepted log", async () => {
  await renderBoard("/en/condition-assessments");

  expect(columnTitles()).toEqual(["Drafts", "Awaiting approval", "Accepted"]);
  const accepted = screen.getByRole("region", { name: "Accepted" });
  expect(within(accepted).getByTitle("Vase 3 · Poor")).toBeTruthy();
  // Past the count limit the column shows what it loaded, and the stat "+".
  expect(within(accepted).getByText("1")).toBeTruthy();
  expect(screen.getByText("999+")).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Awaiting approval" }))
      .getByRole("link", { name: /Vase 2/ })
      .getAttribute("href"),
  ).toBe("/objects/object-2?tab=physical&from=%2Fcondition-assessments");
  expect(screen.queryByRole("button", { name: /assessment$/ })).toBeNull();
});

test("reviewers can reject a draft nobody will finish, but not accept it", async () => {
  board.permissions.add("collections.accept_condition");
  const user = await renderBoard("/en/condition-assessments");

  const drafts = within(screen.getByRole("region", { name: "Drafts" }));
  expect(
    drafts.queryByRole("button", { name: "Accept assessment" }),
  ).toBeNull();
  await user.click(drafts.getByRole("button", { name: "Reject assessment" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Reject assessment",
    }),
  );

  expect(board.reject).toHaveBeenCalledWith({ assessmentId: "1" });
});

test("the pending filter shows only assessments awaiting approval, which reviewers accept there", async () => {
  board.permissions.add("collections.accept_condition");
  const user = await renderBoard("/en/condition-assessments?status=pending");

  expect(columnTitles()).toEqual(["Awaiting approval"]);
  expect(
    screen
      .getByRole("button", { name: "Awaiting approval" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  await user.click(screen.getByRole("button", { name: "Accept assessment" }));

  expect(board.accept).toHaveBeenCalledWith({ assessmentId: "2" });
});

test("the rejected filter lists rejected assessments with the reason", async () => {
  await renderBoard("/en/condition-assessments?status=rejected");

  expect(columnTitles()).toEqual(["Rejected"]);
  const rejected = screen.getByRole("region", { name: "Rejected" });
  expect(
    within(rejected).getByText("Reason for rejection: Photos missing"),
  ).toBeTruthy();
  expect(within(rejected).getByText("Decided by Ola")).toBeTruthy();
});
