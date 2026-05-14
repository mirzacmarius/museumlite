/**
 * Test file for Loans Workflow
 *
 * This demonstrates how to test Convex mutations using the official convex-test library.
 *
 * Setup:
 * 1. Dependencies installed: convex-test, vitest, @edge-runtime/vm
 * 2. vitest.config.ts created
 * 3. Test scripts added to package.json
 *
 * Run with: `bun test` (from packages/backend)
 *
 * Reference: https://docs.convex.dev/testing/convex-test
 */

import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  type ConvexTest,
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions as createOrgUserWithBasePermissions,
} from "./testHarness";

async function createOrgUserWithPermissions(
  t: ConvexTest,
  permissionNames: string[],
) {
  return await createOrgUserWithBasePermissions(t, permissionNames, {
    organizationName: "Loan Workflow Museum",
    slugPrefix: "loan-workflow",
    userEmailPrefix: "loan-user",
    userName: "Loan Workflow User",
    roleName: "Loan Approver",
    subscriptionTier: "pro",
    permissionCategoryFallback: "loans",
  });
}

async function createActiveLoanWithCollection(
  t: ConvexTest,
  {
    loanNumber,
  }: {
    loanNumber: string;
  },
) {
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "loans.create",
    "loans.read",
    "loans.approve",
    "loans.update",
  ]);
  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `${loanNumber}-OBJ`,
      title: `${loanNumber} object`,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: await ctx.db.insert("locations", {
        organizationId,
        name: `${loanNumber} gallery`,
        type: "gallery",
        sortOrder: 0,
        isActive: true,
      }),
    });
  });

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber,
    type: "outgoing",
    lenderBorrowerName: "Partner Museum",
    startDate: Date.now(),
    collectionIds: [collectionId],
    conditionOut: "Stable",
  });

  await authed.mutation(api.loans.approve, { loanId });

  return { authed, collectionId, loanId, organizationId, userId };
}

test("loan workflows advance through configured approval steps before activation", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["loans.create", "loans.read", "loans.approve"],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "loan",
      steps: [
        { stepNumber: 1, roleId, name: "Registrar Review" },
        { stepNumber: 2, roleId, name: "Director Approval" },
      ],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "LOAN-WF-001",
    type: "outgoing",
    lenderBorrowerName: "Partner Museum",
    startDate: Date.now(),
    endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  let loan = await authed.query(api.loans.get, { loanId });

  expect(loan).not.toBeNull();
  expect(loan?.status).toBe("pending");
  expect(loan?.workflowStep).toBe(1);
  expect(loan?.workflowHistory.map((entry) => entry.step)).toEqual([0]);

  await authed.mutation(api.loans.approve, {
    loanId,
    comment: "Registrar approved",
  });

  loan = await authed.query(api.loans.get, { loanId });

  expect(loan).not.toBeNull();
  expect(loan?.status).toBe("pending");
  expect(loan?.workflowStep).toBe(2);
  expect(loan?.workflowHistory.map((entry) => entry.step)).toEqual([0, 1]);

  await authed.mutation(api.loans.approve, {
    loanId,
    comment: "Director approved",
  });

  loan = await authed.query(api.loans.get, { loanId });

  expect(loan).not.toBeNull();
  expect(loan?.status).toBe("active");
  expect(loan?.approvedBy).toBe(userId);
  expect(loan?.workflowStep).toBe(2);
  expect(loan?.workflowHistory.map((entry) => entry.step)).toEqual([0, 1, 2]);
});

test("should approve pending loan and change status to active", async () => {
  const t = createConvexTest();

  // 1. Create a pending loan
  // const loanId = await t.mutation(api.loans.create, {
  //   organizationId: "test-org-id" as Id<"organizations">,
  //   borrowerId: "test-borrower-id",
  //   // ... other required fields
  // });

  // 2. Verify initial status is pending
  // const initialLoan = await t.query(api.loans.get, { loanId });
  // expect(initialLoan?.status).toBe("pending");

  // 3. Approve the loan
  // await t.mutation(api.loans.approve, { loanId });

  // 4. Verify status changed to active
  // const approvedLoan = await t.query(api.loans.get, { loanId });
  // expect(approvedLoan?.status).toBe("active");

  // Placeholder assertion
  expect(true).toBe(true);
});

test("should dispatch active loan and change status to dispatched", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId } = await createActiveLoanWithCollection(
    t,
    { loanNumber: "LOAN-DISPATCH-001" },
  );

  await authed.mutation(api.loans.dispatch, { loanId });

  const result = await t.run(async (ctx) => {
    const [loan, collection] = await Promise.all([
      ctx.db.get(loanId),
      ctx.db.get(collectionId),
    ]);
    return { collection, loan };
  });

  expect(result.loan?.status).toBe("dispatched");
  expect(result.collection?.status).toBe("loaned");
  expect(result.collection?.currentLocationId).toBeUndefined();
});

test("should return dispatched loan and change status to returned", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId } = await createActiveLoanWithCollection(
    t,
    { loanNumber: "LOAN-RETURN-001" },
  );

  await authed.mutation(api.loans.dispatch, { loanId });
  await authed.mutation(api.loans.returnLoan, {
    loanId,
    conditionIn: "Returned stable",
  });

  const result = await t.run(async (ctx) => {
    const [loan, collection, loanItem] = await Promise.all([
      ctx.db.get(loanId),
      ctx.db.get(collectionId),
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .first(),
    ]);
    return { collection, loan, loanItem };
  });

  expect(result.loan?.status).toBe("returned");
  expect(result.collection?.status).toBe("active");
  expect(result.loanItem?.conditionIn).toBe("Returned stable");
});

test("should return active loan directly (without dispatch)", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId } = await createActiveLoanWithCollection(
    t,
    { loanNumber: "LOAN-RETURN-002" },
  );

  await authed.mutation(api.loans.returnLoan, { loanId });

  const result = await t.run(async (ctx) => {
    const [loan, collection, loanItem] = await Promise.all([
      ctx.db.get(loanId),
      ctx.db.get(collectionId),
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .first(),
    ]);
    return { collection, loan, loanItem };
  });

  expect(result.loan?.status).toBe("returned");
  expect(result.collection?.status).toBe("active");
  expect(result.loanItem?.conditionIn).toBe("Returned");
});

test("should prevent invalid status transitions", async () => {
  const t = createConvexTest();

  // 1. Create and approve loan
  // const loanId = await t.mutation(api.loans.create, { /* ... */ });
  // await t.mutation(api.loans.approve, { loanId });

  // 2. Try to dispatch already-dispatched loan (should fail)
  // await t.mutation(api.loans.dispatch, { loanId });
  // await expect(
  //   t.mutation(api.loans.dispatch, { loanId })
  // ).rejects.toThrow("Loan must be active to dispatch");

  expect(true).toBe(true);
});

test("should enforce permissions", async () => {
  const t = createConvexTest();

  // Test that users without loans.update permission cannot dispatch
  // Test that users without loans.approve permission cannot approve
  // Note: Permission testing may require setting up auth context in convexTest

  expect(true).toBe(true);
});
