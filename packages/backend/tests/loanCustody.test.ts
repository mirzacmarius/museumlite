import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setupLoanScenario(
  t: ReturnType<typeof createConvexTest>,
  type: "outgoing" | "incoming",
) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [
      "loans.create",
      "loans.read",
      "loans.approve",
      "loans.update",
      "collections.accept_condition",
      "collections.update",
    ],
    {
      organizationName: "Loan Custody Museum",
      slugPrefix: "loan-custody",
      subscriptionTier: "pro",
      permissionCategoryFallback: "loans",
    },
  );

  const locationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId,
      name: "Storage A",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
  });

  const returnLocationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId,
      name: "Gallery B",
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
  });

  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "LC-001",
      title: "Custody test object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: locationId,
    });
  });

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: `LC-${type}`,
    type,
    lenderBorrowerName: "Partner Museum",
    startDate: Date.now(),
    collectionIds: [collectionId],
  });
  await authed.mutation(api.loans.approve, { loanId });

  return {
    authed,
    collectionId,
    loanId,
    locationId,
    returnLocationId,
    userId,
    organizationId,
  };
}

test("dispatch retains origin location on loan item", async () => {
  const t = createConvexTest();
  const { authed, loanId, locationId } = await setupLoanScenario(
    t,
    "outgoing",
  );

  await authed.mutation(api.loans.dispatch, { loanId });

  const item = await t.run(async (ctx) => {
    return await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
  });

  expect(item?.custodyStatus).toBe("dispatched");
  expect(item?.dispatchOriginLocationId).toBe(locationId);
  expect(item?.dispatchOriginUnknown).toBe(false);
});

test("outgoing return requires destination and restores location", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, returnLocationId } =
    await setupLoanScenario(t, "outgoing");

  await t.run(async (ctx) => {
    await ctx.db.patch(collectionId, { currentLocationId: undefined });
  });

  await authed.mutation(api.loans.dispatch, { loanId });

  await expect(
    authed.mutation(api.loans.returnLoan, { loanId }),
  ).rejects.toThrow("Return destination is required");

  await authed.mutation(api.loans.returnLoan, {
    loanId,
    receipts: [
      {
        loanItemId: (await t.run(async (ctx) => {
          const row = await ctx.db
            .query("loanItems")
            .withIndex("by_loan", (q) => q.eq("loanId", loanId))
            .first();
          return row!._id;
        })) as Id<"loanItems">,
        destinationLocationId: returnLocationId,
        conditionIn: "Stable on return",
      },
    ],
  });

  const result = await t.run(async (ctx) => {
    const [loan, collection, item] = await Promise.all([
      ctx.db.get(loanId),
      ctx.db.get(collectionId),
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .first(),
    ]);
    return { collection, item, loan };
  });

  expect(result.loan?.status).toBe("returned");
  expect(result.item?.custodyStatus).toBe("returned");
  expect(result.item?.returnDestinationLocationId).toBe(returnLocationId);
  expect(result.collection?.status).toBe("active");
  expect(result.collection?.currentLocationId).toBe(returnLocationId);
});

test("partial return keeps loan dispatched with outstanding items", async () => {
  const t = createConvexTest();
  const { authed, loanId, organizationId, userId, returnLocationId } =
    await setupLoanScenario(t, "outgoing");

  const secondCollectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "LC-002",
      title: "Second object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  await authed.mutation(api.loans.addItems, {
    loanId,
    collectionIds: [secondCollectionId],
  });

  await authed.mutation(api.loans.dispatch, { loanId });

  const firstItemId = await t.run(async (ctx) => {
    const items = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect();
    return items[0]!._id;
  });

  await authed.mutation(api.loans.returnLoan, {
    loanId,
    loanItemIds: [firstItemId],
    receipts: [
      {
        loanItemId: firstItemId,
        destinationLocationId: returnLocationId,
      },
    ],
  });

  const loan = await t.run(async (ctx) => ctx.db.get(loanId));
  expect(loan?.status).toBe("dispatched");
});

test("incoming return records lender exit without synthetic deaccession", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId } = await setupLoanScenario(
    t,
    "incoming",
  );

  await authed.mutation(api.loans.dispatch, { loanId });
  await authed.mutation(api.loans.returnLoan, {
    loanId,
    conditionIn: "Returned to lender stable",
  });

  const result = await t.run(async (ctx) => {
    const [collection, deaccessions, exit] = await Promise.all([
      ctx.db.get(collectionId),
      ctx.db
        .query("deaccessions")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect(),
      ctx.db
        .query("loanCustodyExits")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .first(),
    ]);
    return { collection, deaccessions, exit };
  });

  expect(result.exit?.exitType).toBe("return_to_lender");
  expect(result.deaccessions).toHaveLength(0);
  expect(result.collection?.status).toBe("archived");
});
