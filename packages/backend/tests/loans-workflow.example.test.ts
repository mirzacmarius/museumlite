/**
 * Example test file for Loans Workflow
 *
 * This demonstrates how to test Convex mutations using the official convex-test library.
 *
 * Setup:
 * 1. Install: `bun add -d convex-test vitest @edge-runtime/vm`
 * 2. Create vitest.config.ts (see testing-strategy-proposal.md)
 * 3. Move this file to: packages/backend/convex/loans.test.ts
 * 4. Uncomment and adapt these tests
 *
 * Run with: `bun test` (from packages/backend)
 *
 * Reference: https://docs.convex.dev/testing/convex-test
 */

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

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
