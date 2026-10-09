import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as reporting from "../convex/reporting";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
  expectReady,
  rebuildProjection,
} from "./testHarness";

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;
const NOW = Date.UTC(2026, 8, 17, 12);

afterEach(() => {
  vi.useRealTimers();
});

async function setup(t: ConvexTest) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [
      "loans.read",
      "organization.manage_settings",
      "organization.view_analytics",
      "collections.read",
      "collections.update",
    ],
    { subscriptionTier: "pro", slugPrefix: "insurance-health" },
  );
  const staff = authedForUser(t, userId);
  const [firstId, secondId, loanId] = await t.run(async (ctx) => {
    const object = (title: string) =>
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `HL-${title}`,
        title,
        status: "active",
        catalogedBy: userId,
        catalogedAt: NOW,
      });
    return [
      await object("First"),
      await object("Second"),
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "LN-HEALTH",
        type: "outgoing",
        lenderBorrowerName: "Partner Museum",
        startDate: NOW,
        status: "active",
      }),
    ] as const;
  });
  return { organizationId, userId, staff, firstId, secondId, loanId };
}

async function health(
  staff: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
) {
  const result = await staff.query(api.reporting.getCollectionHealthDashboard, {
    organizationId,
    now: NOW,
  });
  expectMatchesReturns(reporting.getCollectionHealthDashboard, result);
  return expectReady(result).insurance;
}

test("the collection health dashboard reports covered value per currency and stale current valuations only", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, userId, staff, firstId, secondId, loanId } =
    await setup(t);
  await rebuildProjection(t, organizationId);

  const policyId = await staff.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-HEALTH",
    carrier: "Underwriters",
    policyType: "scheduled",
    coverageAmount: 1_000_000,
    currency: "EUR",
    effectiveDate: NOW - 100 * DAY,
    expirationDate: NOW + 265 * DAY,
  });
  for (const [target, coveredValue, currency] of [
    [{ kind: "object" as const, collectionId: firstId }, 25_000, "EUR"],
    [{ kind: "object" as const, collectionId: secondId }, 5_000, "EUR"],
    [{ kind: "loan" as const, loanId }, 13_500, "USD"],
  ] as const) {
    await staff.mutation(api.insurance.addCoverage, {
      policyId,
      target,
      coveredValue,
      currency,
    });
  }
  const appraise = (
    collectionId: Id<"collections">,
    appraisalDate: number,
    value: number,
  ) =>
    staff.mutation(api.appraisals.create, {
      collectionId,
      appraisalDate,
      appraiserName: "Valuer",
      appraisalType: "insurance",
      value,
      currency: "EUR",
    });
  await appraise(firstId, NOW - 5 * YEAR, 20_000);
  await appraise(firstId, NOW - 30 * DAY, 25_000);
  const corrected = await appraise(secondId, NOW - 4 * YEAR, 5_000);
  await staff.mutation(api.appraisals.supersede, {
    appraisalId: corrected,
    reason: "Figure transposed",
    appraisalDate: NOW - 4 * YEAR,
    appraiserName: "Valuer",
    appraisalType: "insurance",
    value: 5_200,
    currency: "EUR",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("insuranceCoverages", {
      organizationId,
      policyId,
      collectionId: secondId,
      loanId,
      coveredValue: 777,
      status: "active",
      createdBy: userId,
      createdAt: NOW - 50 * DAY,
    });
  });
  await rebuildProjection(t, organizationId);

  expect(await health(staff, organizationId)).toEqual({
    coveredValueByCurrency: [
      { currency: "EUR", total: 30_000 },
      { currency: "USD", total: 13_500 },
    ],
    coveragesWithoutCurrency: 0,
    coveragesNeedingReview: 1,
    objectsWithCoverage: 2,
    objectsWithoutCoverage: 0,
    expiringPolicies: 0,
    pendingClaims: 0,
    staleAppraisals: 1,
  });
});

test("valuations recorded before purpose-scoped currency count once the backfill runs", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, userId, staff, firstId } = await setup(t);
  await t.run(async (ctx) => {
    for (const [appraisalDate, value] of [
      [NOW - 6 * YEAR, 1_000],
      [NOW - 4 * YEAR, 2_000],
    ] as const) {
      await ctx.db.insert("appraisals", {
        organizationId,
        collectionId: firstId,
        appraisalDate,
        appraiserName: "Legacy valuer",
        appraisalType: "insurance",
        value,
        currency: "EUR",
        createdBy: userId,
        createdAt: appraisalDate,
        isCurrentAppraisal: true,
      });
    }
  });
  await rebuildProjection(t, organizationId);
  expect((await health(staff, organizationId)).staleAppraisals).toBe(0);

  await t.mutation(internal.appraisals.backfillCurrentValuations, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect((await health(staff, organizationId)).staleAppraisals).toBe(1);
});
