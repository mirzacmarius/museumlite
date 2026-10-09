import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const insurancePermissions = [
  "loans.read",
  "organization.manage_settings",
] as const;

interface InsuranceFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  collectionId: Id<"collections">;
  authed: ReturnType<typeof authedForUser>;
}

async function setupInsuranceFixture(t: ConvexTest): Promise<InsuranceFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [...insurancePermissions],
    {
      subscriptionTier: "pro",
      slugPrefix: "insurance-test",
    },
  );

  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `INS-${Math.random().toString(36).slice(2, 8)}`,
      title: "Insured Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  return {
    organizationId,
    userId,
    collectionId,
    authed: authedForUser(t, userId),
  };
}

test("should create insurance policy with carrier info", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupInsuranceFixture(t);

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-001",
    carrier: "Fine Art Insurance Co",
    policyType: "blanket",
    coverageAmount: 1_000_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  const policy = await authed.query(api.insurance.getPolicy, { policyId });

  expect(policy).not.toBeNull();
  expect(policy?.carrier).toBe("Fine Art Insurance Co");
  expect(policy?.policyNumber).toBe("POL-001");
});

test("should add coverage for collection object", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, authed } =
    await setupInsuranceFixture(t);

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-002",
    carrier: "Coverage Carrier",
    policyType: "scheduled",
    coverageAmount: 500_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  const coverageId = await authed.mutation(api.insurance.addCoverage, {
    policyId,
    collectionId,
    coveredValue: 25_000,
  });

  expect(coverageId).toBeDefined();

  const coverages = await authed.query(api.insurance.getCoverageForObject, {
    collectionId,
  });

  expect(coverages.some((entry) => entry._id === coverageId)).toBe(true);
});

test("should create claim with auto-generated number", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, authed } =
    await setupInsuranceFixture(t);

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-003",
    carrier: "Claims Carrier",
    policyType: "blanket",
    coverageAmount: 750_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  const claimId = await authed.mutation(api.insurance.createClaim, {
    organizationId,
    policyId,
    collectionIds: [collectionId],
    incidentDate: now,
    incidentType: "damage",
    incidentDescription: "Minor frame damage during handling",
    claimedAmount: 1200,
  });

  const claim = await authed.query(api.insurance.getClaim, { claimId });

  expect(claim).not.toBeNull();
  expect(claim?.claimNumber).toMatch(/^CLM-\d{4}-\d{4}$/);
  expect(claim?.status).toBe("draft");
});

test("should track claim status workflow", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupInsuranceFixture(t);

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-004",
    carrier: "Workflow Carrier",
    policyType: "blanket",
    coverageAmount: 500_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  const claimId = await authed.mutation(api.insurance.createClaim, {
    organizationId,
    policyId,
    incidentDate: now,
    incidentType: "other",
    incidentDescription: "Test claim workflow",
    claimedAmount: 500,
  });

  await authed.mutation(api.insurance.updateClaim, {
    claimId,
    status: "submitted",
  });

  const claim = await authed.query(api.insurance.getClaim, { claimId });
  expect(claim?.status).toBe("submitted");
  expect(claim?.submittedDate).toBeDefined();
});

test("should detect expiring policies", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupInsuranceFixture(t);

  const now = Date.now();
  await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-EXP",
    carrier: "Expiring Carrier",
    policyType: "blanket",
    coverageAmount: 100_000,
    effectiveDate: now - 300 * 24 * 60 * 60 * 1000,
    expirationDate: now + 10 * 24 * 60 * 60 * 1000,
  });

  const expiring = await authed.query(api.insurance.getExpiringPolicies, {
    organizationId,
    daysAhead: 30,
  });

  expect(expiring.length).toBeGreaterThan(0);
  expect(expiring[0]?.policyNumber).toBe("POL-EXP");
});

test("createAutoClaimForTransitDamage sums active coverages across collections", async () => {
  const t = createConvexTest();
  const { organizationId, userId, authed } = await setupInsuranceFixture(t);

  const [collectionIdA, collectionIdB] = await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    return await Promise.all([
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `INS-A-${suffix}`,
        title: "Insured Object A",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `INS-B-${suffix}`,
        title: "Insured Object B",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
    ]);
  });

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-TRANSIT",
    carrier: "Transit Carrier",
    policyType: "transit",
    coverageAmount: 500_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  await Promise.all([
    authed.mutation(api.insurance.addCoverage, {
      policyId,
      collectionId: collectionIdA,
      coveredValue: 1000,
    }),
    authed.mutation(api.insurance.addCoverage, {
      policyId,
      collectionId: collectionIdB,
      coveredValue: 2500,
    }),
  ]);

  const loanId = await t.run(async (ctx) => {
    return await ctx.db.insert("loans", {
      organizationId,
      loanNumber: `LOAN-${Math.random().toString(36).slice(2, 8)}`,
      type: "outgoing",
      lenderBorrowerName: "Borrowing Museum",
      startDate: now,
      status: "active",
    });
  });

  const claimId = await t.mutation(
    internal.insurance.createAutoClaimForTransitDamage,
    {
      organizationId,
      loanId,
      collectionIds: [collectionIdA, collectionIdB],
      incidentDescription: "Transit damage during loan return",
      actorUserId: userId,
    },
  );

  expect(claimId).not.toBeNull();

  const claim = await t.run(async (ctx) => {
    return await ctx.db.get(claimId!);
  });

  expect(claim?.claimedAmount).toBe(3500);
});

test("should identify uncovered objects", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, authed } =
    await setupInsuranceFixture(t);

  const uncovered = await authed.query(api.insurance.getUncoveredObjects, {
    organizationId,
    paginationOpts: { cursor: null, numItems: 25 },
  });

  expect(uncovered.page.some((obj) => obj._id === collectionId)).toBe(true);
});

test("should attribute auto-claim to actor user", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId, authed } =
    await setupInsuranceFixture(t);

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-AUTO",
    carrier: "Auto Claim Carrier",
    policyType: "transit",
    coverageAmount: 100_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  await authed.mutation(api.insurance.addCoverage, {
    policyId,
    collectionId,
    coveredValue: 15_000,
  });

  const loanId = await t.run(async (ctx) => {
    return await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-AUTO-001",
      type: "outgoing",
      status: "active",
      lenderBorrowerName: "Test Borrower",
      startDate: now,
      endDate: now + 30 * 24 * 60 * 60 * 1000,
    });
  });

  const claimId = await t.mutation(
    internal.insurance.createAutoClaimForTransitDamage,
    {
      organizationId,
      loanId,
      collectionIds: [collectionId],
      incidentDescription: "Scratch detected on return",
      actorUserId: userId,
    },
  );

  expect(claimId).not.toBeNull();

  const claim = await t.run(async (ctx) => {
    return await ctx.db.get(claimId!);
  });

  expect(claim?.createdBy).toBe(userId);
  expect(claim?.isAutoClaim).toBe(true);
  expect(claim?.autoClaimSource).toBe("loan_return_damage");
});

test("should reject auto-claim for non-member actor", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, authed } =
    await setupInsuranceFixture(t);

  const now = Date.now();
  const policyId = await authed.mutation(api.insurance.createPolicy, {
    organizationId,
    policyNumber: "POL-AUTO-REJECT",
    carrier: "Auto Claim Carrier",
    policyType: "transit",
    coverageAmount: 100_000,
    effectiveDate: now,
    expirationDate: now + 365 * 24 * 60 * 60 * 1000,
  });

  await authed.mutation(api.insurance.addCoverage, {
    policyId,
    collectionId,
    coveredValue: 15_000,
  });

  const loanId = await t.run(async (ctx) => {
    return await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-AUTO-002",
      type: "outgoing",
      status: "active",
      lenderBorrowerName: "Test Borrower",
      startDate: now,
      endDate: now + 30 * 24 * 60 * 60 * 1000,
    });
  });

  const outsiderUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: `outsider-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Outsider User",
    });
  });

  await expect(
    t.mutation(internal.insurance.createAutoClaimForTransitDamage, {
      organizationId,
      loanId,
      collectionIds: [collectionId],
      incidentDescription: "Scratch detected on return",
      actorUserId: outsiderUserId,
    }),
  ).rejects.toThrow("User is not a member of this organization");
});

const DAY = 24 * 60 * 60 * 1000;
const COVERAGE_NOW = Date.UTC(2026, 8, 17, 12);

test.each([
  { ageDays: 730, appraisalValid: true, warning: undefined },
  {
    ageDays: 731,
    appraisalValid: true,
    warning: "Appraisal is over 2 years old and should be updated soon",
  },
  {
    ageDays: 1095,
    appraisalValid: true,
    warning: "Appraisal is over 2 years old and should be updated soon",
  },
  {
    ageDays: 1096,
    appraisalValid: false,
    warning: "Appraisal is 3 years old and may be stale",
  },
])("checkAppraisalForCoverage treats $ageDays days as the literal cutoff", async ({
  ageDays,
  appraisalValid,
  warning,
}) => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.read"],
    { subscriptionTier: "pro", slugPrefix: "appraisal-age" },
  );
  const authed = authedForUser(t, userId);
  const collectionId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `INS-AGE-${ageDays}`,
      title: "Appraised Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: COVERAGE_NOW,
    });
    await ctx.db.insert("appraisals", {
      organizationId,
      collectionId: id,
      appraisalDate: COVERAGE_NOW - ageDays * DAY,
      appraiserName: "Appraiser",
      appraisalType: "insurance",
      value: 1000,
      currency: "EUR",
      createdBy: userId,
      createdAt: COVERAGE_NOW,
    });
    return id;
  });
  const coverage = await authed.query(api.insurance.checkAppraisalForCoverage, {
    collectionId,
    now: COVERAGE_NOW,
  });
  expect(coverage.appraisalAgeDays).toBe(ageDays);
  expect(coverage.appraisalValid).toBe(appraisalValid);
  expect(coverage.warning).toBe(warning);
});
