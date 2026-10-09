import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as insurance from "../convex/insurance";
import {
  type ValuationErrorData,
  valuationErrorFromError,
} from "../convex/utils/valuationErrors";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 17, 12);

afterEach(() => {
  vi.useRealTimers();
});

const insurancePermissions = [
  "loans.read",
  "organization.manage_settings",
  "collections.read",
  "collections.update",
];

async function valuationErrorOf(
  call: Promise<unknown>,
): Promise<ValuationErrorData | null> {
  try {
    await call;
  } catch (error) {
    return valuationErrorFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

async function insertObject(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  title: string,
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `INS-${Math.random().toString(36).slice(2, 8)}`,
      title,
      status: "active",
      catalogedBy: userId,
      catalogedAt: NOW,
    }),
  );
}

async function setupRegistrar(t: ConvexTest, slugPrefix = "coverage") {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    insurancePermissions,
    { subscriptionTier: "pro", slugPrefix },
  );
  const staff = authedForUser(t, userId);
  const objectId = await insertObject(t, organizationId, userId, "Portrait");
  const loanId = await t.run(async (ctx) =>
    ctx.db.insert("loans", {
      organizationId,
      loanNumber: `LN-${Math.random().toString(36).slice(2, 6)}`,
      type: "outgoing",
      lenderBorrowerName: "Harbour Museum",
      startDate: NOW - 10 * DAY,
      status: "active",
    }),
  );
  return { organizationId, userId, staff, objectId, loanId };
}

async function createPolicy(
  staff: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
  overrides: Partial<{
    policyNumber: string;
    currency: string;
    effectiveDate: number;
    expirationDate: number;
  }> = {},
) {
  return await staff.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: `POL-${Math.random().toString(36).slice(2, 8)}`,
    carrier: "Fine Art Underwriters",
    policyType: "scheduled",
    coverageAmount: 1_000_000,
    currency: "EUR",
    effectiveDate: NOW - 100 * DAY,
    expirationDate: NOW + 265 * DAY,
    ...overrides,
  });
}

test("each coverage names one typed target and its own currency", async () => {
  const t = createConvexTest();
  const { organizationId, staff, objectId, loanId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId);

  await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });
  await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "loan", loanId },
    coveredValue: 13_500,
    currency: "usd",
  });

  const coverages = await staff.query(api.insurance.listCoverages, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expectMatchesReturns(insurance.listCoverages, coverages);
  expect(
    coverages.page
      .map((coverage) => ({
        kind: coverage.target?.kind,
        label: coverage.target?.label,
        currency: coverage.currency,
        coveredValue: coverage.coveredValue,
        state: coverage.state,
      }))
      .sort((a, b) => a.coveredValue - b.coveredValue),
  ).toEqual([
    {
      kind: "loan",
      label: "Harbour Museum",
      currency: "USD",
      coveredValue: 13_500,
      state: "in_force",
    },
    {
      kind: "object",
      label: "Portrait",
      currency: "EUR",
      coveredValue: 25_000,
      state: "in_force",
    },
  ]);
});

test("a coverage interval must lie inside its policy period", async () => {
  const t = createConvexTest();
  const { organizationId, staff, objectId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId);
  const add = (effectiveDate?: number, expirationDate?: number) =>
    staff.mutation(api.insurance.addCoverage, {
      policyId,
      target: { kind: "object", collectionId: objectId },
      coveredValue: 1_000,
      currency: "EUR",
      effectiveDate,
      expirationDate,
    });

  expect((await valuationErrorOf(add(NOW - 101 * DAY)))?.code).toBe(
    "COVERAGE_OUTSIDE_POLICY_PERIOD",
  );
  expect((await valuationErrorOf(add(undefined, NOW + 266 * DAY)))?.code).toBe(
    "COVERAGE_OUTSIDE_POLICY_PERIOD",
  );
  expect(
    (await valuationErrorOf(add(NOW + 10 * DAY, NOW + 5 * DAY)))?.code,
  ).toBe("INVALID_COVERAGE_PERIOD");
  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insurance.addCoverage, {
          policyId,
          target: { kind: "object", collectionId: objectId },
          coveredValue: 1_000,
          currency: "euros",
        }),
      )
    )?.code,
  ).toBe("INVALID_CURRENCY");

  await add(NOW - 100 * DAY, NOW + 265 * DAY);
  const coverages = await staff.query(api.insurance.listCoverages, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(coverages.page).toHaveLength(1);
});

test("a coverage cannot name a target from another organization", async () => {
  const t = createConvexTest();
  const { organizationId, staff } = await setupRegistrar(t);
  const other = await setupRegistrar(t, "other-museum");
  const policyId = await createPolicy(staff, organizationId);

  const error = await valuationErrorOf(
    staff.mutation(api.insurance.addCoverage, {
      policyId,
      target: { kind: "object", collectionId: other.objectId },
      coveredValue: 1_000,
      currency: "EUR",
    }),
  );
  expect(error?.code).toBe("COVERAGE_TARGET_NOT_FOUND");
});

test("coverage totals are grouped by currency and never summed across currencies", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff, objectId, loanId } =
    await setupRegistrar(t);
  const secondObjectId = await insertObject(t, organizationId, userId, "Vase");
  const policyId = await createPolicy(staff, organizationId);
  for (const [target, coveredValue, currency] of [
    [{ kind: "object" as const, collectionId: objectId }, 25_000, "EUR"],
    [{ kind: "object" as const, collectionId: secondObjectId }, 5_000, "EUR"],
    [{ kind: "loan" as const, loanId }, 13_500, "USD"],
  ] as const) {
    await staff.mutation(api.insurance.addCoverage, {
      policyId,
      target,
      coveredValue,
      currency,
    });
  }
  // A legacy coverage recorded before currencies were required.
  await t.run(async (ctx) => {
    await ctx.db.insert("insuranceCoverages", {
      organizationId,
      policyId,
      collectionId: secondObjectId,
      coveredValue: 999,
      status: "active",
      createdBy: userId,
      createdAt: NOW - 50 * DAY,
    });
  });

  const alerts = await staff.query(api.insurance.getCoverageAlerts, {
    organizationId,
    now: NOW,
  });
  expectMatchesReturns(insurance.getCoverageAlerts, alerts);
  expect(alerts.inForceValue).toEqual({
    byCurrency: [
      { currency: "EUR", total: 30_000, count: 2 },
      { currency: "USD", total: 13_500, count: 1 },
    ],
    currencyNotRecordedCount: 1,
  });
  const stats = await staff.query(api.insurance.getInsuranceStats, {
    organizationId,
    now: NOW,
  });
  expectMatchesReturns(insurance.getInsuranceStats, stats);
  expect(stats.inForceCoverageValue.byCurrency).toEqual([
    { currency: "EUR", total: 30_000, count: 2 },
    { currency: "USD", total: 13_500, count: 1 },
  ]);
  expect(stats).toMatchObject({
    totalCoveredItems: 2,
    uncoveredItemsCount: 0,
  });
});

test("cover under an expired policy no longer counts and the object becomes a gap", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, staff, objectId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId, {
    effectiveDate: NOW - 300 * DAY,
    expirationDate: NOW + 10 * DAY,
  });
  await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });
  const later = NOW + 20 * DAY;

  const before = await staff.query(api.insurance.getUncoveredObjects, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(before.page).toEqual([]);

  const policies = await staff.query(api.insurance.listPolicies, {
    organizationId,
    now: later,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(policies.page.map((policy) => policy.status)).toEqual(["expired"]);
  const uncovered = await staff.query(api.insurance.getUncoveredObjects, {
    organizationId,
    now: later,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(uncovered.page.map((object) => object._id)).toEqual([objectId]);
  const alerts = await staff.query(api.insurance.getCoverageAlerts, {
    organizationId,
    now: later,
  });
  expect(alerts).toMatchObject({
    inForceValue: { byCurrency: [], currencyNotRecordedCount: 0 },
    expiredPoliciesCount: 1,
    expiredPolicies: [{ _id: policyId, coverageCount: 1 }],
    uncoveredStats: { totalObjects: 1, coveredObjects: 0 },
  });
  const coverages = await staff.query(api.insurance.listCoverages, {
    organizationId,
    now: later,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(coverages.page.map((coverage) => coverage.state)).toEqual(["expired"]);
});

test("the daily insurance check records expiry on policies and their coverages", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, staff, objectId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId, {
    effectiveDate: NOW - 300 * DAY,
    expirationDate: NOW + 10 * DAY,
  });
  await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });

  vi.setSystemTime(NOW + 11 * DAY);
  await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const policy = await staff.query(api.insurance.getPolicy, {
    policyId,
    now: NOW + 11 * DAY,
  });
  expect(policy).toMatchObject({
    status: "expired",
    recordedStatus: "expired",
    coverages: [{ status: "expired", state: "expired" }],
  });
});

test("the daily insurance check expires a coverage whose own period ended inside an active policy", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, staff, objectId, loanId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId);
  const shortId = await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "loan", loanId },
    coveredValue: 4_000,
    currency: "EUR",
    expirationDate: NOW + 5 * DAY,
  });
  const fullId = await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });

  vi.setSystemTime(NOW + 6 * DAY);
  await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const policy = await staff.query(api.insurance.getPolicy, {
    policyId,
    now: NOW + 6 * DAY,
  });
  expect(policy?.recordedStatus).toBe("active");
  expect(
    Object.fromEntries(
      (policy?.coverages ?? []).map((coverage) => [
        coverage._id,
        coverage.status,
      ]),
    ),
  ).toEqual({ [shortId]: "expired", [fullId]: "active" });
});

test("the expiry notification reports covered values per currency", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTest();
  const { organizationId, staff, objectId, loanId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId, {
    policyNumber: "POL-NOTIFY",
    effectiveDate: NOW - 300 * DAY,
    expirationDate: NOW + 30 * DAY,
  });
  await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });
  await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "loan", loanId },
    coveredValue: 13_500,
    currency: "USD",
  });

  await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const { notifications } = await staff.query(api.audit.listNotifications, {
    organizationId,
  });
  expect(
    notifications
      .filter((notification) => notification.type === "insurance_expiry")
      .map((notification) => notification.message),
  ).toEqual([
    "Policy POL-NOTIFY (Fine Art Underwriters) covering 2 items valued at EUR 25,000; USD 13,500 expires in 30 days.",
  ]);
});

test("an appraisal from another organization or object cannot be linked to a coverage", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff, objectId } = await setupRegistrar(t);
  const other = await setupRegistrar(t, "other-museum");
  const policyId = await createPolicy(staff, organizationId);
  const coverageId = await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });
  const appraisal = {
    appraisalDate: NOW - 30 * DAY,
    appraiserName: "Valuer",
    appraisalType: "insurance" as const,
    value: 24_000,
  };
  const foreignAppraisalId = await other.staff.mutation(api.appraisals.create, {
    collectionId: other.objectId,
    currency: "EUR",
    ...appraisal,
  });
  const otherObjectId = await insertObject(t, organizationId, userId, "Bowl");
  const otherObjectAppraisalId = await staff.mutation(api.appraisals.create, {
    collectionId: otherObjectId,
    currency: "EUR",
    ...appraisal,
  });
  const dollarAppraisalId = await staff.mutation(api.appraisals.create, {
    collectionId: objectId,
    currency: "USD",
    ...appraisal,
  });

  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insurance.linkAppraisalToCoverage, {
          coverageId,
          appraisalId: foreignAppraisalId,
        }),
      )
    )?.code,
  ).toBe("APPRAISAL_NOT_FOR_COVERED_OBJECT");
  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insurance.linkAppraisalToCoverage, {
          coverageId,
          appraisalId: otherObjectAppraisalId,
        }),
      )
    )?.code,
  ).toBe("APPRAISAL_NOT_FOR_COVERED_OBJECT");
  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insurance.linkAppraisalToCoverage, {
          coverageId,
          appraisalId: dollarAppraisalId,
        }),
      )
    )?.code,
  ).toBe("APPRAISAL_CURRENCY_MISMATCH");

  const euroAppraisalId = await staff.mutation(api.appraisals.create, {
    collectionId: objectId,
    currency: "EUR",
    ...appraisal,
  });
  await staff.mutation(api.insurance.linkAppraisalToCoverage, {
    coverageId,
    appraisalId: euroAppraisalId,
  });
  const coverages = await staff.query(api.insurance.listCoverages, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(coverages.page[0]).toMatchObject({
    appraisalStatus: "current",
    currentAppraisal: { appraisalId: euroAppraisalId, currency: "EUR" },
  });
});

test("staff who can read insurance cannot add coverage or link appraisals", async () => {
  const t = createConvexTest();
  const { organizationId, staff, objectId } = await setupRegistrar(t);
  const policyId = await createPolicy(staff, organizationId);
  const coverageId = await staff.mutation(api.insurance.addCoverage, {
    policyId,
    target: { kind: "object", collectionId: objectId },
    coveredValue: 25_000,
    currency: "EUR",
  });
  const readerId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "insurance-reader@example.com",
      name: "Insurance reader",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Loans reader",
      isSystemRole: false,
    });
    for (const name of ["loans.read", "collections.read"]) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "loans",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: NOW,
    });
    return userId;
  });
  const reader = authedForUser(t, readerId);

  await expect(
    reader.mutation(api.insurance.addCoverage, {
      policyId,
      target: { kind: "object", collectionId: objectId },
      coveredValue: 1,
      currency: "EUR",
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    reader.mutation(api.insurance.removeCoverage, { coverageId }),
  ).rejects.toThrow("Permission denied");
  const coverages = await reader.query(api.insurance.listCoverages, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(coverages.page.map((coverage) => coverage.status)).toEqual(["active"]);
});
