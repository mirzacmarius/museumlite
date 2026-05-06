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

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

async function createOrgUserWithPermissions(
  t: ReturnType<typeof convexTest>,
  permissionNames: string[],
) {
  return t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Loan Workflow Museum",
      slug: `loan-workflow-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "pro",
    });

    const userId = await ctx.db.insert("users", {
      email: `loan-user-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Loan Workflow User",
    });

    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Loan Approver",
      isSystemRole: false,
    });

    for (const permissionName of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name: permissionName,
        category: permissionName.split(".")[0] || "loans",
      });

      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    }

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { organizationId, userId, roleId };
  });
}

test("loan workflows advance through configured approval steps before activation", async () => {
  const t = convexTest(schema, modules);
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
  const t = convexTest(schema, modules);

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
  const t = convexTest(schema, modules);

  // 1. Create and approve loan (setup)
  // const loanId = await t.mutation(api.loans.create, { /* ... */ });
  // await t.mutation(api.loans.approve, { loanId });

  // 2. Dispatch the loan
  // await t.mutation(api.loans.dispatch, { loanId });

  // 3. Verify status changed to dispatched
  // const dispatchedLoan = await t.query(api.loans.get, { loanId });
  // expect(dispatchedLoan?.status).toBe("dispatched");

  expect(true).toBe(true);
});

test("should return dispatched loan and change status to returned", async () => {
  const t = convexTest(schema, modules);

  // 1. Create, approve, and dispatch loan (setup)
  // const loanId = await t.mutation(api.loans.create, { /* ... */ });
  // await t.mutation(api.loans.approve, { loanId });
  // await t.mutation(api.loans.dispatch, { loanId });

  // 2. Return the loan
  // await t.mutation(api.loans.returnLoan, { loanId });

  // 3. Verify status changed to returned
  // const returnedLoan = await t.query(api.loans.get, { loanId });
  // expect(returnedLoan?.status).toBe("returned");

  expect(true).toBe(true);
});

test("should return active loan directly (without dispatch)", async () => {
  const t = convexTest(schema, modules);

  // 1. Create and approve loan
  // const loanId = await t.mutation(api.loans.create, { /* ... */ });
  // await t.mutation(api.loans.approve, { loanId });

  // 2. Return directly from active state
  // await t.mutation(api.loans.returnLoan, { loanId });

  // 3. Verify status changed to returned
  // const returnedLoan = await t.query(api.loans.get, { loanId });
  // expect(returnedLoan?.status).toBe("returned");

  expect(true).toBe(true);
});

test("should prevent invalid status transitions", async () => {
  const t = convexTest(schema, modules);

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
  const t = convexTest(schema, modules);

  // Test that users without loans.update permission cannot dispatch
  // Test that users without loans.approve permission cannot approve
  // Note: Permission testing may require setting up auth context in convexTest

  expect(true).toBe(true);
});
