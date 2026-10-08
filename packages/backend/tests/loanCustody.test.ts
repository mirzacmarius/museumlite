import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
  custodyConflictOf,
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
      "locations.update",
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
  const { authed, loanId, locationId } = await setupLoanScenario(t, "outgoing");

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

  expect(
    await custodyConflictOf(authed.mutation(api.loans.returnLoan, { loanId })),
  ).toMatchObject({ code: "CONDITION_EVIDENCE_REQUIRED" });

  expect(
    await custodyConflictOf(
      authed.mutation(api.loans.returnLoan, {
        loanId,
        conditionIn: "Stable on return",
      }),
    ),
  ).toMatchObject({ code: "DESTINATION_REQUIRED" });

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
        conditionIn: "Stable on partial return",
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

test("cancel after dispatch is refused and leaves custody unchanged", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, locationId } = await setupLoanScenario(
    t,
    "outgoing",
  );

  await authed.mutation(api.loans.dispatch, { loanId });

  await expect(authed.mutation(api.loans.cancel, { loanId })).rejects.toThrow(
    /dispatched/i,
  );

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

  expect(result.loan?.status).toBe("dispatched");
  expect(result.item?.custodyStatus).toBe("dispatched");
  expect(result.collection?.status).toBe("loaned");
  expect(result.collection?.currentLocationId).toBeUndefined();
  expect(result.item?.dispatchOriginLocationId).toBe(locationId);
});

test("a cancelled loan does not keep a dispatched item in external custody", async () => {
  const t = createConvexTest();
  const {
    authed,
    collectionId,
    loanId,
    locationId,
    organizationId,
    returnLocationId,
    userId,
  } = await setupLoanScenario(t, "outgoing");

  await t.run(async (ctx) => {
    await ctx.db.patch(loanId, { status: "cancelled" });
    const item = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
    if (!item) throw new Error("missing loan item");
    await ctx.db.patch(item._id, {
      custodyStatus: "dispatched",
      dispatchOriginLocationId: locationId,
      dispatchedAt: Date.now(),
      dispatchedBy: userId,
    });
    await ctx.db.patch(collectionId, {
      status: "active",
      currentLocationId: undefined,
    });
  });

  await authed.mutation(api.locations.moveObject, {
    collectionId,
    toLocationId: returnLocationId,
    expectedFromLocationId: null,
    reason: "Recover object after cancelled loan",
  });

  const collection = await t.run(async (ctx) => ctx.db.get(collectionId));
  expect(collection?.currentLocationId).toBe(returnLocationId);
  expect(collection?.organizationId).toBe(organizationId);
});

test("a partially returned item is not still on loan", async () => {
  const t = createConvexTest();
  const {
    authed,
    collectionId,
    loanId,
    locationId,
    organizationId,
    returnLocationId,
    userId,
  } = await setupLoanScenario(t, "outgoing");

  const secondCollectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "LC-003",
      title: "Still out",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: locationId,
    });
  });
  await authed.mutation(api.loans.addItems, {
    loanId,
    collectionIds: [secondCollectionId],
  });
  await authed.mutation(api.loans.dispatch, { loanId });

  const firstItemId = await t.run(async (ctx) => {
    const item = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .first();
    if (!item) throw new Error("missing loan item");
    return item._id;
  });

  await authed.mutation(api.loans.returnLoan, {
    loanId,
    loanItemIds: [firstItemId],
    receipts: [
      {
        loanItemId: firstItemId,
        destinationLocationId: returnLocationId,
        conditionIn: "Stable on partial return",
      },
    ],
  });

  const galleryId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId,
      name: "Exhibition gallery",
      type: "gallery",
      sortOrder: 2,
      isActive: true,
    });
  });
  const exhibitionId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitions", {
      organizationId,
      title: "After partial return",
      startDate: Date.now(),
      isCurrent: false,
      status: "approved",
      locationId: galleryId,
      participationVersion: "members",
    });
  });
  const exhibitionObjectId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId,
      status: "pending",
      originalLocationId: returnLocationId,
      exhibitionLocationId: galleryId,
    });
  });

  const installationAssessmentId = await authed.mutation(
    api.conditionAssessments.create,
    {
      collectionId,
      assessedAt: Date.now(),
      condition: "Good",
      summary: "Post-return installation check",
      observations: [],
      photos: [],
    },
  );
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: installationAssessmentId,
  });
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: returnLocationId,
    installationConditionAssessmentId: installationAssessmentId,
  });

  const nextLoanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "LC-next",
    type: "outgoing",
    lenderBorrowerName: "Another museum",
    startDate: Date.now(),
  });
  await authed.mutation(api.loans.addItems, {
    loanId: nextLoanId,
    collectionIds: [collectionId],
  });

  const installed = await t.run(async (ctx) => ctx.db.get(exhibitionObjectId));
  expect(installed?.status).toBe("installed");

  const parent = await t.run(async (ctx) => ctx.db.get(loanId));
  expect(parent?.status).toBe("dispatched");
});

test("return without condition evidence is rejected", async () => {
  const t = createConvexTest();
  const { authed, loanId, returnLocationId } = await setupLoanScenario(
    t,
    "outgoing",
  );
  await authed.mutation(api.loans.dispatch, { loanId });
  const loanItemId = await t.run(async (ctx) => {
    const item = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
    if (!item) throw new Error("missing loan item");
    return item._id;
  });

  await expect(
    authed.mutation(api.loans.returnLoan, {
      loanId,
      receipts: [
        {
          loanItemId,
          destinationLocationId: returnLocationId,
        },
      ],
    }),
  ).rejects.toThrow(/condition/i);

  const item = await t.run(async (ctx) => ctx.db.get(loanItemId));
  expect(item?.custodyStatus).toBe("dispatched");
  expect(item?.conditionIn).toBeUndefined();
});

test("dispatch records loan_dispatch from the origin", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, locationId } = await setupLoanScenario(
    t,
    "outgoing",
  );

  await authed.mutation(api.loans.dispatch, { loanId });

  const history = await t.run(async (ctx) => {
    return await ctx.db
      .query("locationHistory")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
  });
  const departure = history.find((row) => row.movementKind === "loan_dispatch");
  expect(departure?.fromLocationId).toBe(locationId);
  expect(departure?.toLocationId).toBeUndefined();

  const collection = await t.run(async (ctx) => ctx.db.get(collectionId));
  expect(collection?.currentLocationId).toBeUndefined();
  expect(collection?.status).toBe("loaned");
});

test("outgoing return records loan_return", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, returnLocationId } =
    await setupLoanScenario(t, "outgoing");
  await authed.mutation(api.loans.dispatch, { loanId });
  const loanItemId = await t.run(async (ctx) => {
    const item = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
    if (!item) throw new Error("missing loan item");
    return item._id;
  });

  await authed.mutation(api.loans.returnLoan, {
    loanId,
    receipts: [
      {
        loanItemId,
        destinationLocationId: returnLocationId,
        conditionIn: "Stable on return",
      },
    ],
  });

  const arrival = await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("locationHistory")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    return rows.find((row) => row.movementKind === "loan_return");
  });
  expect(arrival?.toLocationId).toBe(returnLocationId);
});

test("incoming lender exit releases the location", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, locationId } = await setupLoanScenario(
    t,
    "incoming",
  );

  await t.run(async (ctx) => {
    await ctx.db.patch(locationId, { capacity: 1 });
  });

  await authed.mutation(api.loans.returnLoan, {
    loanId,
    conditionIn: "Returned to lender stable",
  });

  const result = await t.run(async (ctx) => {
    const [collection, exit, occupants, history] = await Promise.all([
      ctx.db.get(collectionId),
      ctx.db
        .query("loanCustodyExits")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .first(),
      ctx.db
        .query("collections")
        .withIndex("by_currentLocation", (q) =>
          q.eq("currentLocationId", locationId),
        )
        .collect(),
      ctx.db
        .query("locationHistory")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect(),
    ]);
    return { collection, exit, history, occupants };
  });

  expect(result.collection?.status).toBe("archived");
  expect(result.collection?.currentLocationId).toBeUndefined();
  expect(result.occupants).toHaveLength(0);
  expect(result.exit?.fromLocationId).toBe(locationId);
  const departure = result.history.find(
    (row) => row.movementKind === "loan_return",
  );
  expect(departure?.fromLocationId).toBe(locationId);
  expect(departure?.toLocationId).toBeUndefined();
});

test("incoming lender exit refuses an installed exhibition object", async () => {
  const t = createConvexTest();
  const { authed, collectionId, loanId, locationId, organizationId } =
    await setupLoanScenario(t, "incoming");

  const exhibitionId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitions", {
      organizationId,
      title: "Still installed",
      startDate: Date.now(),
      isCurrent: true,
      status: "active",
      participationVersion: "members",
    });
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId,
      status: "installed",
      originalLocationId: locationId,
    });
  });

  await expect(
    authed.mutation(api.loans.returnLoan, {
      loanId,
      conditionIn: "Trying to leave while installed",
    }),
  ).rejects.toThrow(/exhibition/i);

  const result = await t.run(async (ctx) => {
    const [collection, exits] = await Promise.all([
      ctx.db.get(collectionId),
      ctx.db
        .query("loanCustodyExits")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect(),
    ]);
    return { collection, exits };
  });
  expect(result.collection?.status).toBe("loaned");
  expect(result.collection?.currentLocationId).toBe(locationId);
  expect(result.exits).toHaveLength(0);
});
