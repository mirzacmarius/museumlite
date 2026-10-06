import { describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

const MOVER_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "locations.read",
  "locations.update",
];

async function insertLocation(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
  extra: { status?: "active" | "closed"; capacity?: number } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name,
      type: "room",
      sortOrder: 0,
      isActive: true,
      ...extra,
    }),
  );
}

async function setupMovementFixture() {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(
    t,
    MOVER_PERMISSIONS,
  );
  const storeId = await insertLocation(t, own.organizationId, "Store A");
  const galleryId = await insertLocation(t, own.organizationId, "Gallery");
  const studioId = await insertLocation(t, own.organizationId, "Studio");
  await t.run((ctx) =>
    ctx.db.patch(own.collectionId, { currentLocationId: storeId }),
  );
  return {
    t,
    ...own,
    storeId,
    galleryId,
    studioId,
    user: authedForUser(t, own.userId),
  };
}

async function dispatchOnOutgoingLoan(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
  userId: Id<"users">,
) {
  await t.run(async (ctx) => {
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "L-1",
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: Date.now(),
      endDate: Date.now() + 86_400_000,
      status: "dispatched",
      approvedBy: userId,
    });
    await ctx.db.insert("loanItems", { loanId, collectionId });
    await ctx.db.patch(collectionId, { status: "loaned" });
  });
}

describe("delayed move requests", () => {
  test("executing after the object moved records a retained source conflict instead of moving", async () => {
    const f = await setupMovementFixture();
    const requestId = await f.user.mutation(api.locations.createMoveRequest, {
      collectionId: f.collectionId,
      toLocationId: f.galleryId,
      reason: "Rotation",
    });
    await f.user.mutation(api.locations.approveMoveRequest, { requestId });
    await f.user.mutation(api.locations.moveObject, {
      collectionId: f.collectionId,
      toLocationId: f.studioId,
      reason: "Photography",
    });

    const outcome = await f.user.mutation(api.locations.executeMoveRequest, {
      requestId,
    });

    expect(outcome).toMatchObject({
      outcome: "conflict",
      issues: [expect.objectContaining({ type: "source_changed" })],
    });
    const collection = await f.user.query(api.collections.get, {
      collectionId: f.collectionId,
    });
    expect(collection?.currentLocationId).toBe(f.studioId);
    const [request] = await f.user.query(api.locations.listMoveRequests, {
      organizationId: f.organizationId,
      collectionId: f.collectionId,
    });
    expect(request).toMatchObject({
      _id: requestId,
      status: "conflict",
      conflicts: [
        {
          detectedBy: f.userId,
          observedFromLocationId: f.studioId,
          issues: [expect.objectContaining({ type: "source_changed" })],
        },
      ],
    });
  });
});

describe("direct movement command", () => {
  test("records actor, observed source, destination, time, reason and kind with the projection", async () => {
    const f = await setupMovementFixture();
    const before = Date.now();

    await f.user.mutation(api.locations.moveObject, {
      collectionId: f.collectionId,
      toLocationId: f.galleryId,
      reason: "Display rotation",
      notes: "Handled with gloves",
      expectedFromLocationId: f.storeId,
    });

    const collection = await f.user.query(api.collections.get, {
      collectionId: f.collectionId,
    });
    expect(collection?.currentLocationId).toBe(f.galleryId);
    const [entry] = await f.user.query(
      api.locations.getCollectionLocationHistory,
      { collectionId: f.collectionId },
    );
    expect(entry).toMatchObject({
      movementKind: "direct",
      movedBy: f.userId,
      fromLocationId: f.storeId,
      fromLocationName: "Store A",
      toLocationId: f.galleryId,
      reason: "Display rotation",
      notes: "Handled with gloves",
    });
    expect(entry?.movedAt).toBeGreaterThanOrEqual(before);
  });

  test("refuses a stale observed source without changing location or history", async () => {
    const f = await setupMovementFixture();

    await expect(
      f.user.mutation(api.locations.moveObject, {
        collectionId: f.collectionId,
        toLocationId: f.galleryId,
        expectedFromLocationId: f.studioId,
      }),
    ).rejects.toThrow("not the source observed");

    const collection = await f.user.query(api.collections.get, {
      collectionId: f.collectionId,
    });
    expect(collection?.currentLocationId).toBe(f.storeId);
    expect(
      await f.user.query(api.locations.getCollectionLocationHistory, {
        collectionId: f.collectionId,
      }),
    ).toEqual([]);
  });

  test("refuses moving an object dispatched on an outgoing loan", async () => {
    const f = await setupMovementFixture();
    await dispatchOnOutgoingLoan(
      t(f),
      f.organizationId,
      f.collectionId,
      f.userId,
    );

    await expect(
      f.user.mutation(api.locations.moveObject, {
        collectionId: f.collectionId,
        toLocationId: f.galleryId,
      }),
    ).rejects.toThrow("out on loan");
    expect(
      await f.user.query(api.locations.checkMoveAllowed, {
        collectionId: f.collectionId,
        toLocationId: f.galleryId,
      }),
    ).toMatchObject({
      allowed: false,
      requiresOverride: false,
      issues: [expect.objectContaining({ type: "external_custody" })],
    });
  });
});

function t(fixture: { t: ConvexTest }) {
  return fixture.t;
}

describe("move request lifecycle", () => {
  test("execution links the movement to the request, approver and observed source; retry returns the same movement", async () => {
    const f = await setupMovementFixture();
    const reviewer = await t(f).run(async (ctx) => {
      const reviewerId = await ctx.db.insert("users", {
        name: "Registrar",
        email: "registrar@example.com",
      });
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user", (q) => q.eq("userId", f.userId))
        .first();
      if (!membership) throw new Error("fixture membership missing");
      await ctx.db.insert("userOrganizations", {
        userId: reviewerId,
        organizationId: f.organizationId,
        roleId: membership.roleId,
        joinedAt: Date.now(),
      });
      return reviewerId;
    });
    const registrar = authedForUser(t(f), reviewer);
    const requestId = await f.user.mutation(api.locations.createMoveRequest, {
      collectionId: f.collectionId,
      toLocationId: f.galleryId,
      reason: "Rotation",
    });
    await registrar.mutation(api.locations.approveMoveRequest, {
      requestId,
      reviewNotes: "Approved for spring hang",
    });

    const first = await f.user.mutation(api.locations.executeMoveRequest, {
      requestId,
      executionNotes: "Moved by art handlers",
    });
    const retry = await f.user.mutation(api.locations.executeMoveRequest, {
      requestId,
    });

    expect(first).toMatchObject({
      outcome: "executed",
      alreadyExecuted: false,
    });
    if (first.outcome !== "executed") throw new Error("expected execution");
    expect(retry).toEqual({
      outcome: "executed",
      movementId: first.movementId,
      alreadyExecuted: true,
    });
    const history = await f.user.query(
      api.locations.getCollectionLocationHistory,
      { collectionId: f.collectionId },
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      _id: first.movementId,
      movementKind: "request",
      moveRequestId: requestId,
      movedBy: f.userId,
      authorizedBy: reviewer,
      authorizedByName: "Registrar",
      fromLocationId: f.storeId,
      toLocationId: f.galleryId,
      reason: "Rotation",
      notes: "Moved by art handlers",
    });
    expect(
      await f.user.query(api.locations.getMoveRequest, { requestId }),
    ).toMatchObject({
      status: "executed",
      movementId: first.movementId,
      reviewedByName: "Registrar",
      approvedFromLocationName: "Store A",
      conflicts: [],
    });
  });

  test("re-approval after a conflict binds the current source and executes while retaining the conflict", async () => {
    const f = await setupMovementFixture();
    const requestId = await f.user.mutation(api.locations.createMoveRequest, {
      collectionId: f.collectionId,
      toLocationId: f.galleryId,
      reason: "Rotation",
    });
    await f.user.mutation(api.locations.approveMoveRequest, { requestId });
    await f.user.mutation(api.locations.moveObject, {
      collectionId: f.collectionId,
      toLocationId: f.studioId,
    });
    await f.user.mutation(api.locations.executeMoveRequest, { requestId });

    await expect(
      f.user.mutation(api.locations.createMoveRequest, {
        collectionId: f.collectionId,
        toLocationId: f.storeId,
        reason: "Duplicate",
      }),
    ).rejects.toThrow("already has a pending move request");
    await f.user.mutation(api.locations.approveMoveRequest, {
      requestId,
      reviewNotes: "Object now in studio; still go to gallery",
    });
    const outcome = await f.user.mutation(api.locations.executeMoveRequest, {
      requestId,
    });

    expect(outcome).toMatchObject({ outcome: "executed" });
    const [latest] = await f.user.query(
      api.locations.getCollectionLocationHistory,
      { collectionId: f.collectionId },
    );
    expect(latest).toMatchObject({
      fromLocationId: f.studioId,
      toLocationId: f.galleryId,
      moveRequestId: requestId,
    });
    expect(
      await f.user.query(api.locations.getMoveRequest, { requestId }),
    ).toMatchObject({
      status: "executed",
      approvedFromLocationName: "Studio",
      conflicts: [
        expect.objectContaining({
          observedFromLocationName: "Studio",
          issues: [expect.objectContaining({ type: "source_changed" })],
        }),
      ],
    });
  });

  test("execution revalidates destination access and loan custody", async () => {
    const f = await setupMovementFixture();
    const closingRequest = await f.user.mutation(
      api.locations.createMoveRequest,
      {
        collectionId: f.collectionId,
        toLocationId: f.galleryId,
        reason: "Rotation",
      },
    );
    await f.user.mutation(api.locations.approveMoveRequest, {
      requestId: closingRequest,
    });
    await t(f).run((ctx) => ctx.db.patch(f.galleryId, { status: "closed" }));

    expect(
      await f.user.mutation(api.locations.executeMoveRequest, {
        requestId: closingRequest,
      }),
    ).toMatchObject({
      outcome: "conflict",
      issues: [expect.objectContaining({ type: "status_closed" })],
    });
    await f.user.mutation(api.locations.cancelMoveRequest, {
      requestId: closingRequest,
      reason: "Gallery closed",
    });

    const loanRequest = await f.user.mutation(api.locations.createMoveRequest, {
      collectionId: f.collectionId,
      toLocationId: f.studioId,
      reason: "Photography",
    });
    await f.user.mutation(api.locations.approveMoveRequest, {
      requestId: loanRequest,
    });
    await dispatchOnOutgoingLoan(
      t(f),
      f.organizationId,
      f.collectionId,
      f.userId,
    );

    expect(
      await f.user.mutation(api.locations.executeMoveRequest, {
        requestId: loanRequest,
      }),
    ).toMatchObject({
      outcome: "conflict",
      issues: [expect.objectContaining({ type: "external_custody" })],
    });
    const collection = await f.user.query(api.collections.get, {
      collectionId: f.collectionId,
    });
    expect(collection?.currentLocationId).toBe(f.storeId);
    expect(
      await f.user.query(api.locations.listMoveRequests, {
        organizationId: f.organizationId,
        collectionId: f.collectionId,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: closingRequest,
          status: "cancelled",
          notes: "Cancelled: Gallery closed",
        }),
        expect.objectContaining({ _id: loanRequest, status: "conflict" }),
      ]),
    );
  });
});

describe("move request authorization", () => {
  test("readers cannot request, approve or execute, and other organizations see nothing", async () => {
    const f = await setupMovementFixture();
    const requestId = await f.user.mutation(api.locations.createMoveRequest, {
      collectionId: f.collectionId,
      toLocationId: f.galleryId,
      reason: "Rotation",
    });
    const readerSetup = await createOrgUserWithPermissions(t(f), [
      "collections.read",
      "locations.read",
    ]);
    await t(f).run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: readerSetup.userId,
        organizationId: f.organizationId,
        roleId: readerSetup.roleId,
        joinedAt: Date.now(),
      });
    });
    const reader = authedForUser(t(f), readerSetup.userId);
    const outsider = authedForUser(
      t(f),
      (await createOrgUserWithPermissions(t(f), MOVER_PERMISSIONS)).userId,
    );

    for (const client of [reader, outsider]) {
      await expect(
        client.mutation(api.locations.createMoveRequest, {
          collectionId: f.collectionId,
          toLocationId: f.galleryId,
          reason: "Unauthorized",
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.locations.approveMoveRequest, { requestId }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.locations.executeMoveRequest, { requestId }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.locations.moveObject, {
          collectionId: f.collectionId,
          toLocationId: f.galleryId,
        }),
      ).rejects.toThrow();
    }
    await expect(
      outsider.query(api.locations.listMoveRequests, {
        organizationId: f.organizationId,
      }),
    ).rejects.toThrow();
    expect(
      await outsider.query(api.locations.getMoveRequest, { requestId }),
    ).toBeNull();
    expect(
      await reader.query(api.locations.getMoveRequest, { requestId }),
    ).toMatchObject({ status: "pending" });
  });
});

describe("bulk movement consistency", () => {
  test("a bulk move job fails a loaned item, moves the rest and links history to the job", async () => {
    const f = await setupMovementFixture();
    const loanedId = await t(f).run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: f.organizationId,
        accessionNumber: "LOANED-1",
        title: "Loaned",
        status: "active",
        currentLocationId: f.storeId,
        catalogedBy: f.userId,
        catalogedAt: Date.now(),
      }),
    );
    await dispatchOnOutgoingLoan(t(f), f.organizationId, loanedId, f.userId);

    vi.useFakeTimers();
    const jobId = await f.user.mutation(api.batchOperations.createBulkMoveJob, {
      organizationId: f.organizationId,
      collectionIds: [f.collectionId, loanedId],
      toLocationId: f.galleryId,
      reason: "Gallery refresh",
    });
    await t(f).finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();

    expect(
      await f.user.query(api.batchOperations.getBatchJobStatus, { jobId }),
    ).toMatchObject({
      successCount: 1,
      failureCount: 1,
      errors: [expect.objectContaining({ itemId: loanedId })],
    });
    expect(
      await f.user.query(api.locations.getCollectionLocationHistory, {
        collectionId: f.collectionId,
      }),
    ).toMatchObject([
      {
        movementKind: "bulk_move",
        batchJobId: jobId,
        fromLocationId: f.storeId,
        toLocationId: f.galleryId,
        reason: "Gallery refresh",
      },
    ]);
    expect(
      await f.user.query(api.locations.getCollectionLocationHistory, {
        collectionId: loanedId,
      }),
    ).toEqual([]);
  });

  test("editing a loaned object without changing its location still saves", async () => {
    const f = await setupMovementFixture();
    await dispatchOnOutgoingLoan(
      t(f),
      f.organizationId,
      f.collectionId,
      f.userId,
    );

    await f.user.mutation(api.collections.update, {
      collectionId: f.collectionId,
      title: "Renamed while on loan",
      currentLocationId: f.storeId,
    });

    const collection = await f.user.query(api.collections.get, {
      collectionId: f.collectionId,
    });
    expect(collection).toMatchObject({
      title: "Renamed while on loan",
      currentLocationId: f.storeId,
    });
  });
});
