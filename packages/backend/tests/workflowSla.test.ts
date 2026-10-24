import { afterEach, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import * as permissions from "../convex/utils/permissions";
import { createConvexTest, createOrgUserWithPermissions } from "./testHarness";

// Wraps the approver lookup, which reads every member's role permissions, so
// the test can count how often the check runs it.
vi.mock("../convex/utils/permissions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../convex/utils/permissions")>();
  return {
    ...actual,
    getUserIdsWithPermission: vi.fn(actual.getUserIdsWithPermission),
  };
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 17, 12);

afterEach(() => {
  vi.useRealTimers();
});

test("the SLA check looks up a workflow type's approvers once per run, and not at all for items it already reported", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["loans.read", "loans.approve"],
    { subscriptionTier: "pro" },
  );
  await t.run(async (ctx) => {
    for (const loanNumber of ["LN-SLA-1", "LN-SLA-2"]) {
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber,
        type: "outgoing",
        lenderBorrowerName: "Harbour Museum",
        startDate: NOW - 10 * DAY,
        status: "pending",
      });
    }
    await ctx.db.insert("workflowSlaConfigs", {
      organizationId,
      workflowType: "loan",
      slaDays: 5,
      escalateToRoleId: roleId,
      isActive: true,
      createdBy: userId,
      createdAt: NOW - 20 * DAY,
    });
  });
  const lookups = vi.mocked(permissions.getUserIdsWithPermission);
  lookups.mockClear();

  await t.mutation(internal.workflowSla.checkSlaBreaches, { organizationId });
  expect(lookups).toHaveBeenCalledTimes(1);

  lookups.mockClear();
  vi.advanceTimersByTime(12 * 60 * 60 * 1000);
  expect(
    await t.mutation(internal.workflowSla.checkSlaBreaches, { organizationId }),
  ).toEqual({ breachesFound: 2, warningsSent: 0 });
  expect(lookups).not.toHaveBeenCalled();
});
