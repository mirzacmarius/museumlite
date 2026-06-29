import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const transitPermissions = [
  "loans.create",
  "loans.read",
  "loans.update",
  "organization.manage_settings",
] as const;

interface TransitFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  collectionId: Id<"collections">;
  loanId: Id<"loans">;
  authed: ReturnType<typeof authedForUser>;
}

async function setupTransitFixture(t: ConvexTest): Promise<TransitFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [...transitPermissions],
    {
      subscriptionTier: "pro",
      slugPrefix: "transit-test",
    },
  );

  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `TRN-${Math.random().toString(36).slice(2, 8)}`,
      title: "Transit Test Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    loanNumber: `LOAN-TRN-${Math.random().toString(36).slice(2, 6)}`,
    type: "outgoing",
    lenderBorrowerName: "Partner Gallery",
    startDate: Date.now(),
    endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    collectionIds: [collectionId],
  });

  return { organizationId, userId, collectionId, loanId, authed };
}

test("paginates transit records for an organization", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "loans.read",
  ], {
    subscriptionTier: "pro",
  });
  const authed = authedForUser(t, userId);

  await t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        ctx.db.insert("transitRecords", {
          organizationId,
          transitNumber: `TRN-2026-${String(index + 1).padStart(4, "0")}`,
          transitType: "outgoing",
          originName: "Storage",
          destinationName: `Destination ${index + 1}`,
          carrier: "Carrier Co",
          status: "draft",
          createdBy: userId,
          createdAt: Date.now() - index * 86_400_000,
        }),
      ),
    );
  });

  const page1 = await authed.query(api.transit.listTransitRecords, {
    organizationId,
    paginationOpts: { numItems: 2, cursor: null },
  });

  expect(page1.page).toHaveLength(2);
  expect(page1.isDone).toBe(false);

  const page2 = await authed.query(api.transit.listTransitRecords, {
    organizationId,
    paginationOpts: { numItems: 2, cursor: page1.continueCursor },
  });

  expect(page2.page.length).toBeGreaterThan(0);
});

test("should create transit record with auto-generated number", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId: transitId,
  });

  expect(transit).not.toBeNull();
  expect(transit?.transitNumber).toMatch(/^TRN-\d{4}-\d{4}$/);
  expect(transit?.status).toBe("draft");
});

test("should update transit status and create status history", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "in_transit",
    description: "Picked up by carrier",
  });

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId: transitId,
  });

  expect(transit?.status).toBe("in_transit");
  expect(transit?.statusHistory.length).toBeGreaterThan(0);
  expect(transit?.statusHistory[0]?.description).toBe("Picked up by carrier");
});

test("should link transit to loan and retrieve via getTransitForLoan", async () => {
  const t = createConvexTest();
  const { organizationId, loanId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
    loanId,
  });

  const transits = await authed.query(api.transit.getTransitForLoan, {
    loanId,
  });

  expect(transits).toHaveLength(1);
  expect(transits[0]?._id).toBe(transitId);
});

test("should add and remove items from transit", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId, authed } =
    await setupTransitFixture(t);

  const secondCollectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `TRN-2-${Math.random().toString(36).slice(2, 6)}`,
      title: "Second Transit Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
    collectionIds: [collectionId],
  });

  await authed.mutation(api.transit.addItemsToTransit, {
    transitRecordId: transitId,
    collectionIds: [secondCollectionId],
  });

  let transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId: transitId,
  });
  expect(transit?.items).toHaveLength(2);

  const itemToRemove = transit?.items.find(
    (item) => item.collectionId === secondCollectionId,
  );
  expect(itemToRemove).toBeDefined();

  await authed.mutation(api.transit.removeItemFromTransit, {
    transitItemId: itemToRemove!._id,
  });

  transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId: transitId,
  });
  expect(transit?.items).toHaveLength(1);
});

test("should update transit item status on delivery", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, authed } =
    await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
    collectionIds: [collectionId],
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "in_transit",
    description: "En route",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "delivered",
    description: "Successfully delivered",
  });

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId: transitId,
  });

  expect(transit?.items[0]?.status).toBe("delivered");
});

test("should prevent deletion of in-transit records", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "in_transit",
    description: "In transit",
  });

  await expect(
    authed.mutation(api.transit.deleteTransitRecord, { transitRecordId: transitId }),
  ).rejects.toThrow("Can only delete draft or cancelled transit records");
});

test("should require permission for getTransitForLoanWithHistory", async () => {
  const t = createConvexTest();

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const loanId = await t.run(async (ctx) => {
    return await ctx.db.insert("loans", {
      organizationId: orgId,
      loanNumber: "LOAN-001",
      type: "outgoing",
      status: "active",
      lenderBorrowerName: "Test Borrower",
      startDate: Date.now(),
      endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
  });

  await expect(
    t.query(api.transit.getTransitForLoanWithHistory, { loanId }),
  ).rejects.toThrow();
});

test("should return empty array when no transit records exist", async () => {
  const t = createConvexTest();
  const { loanId, authed } = await setupTransitFixture(t);

  const transits = await authed.query(api.transit.getTransitForLoan, { loanId });

  expect(transits).toEqual([]);
});

test("should reject invalid transit status transitions", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "cancelled",
    description: "Shipment cancelled",
  });

  await expect(
    authed.mutation(api.transit.updateTransitStatus, {
      transitRecordId: transitId,
      status: "in_transit",
      description: "Attempt to revive cancelled shipment",
    }),
  ).rejects.toThrow(
    "Invalid transit status transition from cancelled to in_transit",
  );
});

test("should reject transition from delivered to draft", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "in_transit",
    description: "En route",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "delivered",
    description: "Delivered",
  });

  await expect(
    authed.mutation(api.transit.updateTransitStatus, {
      transitRecordId: transitId,
      status: "draft",
      description: "Attempt to revert to draft",
    }),
  ).rejects.toThrow(
    "Invalid transit status transition from delivered to draft",
  );
});

test("should allow draft to scheduled to in_transit transitions", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "scheduled",
    description: "Pickup scheduled",
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "in_transit",
    description: "Picked up by carrier",
  });

  const transit = await authed.query(api.transit.getTransitRecord, {
    transitRecordId: transitId,
  });

  expect(transit?.status).toBe("in_transit");
  expect(transit?.statusHistory).toHaveLength(2);
});

test("should reject same-status updates", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
  });

  await expect(
    authed.mutation(api.transit.updateTransitStatus, {
      transitRecordId: transitId,
      status: "draft",
      description: "No-op update",
    }),
  ).rejects.toThrow("Invalid transit status transition from draft to draft");
});

test("should return transit records with status history", async () => {
  const t = createConvexTest();
  const { organizationId, loanId, authed } = await setupTransitFixture(t);

  const transitId = await authed.mutation(api.transit.createTransitRecord, {
    organizationId,
    transitType: "outgoing",
    originName: "Museum Storage",
    destinationName: "Partner Gallery",
    carrier: "Art Handler Co",
    loanId,
  });

  await authed.mutation(api.transit.updateTransitStatus, {
    transitRecordId: transitId,
    status: "scheduled",
    description: "Pickup scheduled",
  });

  const records = await authed.query(api.transit.getTransitForLoanWithHistory, {
    loanId,
  });

  expect(records).toHaveLength(1);
  expect(records[0]?._id).toBe(transitId);
  expect(records[0]?.statusHistory.length).toBeGreaterThan(0);
});
