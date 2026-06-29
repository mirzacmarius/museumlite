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
  authedForUser,
  type ConvexTest,
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
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "loans.create",
    "loans.read",
    "loans.approve",
  ]);

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "LOAN-APPROVE-001",
    type: "outgoing",
    lenderBorrowerName: "Partner Museum",
    startDate: Date.now(),
    endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  const initialLoan = await authed.query(api.loans.get, { loanId });
  expect(initialLoan?.status).toBe("pending");

  await authed.mutation(api.loans.approve, { loanId });

  const approvedLoan = await authed.query(api.loans.get, { loanId });
  expect(approvedLoan?.status).toBe("active");
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
  const { authed, loanId } = await createActiveLoanWithCollection(t, {
    loanNumber: "LOAN-INVALID-001",
  });

  await authed.mutation(api.loans.dispatch, { loanId });

  await expect(authed.mutation(api.loans.dispatch, { loanId })).rejects.toThrow(
    "Loan must be active to dispatch",
  );
});

test("should enforce permissions", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "loans.create",
    "loans.read",
  ]);

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "LOAN-PERM-001",
    type: "outgoing",
    lenderBorrowerName: "Partner Museum",
    startDate: Date.now(),
    endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  await expect(authed.mutation(api.loans.approve, { loanId })).rejects.toThrow();
});

// ---------------------------------------------------------------------------
// Data-integrity tests (Plan 004)
// ---------------------------------------------------------------------------

async function setupOrgWithLoanPermissions(t: ConvexTest) {
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "loans.create",
    "loans.read",
    "loans.approve",
    "loans.update",
  ]);

  const locationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId,
      name: "Main Gallery",
      type: "gallery",
      sortOrder: 0,
      isActive: true,
    });
  });

  async function makeCollection(suffix: string) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `INT-${suffix}`,
        title: `Integrity Test Object ${suffix}`,
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
        currentLocationId: locationId,
      });
    });
  }

  return { organizationId, userId, authed: authedForUser(t, userId), makeCollection };
}

test("(integrity) duplicate collectionId in create → throws, not two loanItems rows", async () => {
  const t = createConvexTest();
  const { organizationId, authed, makeCollection } = await setupOrgWithLoanPermissions(t);
  const collectionId = await makeCollection("dup-create");

  await expect(
    authed.mutation(api.loans.create, {
      organizationId,
      loanNumber: "INT-DUP-001",
      type: "outgoing",
      lenderBorrowerName: "Dedup Test Borrower",
      startDate: Date.now(),
      collectionIds: [collectionId, collectionId],
    }),
  ).rejects.toThrow("Duplicate collection in loan items");

  // Confirm no loanItems row was inserted
  const count = await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    return rows.length;
  });
  expect(count).toBe(0);
});

test("(integrity) duplicate collectionId in addItems → throws", async () => {
  const t = createConvexTest();
  const { organizationId, authed, makeCollection } = await setupOrgWithLoanPermissions(t);
  const collectionA = await makeCollection("dup-addItems-A");
  const collectionB = await makeCollection("dup-addItems-B");

  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "INT-DUP-ADD-001",
    type: "outgoing",
    lenderBorrowerName: "AddItems Dedup Borrower",
    startDate: Date.now(),
  });

  // Approve to get to active status (addItems requires pending or active)
  await authed.mutation(api.loans.approve, { loanId });

  await expect(
    authed.mutation(api.loans.addItems, {
      loanId,
      collectionIds: [collectionA, collectionB, collectionA],
    }),
  ).rejects.toThrow("Duplicate collection in loan items");
});

test("(integrity) adding collection already on dispatched loan → throws (dispatched blocks)", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, organizationId } =
    await createActiveLoanWithCollection(t, { loanNumber: "INT-DISPATCH-001" });

  // Dispatch the first loan → collection status becomes "loaned"
  await authed.mutation(api.loans.dispatch, { loanId });

  // Simulate a data inconsistency by manually resetting the collection back to
  // "active" — this is exactly the race condition the dispatched-status check
  // guards against (old code would miss it; new code must catch it).
  await t.run(async (ctx) => {
    await ctx.db.patch(collectionId, { status: "active" });
  });

  // Now the new helper must block the create because the loan is dispatched
  await expect(
    authed.mutation(api.loans.create, {
      organizationId,
      loanNumber: "INT-DISPATCH-002",
      type: "outgoing",
      lenderBorrowerName: "Second Borrower",
      startDate: Date.now(),
      collectionIds: [collectionId],
    }),
  ).rejects.toThrow("already in an active loan");
});

test("(integrity) create with endDate < startDate → throws", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupOrgWithLoanPermissions(t);
  const now = Date.now();

  await expect(
    authed.mutation(api.loans.create, {
      organizationId,
      loanNumber: "INT-DATE-001",
      type: "outgoing",
      lenderBorrowerName: "Date Test Borrower",
      startDate: now,
      endDate: now - 1000, // 1 second before start
    }),
  ).rejects.toThrow("Loan end date cannot be before start date");
});

test("(integrity) update with endDate < startDate → throws", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupOrgWithLoanPermissions(t);
  const now = Date.now();

  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "INT-DATE-UPDATE-001",
    type: "outgoing",
    lenderBorrowerName: "Date Update Test",
    startDate: now,
    endDate: now + 10_000,
  });

  await expect(
    authed.mutation(api.loans.update, {
      loanId,
      endDate: now - 1000, // before existing startDate
    }),
  ).rejects.toThrow("Loan end date cannot be before start date");
});

test("(integrity) duplicate manual loanNumber within org → throws", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupOrgWithLoanPermissions(t);
  const now = Date.now();

  await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "UNIQUE-001",
    type: "outgoing",
    lenderBorrowerName: "First Borrower",
    startDate: now,
  });

  await expect(
    authed.mutation(api.loans.create, {
      organizationId,
      loanNumber: "UNIQUE-001",
      type: "outgoing",
      lenderBorrowerName: "Second Borrower",
      startDate: now,
    }),
  ).rejects.toThrow("Loan number already in use");
});

test("(integrity) happy path: distinct collections, valid dates, unique number → correct item count", async () => {
  const t = createConvexTest();
  const { organizationId, authed, makeCollection } = await setupOrgWithLoanPermissions(t);
  const now = Date.now();
  const [colA, colB, colC] = await Promise.all([
    makeCollection("happy-A"),
    makeCollection("happy-B"),
    makeCollection("happy-C"),
  ]);

  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "HAPPY-001",
    type: "outgoing",
    lenderBorrowerName: "Happy Path Borrower",
    startDate: now,
    endDate: now + 30 * 24 * 60 * 60 * 1000,
    collectionIds: [colA, colB, colC],
  });

  const itemCount = await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect();
    return rows.length;
  });
  expect(itemCount).toBe(3);
});

test("paginates loans with cursor and status filter", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "loans.create",
    "loans.read",
  ]);
  const authed = authedForUser(t, userId);

  await t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        ctx.db.insert("loans", {
          organizationId,
          loanNumber: `LOAN-PAGE-${index + 1}`,
          type: "outgoing",
          lenderBorrowerName: `Borrower ${index + 1}`,
          startDate: Date.now() - index * 86_400_000,
          status: index % 2 === 0 ? "active" : "pending",
        }),
      ),
    );
  });

  const page1 = await authed.query(api.loans.list, {
    organizationId,
    paginationOpts: { numItems: 3, cursor: null },
    status: "active",
  });

  expect(page1.page).toHaveLength(3);
  expect(page1.isDone).toBe(false);
  expect(page1.page.every((loan) => loan.status === "active")).toBe(true);

  const page2 = await authed.query(api.loans.list, {
    organizationId,
    paginationOpts: { numItems: 3, cursor: page1.continueCursor },
    status: "active",
  });

  expect(page2.page.length).toBeGreaterThan(0);
  expect(page2.page.every((loan) => loan.status === "active")).toBe(true);
});
