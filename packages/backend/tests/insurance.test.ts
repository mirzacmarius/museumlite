import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
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
