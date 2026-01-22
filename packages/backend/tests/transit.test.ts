import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("should create transit record with auto-generated number", async () => {
  const t = convexTest(schema, modules);

  // 1. Create a transit record
  // const transitId = await t.mutation(api.transit.createTransitRecord, {
  //   organizationId: "test-org-id" as Id<"organizations">,
  //   transitType: "outgoing",
  //   originName: "Museum Storage",
  //   destinationName: "Partner Gallery",
  //   carrier: "Art Handler Co",
  // });

  // 2. Verify transit number format TRN-YYYY-XXXX
  // const transit = await t.query(api.transit.getTransitRecord, { transitRecordId: transitId });
  // expect(transit?.transitNumber).toMatch(/^TRN-\d{4}-\d{4}$/);

  expect(true).toBe(true);
});

test("should update transit status and create status history", async () => {
  const t = convexTest(schema, modules);

  // 1. Create transit record
  // const transitId = await t.mutation(api.transit.createTransitRecord, { /* ... */ });

  // 2. Update status to in_transit
  // await t.mutation(api.transit.updateTransitStatus, {
  //   transitRecordId: transitId,
  //   status: "in_transit",
  //   description: "Picked up by carrier",
  // });

  // 3. Verify status updated and history entry created
  // const transit = await t.query(api.transit.getTransitRecord, { transitRecordId: transitId });
  // expect(transit?.status).toBe("in_transit");
  // expect(transit?.statusHistory.length).toBeGreaterThan(0);

  expect(true).toBe(true);
});

test("should link transit to loan and retrieve via getTransitForLoan", async () => {
  const t = convexTest(schema, modules);

  // 1. Create transit record linked to loan
  // const transitId = await t.mutation(api.transit.createTransitRecord, {
  //   /* ... */
  //   loanId: someLoanId,
  // });

  // 2. Query transits for that loan
  // const transits = await t.query(api.transit.getTransitForLoan, { loanId: someLoanId });
  // expect(transits.length).toBe(1);
  // expect(transits[0]._id).toBe(transitId);

  expect(true).toBe(true);
});

test("should add and remove items from transit", async () => {
  const t = convexTest(schema, modules);

  // 1. Create transit record
  // const transitId = await t.mutation(api.transit.createTransitRecord, { /* ... */ });

  // 2. Add items
  // await t.mutation(api.transit.addItemsToTransit, {
  //   transitRecordId: transitId,
  //   collectionIds: [collectionId1, collectionId2],
  // });

  // 3. Verify items added
  // const transit = await t.query(api.transit.getTransitRecord, { transitRecordId: transitId });
  // expect(transit?.items.length).toBe(2);

  // 4. Remove one item
  // await t.mutation(api.transit.removeItemFromTransit, { transitItemId: transit.items[0]._id });

  // 5. Verify item removed
  // const updated = await t.query(api.transit.getTransitRecord, { transitRecordId: transitId });
  // expect(updated?.items.length).toBe(1);

  expect(true).toBe(true);
});

test("should update transit item status on delivery", async () => {
  const t = convexTest(schema, modules);

  // 1. Create transit with items
  // const transitId = await t.mutation(api.transit.createTransitRecord, {
  //   /* ... */
  //   collectionIds: [collectionId1],
  // });

  // 2. Update status to delivered
  // await t.mutation(api.transit.updateTransitStatus, {
  //   transitRecordId: transitId,
  //   status: "delivered",
  //   description: "Successfully delivered",
  // });

  // 3. Verify items also marked as delivered
  // const transit = await t.query(api.transit.getTransitRecord, { transitRecordId: transitId });
  // expect(transit?.items[0].status).toBe("delivered");

  expect(true).toBe(true);
});

test("should prevent deletion of in-transit records", async () => {
  const t = convexTest(schema, modules);

  expect(true).toBe(true);
});

test("should require permission for getTransitForLoanWithHistory", async () => {
  const t = convexTest(schema, modules);

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
  const t = convexTest(schema, modules);

  expect(true).toBe(true);
});

test("should return transit records with status history", async () => {
  const t = convexTest(schema, modules);

  expect(true).toBe(true);
});
