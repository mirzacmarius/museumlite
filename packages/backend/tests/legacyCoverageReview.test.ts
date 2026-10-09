import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as insuranceCoverageReviews from "../convex/insuranceCoverageReviews";
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

/** An organization with one legacy coverage naming an object and a loan. */
async function setupLegacyCoverage(t: ConvexTest) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [
      "loans.read",
      "organization.manage_settings",
      "collections.read",
      "collections.update",
    ],
    { subscriptionTier: "pro", slugPrefix: "legacy-coverage" },
  );
  const ids = await t.run(async (ctx) => {
    const objectId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "LEG-1",
      title: "Landscape",
      status: "active",
      catalogedBy: userId,
      catalogedAt: NOW,
    });
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LN-LEG",
      type: "outgoing",
      lenderBorrowerName: "City Gallery",
      startDate: NOW - 20 * DAY,
      status: "active",
    });
    const policyId = await ctx.db.insert("insurancePolicies", {
      organizationId,
      policyNumber: "POL-LEGACY",
      carrier: "Legacy Mutual",
      policyType: "blanket",
      coverageAmount: 500_000,
      effectiveDate: NOW - 200 * DAY,
      expirationDate: NOW + 200 * DAY,
      status: "active",
      createdBy: userId,
      createdAt: NOW - 200 * DAY,
    });
    const coverageId = await ctx.db.insert("insuranceCoverages", {
      organizationId,
      policyId,
      collectionId: objectId,
      loanId,
      coveredValue: 40_000,
      status: "active",
      createdBy: userId,
      createdAt: NOW - 100 * DAY,
    });
    return { objectId, loanId, policyId, coverageId };
  });
  return { organizationId, userId, staff: authedForUser(t, userId), ...ids };
}

async function enqueueReviews(t: ConvexTest) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  await t.mutation(
    internal.insuranceCoverageReviews.enqueueLegacyCoverageReviews,
    {},
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

test("legacy coverages naming several targets wait in a review queue without automatic changes", async () => {
  const t = createConvexTest();
  const { organizationId, staff, objectId, loanId, coverageId } =
    await setupLegacyCoverage(t);

  await enqueueReviews(t);
  await enqueueReviews(t);

  const queue = await staff.query(api.insuranceCoverageReviews.list, {
    organizationId,
    status: "open",
  });
  expectMatchesReturns(insuranceCoverageReviews.list, queue);
  expect(queue.openCount).toBe(1);
  expect(queue.reviews).toMatchObject([
    {
      coverageId,
      policyNumber: "POL-LEGACY",
      coveredValue: 40_000,
      status: "open",
      targets: [
        { kind: "object", id: objectId, label: "Landscape" },
        { kind: "loan", id: loanId, label: "City Gallery" },
      ],
    },
  ]);
  const coverages = await staff.query(api.insurance.listCoverages, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(coverages.page).toMatchObject([
    { _id: coverageId, state: "needs_review", target: null },
  ]);
  const uncovered = await staff.query(api.insurance.getUncoveredObjects, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(uncovered.page.map((object) => object._id)).toEqual([objectId]);
});

test("a reviewer keeps one target and splits the other into its own coverage with an explicit value", async () => {
  const t = createConvexTest();
  const { organizationId, staff, objectId, loanId, coverageId } =
    await setupLegacyCoverage(t);
  await enqueueReviews(t);
  const [review] = (
    await staff.query(api.insuranceCoverageReviews.list, {
      organizationId,
      status: "open",
    })
  ).reviews;
  if (!review) throw new Error("review missing");

  const result = await staff.mutation(api.insuranceCoverageReviews.resolve, {
    reviewId: review._id,
    keep: "object",
    currency: "EUR",
    split: [{ kind: "loan", coveredValue: 15_000, currency: "EUR" }],
    note: "Schedule lists the loan separately",
  });
  expect(result.createdCoverageIds).toHaveLength(1);

  const coverages = await staff.query(api.insurance.listCoverages, {
    organizationId,
    now: NOW,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(
    coverages.page
      .map((coverage) => ({
        target: coverage.target?.kind,
        targetId: coverage.target?.id,
        coveredValue: coverage.coveredValue,
        currency: coverage.currency,
        state: coverage.state,
        splitFromCoverageId: coverage.splitFromCoverageId,
      }))
      .sort((a, b) => b.coveredValue - a.coveredValue),
  ).toEqual([
    {
      target: "object",
      targetId: objectId,
      coveredValue: 40_000,
      currency: "EUR",
      state: "in_force",
      splitFromCoverageId: undefined,
    },
    {
      target: "loan",
      targetId: loanId,
      coveredValue: 15_000,
      currency: "EUR",
      state: "in_force",
      splitFromCoverageId: coverageId,
    },
  ]);

  const resolved = await staff.query(api.insuranceCoverageReviews.list, {
    organizationId,
    status: "resolved",
  });
  expect(resolved.reviews).toMatchObject([
    {
      _id: review._id,
      status: "resolved",
      targets: [
        { kind: "object", id: objectId },
        { kind: "loan", id: loanId },
      ],
      resolution: {
        keptTarget: "object",
        createdCoverageIds: result.createdCoverageIds,
        note: "Schedule lists the loan separately",
      },
    },
  ]);
  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insuranceCoverageReviews.resolve, {
          reviewId: review._id,
          keep: "loan",
        }),
      )
    )?.code,
  ).toBe("LEGACY_REVIEW_RESOLVED");
});

test("a review resolution can only choose among the legacy targets", async () => {
  const t = createConvexTest();
  const { organizationId, staff } = await setupLegacyCoverage(t);
  await enqueueReviews(t);
  const [review] = (
    await staff.query(api.insuranceCoverageReviews.list, {
      organizationId,
      status: "open",
    })
  ).reviews;
  if (!review) throw new Error("review missing");

  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insuranceCoverageReviews.resolve, {
          reviewId: review._id,
          keep: "exhibition",
        }),
      )
    )?.code,
  ).toBe("LEGACY_REVIEW_TARGET_INVALID");
  expect(
    (
      await valuationErrorOf(
        staff.mutation(api.insuranceCoverageReviews.resolve, {
          reviewId: review._id,
          keep: "object",
          split: [{ kind: "object", coveredValue: 1, currency: "EUR" }],
        }),
      )
    )?.code,
  ).toBe("LEGACY_REVIEW_TARGET_INVALID");
  const queue = await staff.query(api.insuranceCoverageReviews.list, {
    organizationId,
    status: "open",
  });
  expect(queue.openCount).toBe(1);
});

test("staff without settings permission can read the review queue but not resolve it", async () => {
  const t = createConvexTest();
  const { organizationId } = await setupLegacyCoverage(t);
  await enqueueReviews(t);
  const readerId: Id<"users"> = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "review-reader@example.com",
      name: "Review reader",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Loans reader",
      isSystemRole: false,
    });
    const permissionId = await ctx.db.insert("permissions", {
      name: "loans.read",
      category: "loans",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: NOW,
    });
    return userId;
  });
  const reader = authedForUser(t, readerId);
  const [review] = (
    await reader.query(api.insuranceCoverageReviews.list, {
      organizationId,
      status: "open",
    })
  ).reviews;
  if (!review) throw new Error("review missing");

  await expect(
    reader.mutation(api.insuranceCoverageReviews.resolve, {
      reviewId: review._id,
      keep: "object",
    }),
  ).rejects.toThrow("Permission denied");
});
