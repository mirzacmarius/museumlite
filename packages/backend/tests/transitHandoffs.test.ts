import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const transitHandoffPermissions = [
  "loans.create",
  "loans.read",
  "loans.update",
  "loans.approve",
  "collections.update",
  "collections.accept_condition",
] as const;

async function setupReturnTransitFixture(
  t: ReturnType<typeof createConvexTest>,
) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [...transitHandoffPermissions],
    {
      subscriptionTier: "pro",
      slugPrefix: "transit-handoff",
    },
  );

  const { storageId, galleryId, collectionId } = await t.run(async (ctx) => {
    const storageId = await ctx.db.insert("locations", {
      organizationId,
      name: "Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const galleryId = await ctx.db.insert("locations", {
      organizationId,
      name: "Gallery",
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "TRH-001",
      title: "Return transit object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: storageId,
    });
    return { storageId, galleryId, collectionId };
  });

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "LOAN-TRH-1",
    type: "outgoing",
    lenderBorrowerName: "Partner",
    startDate: Date.now(),
    collectionIds: [collectionId],
  });
  await authed.mutation(api.loans.approve, { loanId });
  await authed.mutation(api.loans.dispatch, { loanId });

  const transitRecordId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "return",
    originName: "Partner",
    destinationName: "Museum",
    destinationLocationId: galleryId,
    carrier: "Art Handler",
    loanId,
    collectionIds: [collectionId],
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId,
    status: "in_transit",
    description: "En route",
  });

  return {
    authed,
    organizationId,
    userId,
    loanId,
    collectionId,
    storageId,
    galleryId,
    transitRecordId,
  };
}

test("carrier delivered status does not return loan items", async () => {
  const t = createConvexTest();
  const { authed, transitRecordId, loanId } =
    await setupReturnTransitFixture(t);

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId,
    status: "delivered",
    description: "Carrier delivered",
  });

  const loanItem = await t.run(async (ctx) => {
    return await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
  });

  expect(loanItem?.custodyStatus).toBe("dispatched");

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  expect(transit?.items[0]?.status).toBe("in_transit");
});

test("recordTransitItemReceipt returns linked loan item with movement evidence", async () => {
  const t = createConvexTest();
  const { authed, transitRecordId, loanId, galleryId, storageId } =
    await setupReturnTransitFixture(t);

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId,
    status: "delivered",
    description: "Carrier delivered",
  });

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const transitItemId = transit!.items[0]!._id;

  await authed.mutation(api.transit.markTransitItemCarrierArrived, {
    transitItemId,
  });

  await authed.mutation(api.transit.recordTransitItemReceipt, {
    transitItemId,
    observedFromLocationId: null,
    destinationLocationId: galleryId,
    conditionIn: "Good",
  });

  const loanItem = await t.run(async (ctx) => {
    return await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
  });
  expect(loanItem?.custodyStatus).toBe("returned");
  expect(loanItem?.returnDestinationLocationId).toBe(galleryId);

  const updatedTransit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const item = updatedTransit!.items[0]!;
  expect(item.status).toBe("received");
  expect(item.receiptMovementId).toBeDefined();
  expect(item.receivedAt).toBeDefined();

  const collection = await t.run(async (ctx) => {
    return await ctx.db.get(updatedTransit!.items[0]!.collectionId);
  });
  expect(collection?.currentLocationId).toBe(galleryId);
  expect(collection?.currentLocationId).not.toBe(storageId);
});

test("partial arrival leaves sibling items in transit", async () => {
  const t = createConvexTest();
  const { authed, organizationId, userId, loanId, galleryId, transitRecordId } =
    await setupReturnTransitFixture(t);

  const secondCollectionId = await t.run(async (ctx) => {
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "TRH-002",
      title: "Second object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("transitItems", {
      transitRecordId,
      collectionId,
      status: "in_transit",
      createdAt: Date.now(),
    });
    return collectionId;
  });

  await t.run(async (ctx) => {
    const loanItem = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .filter((q) => q.eq(q.field("collectionId"), secondCollectionId))
      .first();
    if (loanItem) {
      await ctx.db.patch(loanItem._id, {
        custodyStatus: "dispatched",
        dispatchedAt: Date.now(),
        dispatchedBy: userId,
      });
    }
  });

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const firstItemId = transit!.items.find(
    (item) => item.collectionId !== secondCollectionId,
  )!._id;

  await authed.mutation(api.transit.markTransitItemCarrierArrived, {
    transitItemId: firstItemId,
  });
  await authed.mutation(api.transit.recordTransitItemReceipt, {
    transitItemId: firstItemId,
    observedFromLocationId: null,
    destinationLocationId: galleryId,
    conditionIn: "Good",
  });

  const after = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const second = after!.items.find(
    (item) => item.collectionId === secondCollectionId,
  );
  expect(second?.status).toBe("in_transit");
});

test("recordTransitItemReceipt rejects duplicate receipt", async () => {
  const t = createConvexTest();
  const { authed, transitRecordId, galleryId } =
    await setupReturnTransitFixture(t);

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const transitItemId = transit!.items[0]!._id;

  await authed.mutation(api.transit.markTransitItemCarrierArrived, {
    transitItemId,
  });
  await authed.mutation(api.transit.recordTransitItemReceipt, {
    transitItemId,
    observedFromLocationId: null,
    destinationLocationId: galleryId,
    conditionIn: "Good",
  });

  await expect(
    authed.mutation(api.transit.recordTransitItemReceipt, {
      transitItemId,
      observedFromLocationId: null,
      destinationLocationId: galleryId,
      conditionIn: "Still good",
    }),
  ).rejects.toThrow(/already received/i);
});

test("recordTransitItemReceipt requires loans.update permission", async () => {
  const t = createConvexTest();
  const { organizationId, transitRecordId, galleryId } =
    await setupReturnTransitFixture(t);

  const readerId = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Transit reader",
      isSystemRole: false,
    });
    const permissionId = await ctx.db.insert("permissions", {
      name: "loans.read",
      category: "loans",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
    const userId = await ctx.db.insert("users", {
      email: `reader-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Reader",
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
  const reader = authedForUser(t, readerId);

  const transit = await reader.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const transitItemId = transit!.items[0]!._id;

  await expect(
    reader.mutation(api.transit.recordTransitItemReceipt, {
      transitItemId,
      observedFromLocationId: null,
      destinationLocationId: galleryId,
      conditionIn: "Good",
    }),
  ).rejects.toThrow();
});

test("return shipment receipt requires condition evidence", async () => {
  const t = createConvexTest();
  const { authed, transitRecordId, galleryId, loanId } =
    await setupReturnTransitFixture(t);
  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const transitItemId = transit!.items[0]!._id;
  await authed.mutation(api.transit.markTransitItemCarrierArrived, {
    transitItemId,
  });

  await expect(
    authed.mutation(api.transit.recordTransitItemReceipt, {
      transitItemId,
      observedFromLocationId: null,
      destinationLocationId: galleryId,
    }),
  ).rejects.toThrow(/condition/i);

  const loanItem = await t.run(async (ctx) => {
    return await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
  });
  expect(loanItem?.custodyStatus).toBe("dispatched");
  expect(loanItem?.conditionIn).not.toBe("Returned");
});

test("loan return receipt rejects an observed source that is not current", async () => {
  const t = createConvexTest();
  const { authed, transitRecordId, galleryId, storageId, loanId } =
    await setupReturnTransitFixture(t);
  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const transitItemId = transit!.items[0]!._id;
  await authed.mutation(api.transit.markTransitItemCarrierArrived, {
    transitItemId,
  });

  await expect(
    authed.mutation(api.transit.recordTransitItemReceipt, {
      transitItemId,
      observedFromLocationId: storageId,
      destinationLocationId: galleryId,
      conditionIn: "Good",
    }),
  ).rejects.toThrow(/source/i);

  const loanItem = await t.run(async (ctx) => {
    return await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .first();
  });
  expect(loanItem?.custodyStatus).toBe("dispatched");
});

test("outgoing return receipt does not cite a movement when the destination is unchanged", async () => {
  const t = createConvexTest();
  const { authed, organizationId, userId, storageId, collectionId } =
    await setupReturnTransitFixture(t);

  const { transitItemId, decoyMovementId } = await t.run(async (ctx) => {
    const loanId = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();
    if (!loanId) throw new Error("missing loan");
    await ctx.db.patch(loanId._id, { status: "active" });
    const item = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId._id))
      .first();
    if (!item) throw new Error("missing loan item");
    await ctx.db.patch(item._id, {
      custodyStatus: "pending",
      dispatchedAt: undefined,
      dispatchedBy: undefined,
      dispatchOriginLocationId: undefined,
    });
    await ctx.db.patch(collectionId, {
      status: "active",
      currentLocationId: storageId,
    });
    const decoyMovementId = await ctx.db.insert("locationHistory", {
      collectionId,
      fromLocationId: undefined,
      toLocationId: storageId,
      movedBy: userId,
      movedAt: Date.now() - 60_000,
      reason: "Earlier gallery placement",
    });
    const transitItem = await ctx.db
      .query("transitItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .first();
    if (!transitItem) throw new Error("missing transit item");
    await ctx.db.patch(transitItem._id, { status: "arrived" });
    return { decoyMovementId, transitItemId: transitItem._id };
  });

  await expect(
    authed.mutation(api.transit.recordTransitItemReceipt, {
      transitItemId,
      observedFromLocationId: storageId,
      destinationLocationId: storageId,
      conditionIn: "Unchanged place",
    }),
  ).rejects.toThrow(/already at|location change|movement/i);

  const stored = await t.run(async (ctx) => ctx.db.get(transitItemId));
  expect(stored?.status).not.toBe("received");
  expect(stored?.receiptMovementId).toBeUndefined();
  expect(stored?.receiptMovementId).not.toBe(decoyMovementId);
});

test("incoming return receipt stores the departure it wrote", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [...transitHandoffPermissions],
    {
      subscriptionTier: "pro",
      slugPrefix: "transit-incoming",
    },
  );
  const { storageId, galleryId, collectionId } = await t.run(async (ctx) => {
    const storageId = await ctx.db.insert("locations", {
      organizationId,
      name: "Incoming storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const galleryId = await ctx.db.insert("locations", {
      organizationId,
      name: "Incoming gallery",
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "TRH-IN-1",
      title: "Incoming return object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: storageId,
    });
    return { storageId, galleryId, collectionId };
  });
  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: "LOAN-TRH-IN",
    type: "incoming",
    lenderBorrowerName: "Lender",
    startDate: Date.now(),
    collectionIds: [collectionId],
  });
  await authed.mutation(api.loans.approve, { loanId });
  await authed.mutation(api.loans.dispatch, { loanId });

  const transitRecordId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "return",
    originName: "Museum",
    destinationName: "Lender",
    destinationLocationId: galleryId,
    carrier: "Art Handler",
    loanId,
    collectionIds: [collectionId],
  });
  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId,
    status: "in_transit",
    description: "En route back to lender",
  });
  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId,
  });
  const transitItemId = transit!.items[0]!._id;
  await authed.mutation(api.transit.markTransitItemCarrierArrived, {
    transitItemId,
  });

  const movementId = await authed.mutation(api.transit.recordTransitItemReceipt, {
    transitItemId,
    observedFromLocationId: null,
    destinationLocationId: galleryId,
    conditionIn: "Left in lender crate",
  });

  const result = await t.run(async (ctx) => {
    const [movement, collection, item, transitItem] = await Promise.all([
      ctx.db.get(movementId),
      ctx.db.get(collectionId),
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .first(),
      ctx.db.get(transitItemId),
    ]);
    return { collection, item, movement, transitItem };
  });

  expect(result.transitItem?.receiptMovementId).toBe(movementId);
  expect(result.movement?.movementKind).toBe("transit_receipt");
  expect(result.movement?.transitItemId).toBe(transitItemId);
  expect(result.movement?.fromLocationId).toBe(storageId);
  expect(result.movement?._id).toBe(movementId);
  expect(result.collection?.status).toBe("archived");
  expect(result.collection?.currentLocationId).toBeUndefined();
  expect(result.item?.custodyStatus).toBe("returned");
  expect(result.item?.conditionIn).toBe("Left in lender crate");
});
