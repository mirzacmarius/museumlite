import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { inventoryErrorFromError } from "../convex/utils/inventoryErrors";
import { notificationEntityHref } from "../convex/utils/notificationLinks";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  custodyConflictOf,
} from "./testHarness";

const FIELD_PERMISSIONS = [
  "collections.read",
  "locations.read",
  "locations.update",
];
const CATALOGER_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "locations.read",
];
const REPAIR_PERMISSIONS = [...FIELD_PERMISSIONS, "collections.update"];

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
  permissions: string[],
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: `${name} role`,
      isSystemRole: false,
    });
    const existing = new Map(
      (await ctx.db.query("permissions").collect()).map((row) => [
        row.name,
        row._id,
      ]),
    );
    for (const permission of permissions) {
      const permissionId =
        existing.get(permission) ??
        (await ctx.db.insert("permissions", {
          name: permission,
          category: permission.split(".")[0] ?? "collections",
        }));
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: 1,
    });
    return userId;
  });
}

async function createOrganization(t: ConvexTest, name: string) {
  return t.run((ctx) =>
    ctx.db.insert("organizations", {
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      type: "museum",
      subscriptionTier: "free",
    }),
  );
}

async function insertLocation(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
  extra: {
    parentLocationId?: Id<"locations">;
    status?: "active" | "closed";
    capacity?: number;
  } = {},
) {
  return t.run((ctx) =>
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

async function insertObject(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  accessionNumber: string,
  currentLocationId?: Id<"locations">,
  status: "active" | "loaned" | "deaccessioned" = "active",
) {
  return t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber,
      normalizedIdentifier: accessionNumber.toLowerCase(),
      title: `Object ${accessionNumber}`,
      status,
      currentLocationId,
      catalogedBy: userId,
      catalogedAt: 1,
    }),
  );
}

async function setup() {
  const t = createConvexTest();
  const organizationId = await createOrganization(t, "Home Museum");
  const fieldId = await addMember(
    t,
    organizationId,
    "Fran Field",
    REPAIR_PERMISSIONS,
  );
  const scannerId = await addMember(
    t,
    organizationId,
    "Sam Scanner",
    FIELD_PERMISSIONS,
  );
  const catalogerId = await addMember(
    t,
    organizationId,
    "Cato Cataloger",
    CATALOGER_PERMISSIONS,
  );
  const foreignOrganizationId = await createOrganization(t, "Other Museum");
  const foreignId = await addMember(
    t,
    foreignOrganizationId,
    "Fiona Foreign",
    REPAIR_PERMISSIONS,
  );

  const storeId = await insertLocation(t, organizationId, "Store");
  const shelfAId = await insertLocation(t, organizationId, "Shelf A", {
    parentLocationId: storeId,
  });
  const shelfBId = await insertLocation(t, organizationId, "Shelf B", {
    parentLocationId: storeId,
  });
  const galleryId = await insertLocation(t, organizationId, "Gallery");
  const foreignLocationId = await insertLocation(
    t,
    foreignOrganizationId,
    "Foreign store",
  );

  const a1 = await insertObject(t, organizationId, fieldId, "A-1", shelfAId);
  const a2 = await insertObject(t, organizationId, fieldId, "A-2", shelfAId);
  const b1 = await insertObject(t, organizationId, fieldId, "B-1", shelfBId);
  const g1 = await insertObject(t, organizationId, fieldId, "G-1", galleryId);
  const loaned = await insertObject(
    t,
    organizationId,
    fieldId,
    "L-1",
    shelfAId,
    "loaned",
  );
  const foreignObject = await insertObject(
    t,
    foreignOrganizationId,
    foreignId,
    "A-1",
    foreignLocationId,
  );

  return {
    t,
    organizationId,
    foreignOrganizationId,
    fieldId,
    scannerId,
    field: authedForUser(t, fieldId),
    scanner: authedForUser(t, scannerId),
    cataloger: authedForUser(t, catalogerId),
    foreign: authedForUser(t, foreignId),
    storeId,
    shelfAId,
    shelfBId,
    galleryId,
    foreignLocationId,
    objects: { a1, a2, b1, g1, loaned, foreignObject },
  };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

async function startStoreSession(f: Fixture) {
  return await f.field.mutation(api.inventory.startSession, {
    organizationId: f.organizationId,
    name: "Store spot check",
    scopeLocationId: f.storeId,
    includeSublocations: true,
  });
}

async function inventoryErrorOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return inventoryErrorFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

describe("inventory sessions", () => {
  test("starting a session snapshots the collection objects recorded in scope", async () => {
    const f = await setup();

    const sessionId = await startStoreSession(f);

    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session).toMatchObject({
      name: "Store spot check",
      status: "scanning",
      scopeLocationId: f.storeId,
      includeSublocations: true,
      startedByName: "Fran Field",
      progress: { expected: 3, observed: 0, remaining: 3 },
    });
    expect(session.scopeLocations.map((location) => location.name)).toEqual([
      "Store",
      "Shelf A",
      "Shelf B",
    ]);
    const expected = await f.cataloger.query(api.inventory.listExpected, {
      sessionId,
    });
    expect(
      expected.map((row) => [row.accessionNumber, row.expectedLocationName]),
    ).toEqual([
      ["A-1", "Shelf A"],
      ["A-2", "Shelf A"],
      ["B-1", "Shelf B"],
    ]);
  });

  test("only staff who may move objects start sessions, and only in their organization", async () => {
    const f = await setup();

    expect(
      await capabilityFailureOf(
        f.cataloger.mutation(api.inventory.startSession, {
          organizationId: f.organizationId,
          name: "Not mine",
          scopeLocationId: f.storeId,
          includeSublocations: true,
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.startSession, {
          organizationId: f.organizationId,
          name: "Foreign scope",
          scopeLocationId: f.foreignLocationId,
          includeSublocations: false,
        }),
      ),
    ).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.startSession, {
          organizationId: f.organizationId,
          name: "   ",
          scopeLocationId: f.storeId,
          includeSublocations: false,
        }),
      ),
    ).toMatchObject({ code: "NAME_REQUIRED" });

    const sessionId = await startStoreSession(f);
    await expect(
      f.foreign.query(api.inventory.getSession, { sessionId }),
    ).rejects.toThrow();
    const asCataloger = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(asCataloger.canWork).toBe(false);
  });
});

function objectUrl(collectionId: Id<"collections">) {
  return `https://app.example.test/en/objects/${collectionId}`;
}

async function scan(
  staff: Fixture["field"],
  sessionId: Id<"inventorySessions">,
  observedLocationId: Id<"locations">,
  scannedValue: string,
  clientObservationId: string,
  method: "scan" | "manual" = "scan",
) {
  return await staff.mutation(api.inventory.recordObservation, {
    sessionId,
    clientObservationId,
    scannedValue,
    method,
    observedLocationId,
  });
}

describe("scan observations", () => {
  test("each scan is compared with the expectation and kept as evidence without moving anything", async () => {
    const f = await setup();
    const sessionId = await startStoreSession(f);

    const expected = await scan(
      f.scanner,
      sessionId,
      f.shelfAId,
      objectUrl(f.objects.a1),
      "s1",
    );
    const misplaced = await scan(
      f.scanner,
      sessionId,
      f.shelfBId,
      " a-2 ",
      "s2",
      "manual",
    );
    const unexpected = await scan(
      f.scanner,
      sessionId,
      f.shelfBId,
      objectUrl(f.objects.g1),
      "s3",
    );
    const unknown = await scan(
      f.scanner,
      sessionId,
      f.shelfBId,
      "NOPE-9",
      "s4",
    );
    const foreign = await scan(
      f.scanner,
      sessionId,
      f.shelfBId,
      objectUrl(f.objects.foreignObject),
      "s5",
    );
    const repeat = await scan(
      f.scanner,
      sessionId,
      f.shelfAId,
      "A-1",
      "s6",
      "manual",
    );

    expect(
      [expected, misplaced, unexpected, unknown, foreign, repeat].map(
        (result) => result.outcome,
      ),
    ).toEqual([
      "expected",
      "misplaced",
      "unexpected",
      "unknown",
      "unknown",
      "repeat",
    ]);
    expect(misplaced.object).toMatchObject({
      accessionNumber: "A-2",
      recordedLocationName: "Shelf A",
    });
    expect(foreign.object).toBeUndefined();

    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session.progress).toEqual({
      expected: 3,
      observed: 2,
      remaining: 1,
    });
    expect(session.observationCount).toBe(6);

    const observations = await f.cataloger.query(
      api.inventory.listObservations,
      {
        sessionId,
      },
    );
    expect(observations[0]).toMatchObject({
      scannedValue: "A-1",
      method: "manual",
      outcome: "repeat",
      observedByName: "Sam Scanner",
      observedLocationName: "Shelf A",
    });
    expect(
      observations.find((row) => row.outcome === "misplaced"),
    ).toMatchObject({
      scannedValue: "a-2",
      accessionNumber: "A-2",
      observedLocationName: "Shelf B",
      recordedLocationName: "Shelf A",
      observedByName: "Sam Scanner",
      observedAt: expect.any(Number),
    });

    for (const [collectionId, locationId] of [
      [f.objects.a2, f.shelfAId],
      [f.objects.g1, f.galleryId],
    ] as const) {
      const record = await f.field.query(api.collections.get, { collectionId });
      expect(record?.currentLocationId).toBe(locationId);
      const history = await f.field.query(
        api.locations.getCollectionLocationHistory,
        {
          collectionId,
        },
      );
      expect(history).toHaveLength(0);
    }
  });

  test("retrying a scan with its identifier returns the first result and records nothing twice", async () => {
    const f = await setup();
    const sessionId = await startStoreSession(f);

    const first = await scan(
      f.scanner,
      sessionId,
      f.shelfAId,
      objectUrl(f.objects.a1),
      "retry-1",
    );
    const retry = await scan(
      f.scanner,
      sessionId,
      f.shelfAId,
      objectUrl(f.objects.a1),
      "retry-1",
    );

    expect(retry).toEqual({ ...first, alreadyRecorded: true });
    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session.observationCount).toBe(1);
    expect(session.progress.observed).toBe(1);
  });

  test("scans are refused outside the scope, for staff who may not move objects and after finishing", async () => {
    const f = await setup();
    const sessionId = await startStoreSession(f);

    expect(
      await inventoryErrorOf(
        scan(f.scanner, sessionId, f.galleryId, "A-1", "x1"),
      ),
    ).toMatchObject({ code: "LOCATION_OUT_OF_SCOPE" });
    expect(
      await inventoryErrorOf(
        scan(f.scanner, sessionId, f.shelfAId, "   ", "x2"),
      ),
    ).toMatchObject({ code: "SCAN_VALUE_REQUIRED" });
    expect(
      await capabilityFailureOf(
        scan(f.cataloger, sessionId, f.shelfAId, "A-1", "x3"),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    await expect(
      scan(f.foreign, sessionId, f.shelfAId, "A-1", "x4"),
    ).rejects.toThrow();

    await f.field.mutation(api.inventory.finishScanning, { sessionId });
    expect(
      await inventoryErrorOf(
        scan(f.scanner, sessionId, f.shelfAId, "A-1", "x5"),
      ),
    ).toMatchObject({ code: "SESSION_NOT_SCANNING" });
  });
});

async function scanStoreWithDifferences(f: Fixture) {
  const sessionId = await startStoreSession(f);
  await scan(f.scanner, sessionId, f.shelfAId, objectUrl(f.objects.a1), "d1");
  await scan(f.scanner, sessionId, f.shelfBId, objectUrl(f.objects.a2), "d2");
  await scan(f.scanner, sessionId, f.shelfBId, objectUrl(f.objects.g1), "d3");
  await scan(f.scanner, sessionId, f.shelfBId, "NOPE-9", "d4", "manual");
  await scan(f.scanner, sessionId, f.shelfAId, "NOPE-9", "d5", "manual");
  return sessionId;
}

describe("finishing a session", () => {
  test("every difference becomes one exception for review", async () => {
    const f = await setup();
    const sessionId = await scanStoreWithDifferences(f);

    await f.field.mutation(api.inventory.finishScanning, { sessionId });
    await f.field.mutation(api.inventory.finishScanning, { sessionId });

    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session).toMatchObject({
      status: "reviewing",
      exceptionCount: 4,
      openExceptionCount: 4,
      finishedByName: "Fran Field",
    });
    const exceptions = await f.cataloger.query(api.inventory.listExceptions, {
      sessionId,
    });
    expect(
      exceptions.map((row) => ({
        kind: row.kind,
        status: row.status,
        label: row.accessionNumber ?? row.scannedValue,
        recorded: row.recordedLocationName,
        observed: row.observedLocationName,
      })),
    ).toEqual([
      {
        kind: "missing",
        status: "open",
        label: "B-1",
        recorded: "Shelf B",
        observed: undefined,
      },
      {
        kind: "misplaced",
        status: "open",
        label: "A-2",
        recorded: "Shelf A",
        observed: "Shelf B",
      },
      {
        kind: "unexpected",
        status: "open",
        label: "G-1",
        recorded: "Gallery",
        observed: "Shelf B",
      },
      {
        kind: "unknown_label",
        status: "open",
        label: "NOPE-9",
        recorded: undefined,
        observed: "Shelf B",
      },
    ]);
  });

  test("a session without differences is reconciled when scanning finishes", async () => {
    const f = await setup();
    const sessionId = await startStoreSession(f);
    await scan(f.scanner, sessionId, f.shelfAId, "A-1", "c1");
    await scan(f.scanner, sessionId, f.shelfAId, "A-2", "c2");
    await scan(f.scanner, sessionId, f.shelfBId, "B-1", "c3");

    await f.scanner.mutation(api.inventory.finishScanning, { sessionId });

    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session).toMatchObject({ status: "reconciled", exceptionCount: 0 });
    expect(session.reconciledAt).toEqual(expect.any(Number));
  });

  test("cancelling keeps the observations and creates no exceptions", async () => {
    const f = await setup();
    const sessionId = await scanStoreWithDifferences(f);

    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.cancelSession, {
          sessionId,
          reason: " ",
        }),
      ),
    ).toMatchObject({ code: "REASON_REQUIRED" });
    await f.field.mutation(api.inventory.cancelSession, {
      sessionId,
      reason: "Fire drill",
    });

    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session).toMatchObject({
      status: "cancelled",
      cancelReason: "Fire drill",
      cancelledByName: "Fran Field",
      observationCount: 5,
      exceptionCount: 0,
    });
    expect(
      await f.cataloger.query(api.inventory.listObservations, { sessionId }),
    ).toHaveLength(5);
    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.finishScanning, { sessionId }),
      ),
    ).toMatchObject({ code: "SESSION_NOT_SCANNING" });
  });
});

async function finishedStoreSession(f: Fixture) {
  const sessionId = await scanStoreWithDifferences(f);
  await f.field.mutation(api.inventory.finishScanning, { sessionId });
  const exceptions = await f.field.query(api.inventory.listExceptions, {
    sessionId,
  });
  const byKind = (kind: (typeof exceptions)[number]["kind"]) => {
    const row = exceptions.find((exception) => exception.kind === kind);
    if (!row) throw new Error(`No ${kind} exception`);
    return row._id;
  };
  return {
    sessionId,
    missing: byKind("missing"),
    misplaced: byKind("misplaced"),
    unexpected: byKind("unexpected"),
    unknown: byKind("unknown_label"),
  };
}

describe("exception review", () => {
  test("recording the move to the observed location is one guarded, authorized movement", async () => {
    const f = await setup();
    const s = await finishedStoreSession(f);

    const first = await f.field.mutation(api.inventory.recordObservedLocation, {
      exceptionId: s.misplaced,
    });
    const retry = await f.field.mutation(api.inventory.recordObservedLocation, {
      exceptionId: s.misplaced,
    });

    expect(first).toMatchObject({
      resolution: { kind: "moved", movementId: expect.any(String) },
      alreadyResolved: false,
    });
    expect(retry).toEqual({ ...first, alreadyResolved: true });
    const record = await f.field.query(api.collections.get, {
      collectionId: f.objects.a2,
    });
    expect(record?.currentLocationId).toBe(f.shelfBId);
    const history = await f.field.query(
      api.locations.getCollectionLocationHistory,
      { collectionId: f.objects.a2 },
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      movementKind: "inventory_reconciliation",
      fromLocationId: f.shelfAId,
      toLocationId: f.shelfBId,
      movedBy: f.fieldId,
      authorizedBy: f.fieldId,
      inventoryExceptionId: s.misplaced,
    });
    const [exception] = (
      await f.cataloger.query(api.inventory.listExceptions, {
        sessionId: s.sessionId,
      })
    ).filter((row) => row._id === s.misplaced);
    expect(exception).toMatchObject({
      status: "resolved",
      resolvedByName: "Fran Field",
    });
    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId: s.sessionId,
    });
    expect(session.openExceptionCount).toBe(3);
  });

  test("a colleague's move since the scan is refused as a changed source and the exception stays open", async () => {
    const f = await setup();
    const s = await finishedStoreSession(f);
    await f.field.mutation(api.locations.moveObject, {
      collectionId: f.objects.a2,
      toLocationId: f.galleryId,
      expectedFromLocationId: f.shelfAId,
    });

    const conflict = await custodyConflictOf(
      f.field.mutation(api.inventory.recordObservedLocation, {
        exceptionId: s.misplaced,
      }),
    );

    expect(conflict).toMatchObject({ code: "SOURCE_CHANGED" });
    const record = await f.field.query(api.collections.get, {
      collectionId: f.objects.a2,
    });
    expect(record?.currentLocationId).toBe(f.galleryId);
    const rows = await f.field.query(api.inventory.listExceptions, {
      sessionId: s.sessionId,
    });
    expect(rows.find((row) => row._id === s.misplaced)?.status).toBe("open");
  });

  test("an exception whose record already shows the observed location closes without a movement", async () => {
    const f = await setup();
    const s = await finishedStoreSession(f);
    await f.field.mutation(api.locations.moveObject, {
      collectionId: f.objects.g1,
      toLocationId: f.shelfBId,
    });

    const result = await f.field.mutation(
      api.inventory.recordObservedLocation,
      {
        exceptionId: s.unexpected,
      },
    );

    expect(result.resolution).toEqual({ kind: "location_confirmed" });
    const history = await f.field.query(
      api.locations.getCollectionLocationHistory,
      { collectionId: f.objects.g1 },
    );
    expect(history).toHaveLength(1);
  });

  test("an object recorded as out on loan cannot be moved in from a sighting", async () => {
    const f = await setup();
    const sessionId = await startStoreSession(f);
    await scan(f.scanner, sessionId, f.shelfAId, "L-1", "l1", "manual");
    await scan(f.scanner, sessionId, f.shelfAId, "A-1", "l2", "manual");
    await scan(f.scanner, sessionId, f.shelfAId, "A-2", "l3", "manual");
    await scan(f.scanner, sessionId, f.shelfBId, "B-1", "l4", "manual");
    await f.field.mutation(api.inventory.finishScanning, { sessionId });
    const [exception] = await f.field.query(api.inventory.listExceptions, {
      sessionId,
    });
    expect(exception).toMatchObject({
      kind: "unexpected",
      accessionNumber: "L-1",
    });

    const conflict = await custodyConflictOf(
      f.field.mutation(api.inventory.recordObservedLocation, {
        exceptionId: exception?._id as Id<"inventoryExceptions">,
      }),
    );

    expect(conflict).toMatchObject({ code: "EXTERNAL_CUSTODY" });
  });

  test("missing objects and unknown labels cannot be moved; staff accept them with a reason", async () => {
    const f = await setup();
    const s = await finishedStoreSession(f);

    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.recordObservedLocation, {
          exceptionId: s.missing,
        }),
      ),
    ).toMatchObject({ code: "EXCEPTION_NOT_MOVABLE" });
    expect(
      await capabilityFailureOf(
        f.cataloger.mutation(api.inventory.acceptException, {
          exceptionId: s.missing,
          reason: "On display",
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.acceptException, {
          exceptionId: s.missing,
          reason: "  ",
        }),
      ),
    ).toMatchObject({ code: "REASON_REQUIRED" });
    await expect(
      f.foreign.mutation(api.inventory.acceptException, {
        exceptionId: s.missing,
        reason: "Not mine",
      }),
    ).rejects.toThrow();

    await f.field.mutation(api.inventory.acceptException, {
      exceptionId: s.missing,
      reason: "In the conservation studio",
    });
    await f.field.mutation(api.inventory.acceptException, {
      exceptionId: s.unknown,
      reason: "Label of a disposed object",
    });
    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.acceptException, {
          exceptionId: s.unknown,
          reason: "Again",
        }),
      ),
    ).toMatchObject({ code: "EXCEPTION_CLOSED" });
    await f.field.mutation(api.inventory.recordObservedLocation, {
      exceptionId: s.misplaced,
    });
    let session = await f.cataloger.query(api.inventory.getSession, {
      sessionId: s.sessionId,
    });
    expect(session.status).toBe("reviewing");
    await f.field.mutation(api.inventory.recordObservedLocation, {
      exceptionId: s.unexpected,
    });

    session = await f.cataloger.query(api.inventory.getSession, {
      sessionId: s.sessionId,
    });
    expect(session).toMatchObject({
      status: "reconciled",
      openExceptionCount: 0,
    });
    const rows = await f.cataloger.query(api.inventory.listExceptions, {
      sessionId: s.sessionId,
    });
    expect(rows.find((row) => row._id === s.missing)).toMatchObject({
      status: "accepted",
      resolution: { kind: "accepted", reason: "In the conservation studio" },
      resolvedByName: "Fran Field",
    });
  });
});

describe("repair work", () => {
  test("repair tasks hang on the exception, reach My work, and do not close it", async () => {
    const f = await setup();
    const s = await finishedStoreSession(f);
    const caseRef = {
      organizationId: f.organizationId,
      caseType: "inventoryException" as const,
      caseId: s.missing,
    };

    const assignable = (
      await f.field.query(api.caseTasks.listAssignableMembers, caseRef)
    ).map((member) => member.userId);
    expect(assignable).toEqual(
      expect.arrayContaining([f.fieldId, f.scannerId]),
    );
    expect(assignable).toHaveLength(2);

    const taskId = await f.field.mutation(api.caseTasks.create, {
      ...caseRef,
      title: "Search Shelf B and the photo studio for B-1",
      ownerId: f.scannerId,
    });

    expect(
      (
        await f.scanner.query(api.caseTasks.listMyWork, {
          organizationId: f.organizationId,
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toMatchObject([
      {
        _id: taskId,
        caseType: "inventoryException",
        caseId: s.missing,
        caseLabel: "B-1",
      },
    ]);
    const notification = (
      await f.scanner.query(api.notifications.getNotificationCenter, {
        organizationId: f.organizationId,
      })
    ).notifications.find((row) => row.type === "task_assigned");
    expect(
      notificationEntityHref(
        notification?.relatedEntityType,
        notification?.relatedEntityId,
      ),
    ).toBe(`/inventory/exceptions/${s.missing}`);

    await f.scanner.mutation(api.caseTasks.complete, { taskId });
    const rows = await f.field.query(api.inventory.listExceptions, {
      sessionId: s.sessionId,
    });
    expect(rows.find((row) => row._id === s.missing)?.status).toBe("open");

    await expect(
      f.foreign.query(api.caseTasks.listForCase, {
        ...caseRef,
        organizationId: f.foreignOrganizationId,
      }),
    ).rejects.toThrow();
  });

  test("an exception's detail names its session, evidence and tasks' case", async () => {
    const f = await setup();
    const s = await finishedStoreSession(f);

    const detail = await f.cataloger.query(api.inventory.getException, {
      exceptionId: s.misplaced,
    });

    expect(detail).toMatchObject({
      kind: "misplaced",
      status: "open",
      accessionNumber: "A-2",
      recordedLocationName: "Shelf A",
      observedLocationName: "Shelf B",
      observedByName: "Sam Scanner",
      sessionName: "Store spot check",
      canWork: false,
    });
    await expect(
      f.foreign.query(api.inventory.getException, { exceptionId: s.misplaced }),
    ).rejects.toThrow();
  });
});

describe("session list and scale", () => {
  test("sessions are listed newest first with their progress", async () => {
    const f = await setup();
    const older = await startStoreSession(f);
    await scan(f.scanner, older, f.shelfAId, "A-1", "o1");
    await f.field.mutation(api.inventory.cancelSession, {
      sessionId: older,
      reason: "Restarted",
    });
    const newer = await f.field.mutation(api.inventory.startSession, {
      organizationId: f.organizationId,
      name: "Gallery check",
      scopeLocationId: f.galleryId,
      includeSublocations: false,
    });

    const sessions = await f.cataloger.query(api.inventory.listSessions, {
      organizationId: f.organizationId,
    });

    expect(sessions.map((row) => [row._id, row.status])).toEqual([
      [newer, "scanning"],
      [older, "cancelled"],
    ]);
    expect(sessions[0]).toMatchObject({
      name: "Gallery check",
      scopeLocationName: "Gallery",
      progress: { expected: 1, observed: 0, remaining: 1 },
    });
    await expect(
      f.foreign.query(api.inventory.listSessions, {
        organizationId: f.organizationId,
      }),
    ).rejects.toThrow();
  });

  test("a scope of a thousand objects is compared in one bounded finish; a larger one is refused", async () => {
    const f = await setup();
    const vaultId = await insertLocation(f.t, f.organizationId, "Vault");
    await f.t.run(async (ctx) => {
      for (let index = 0; index < 1000; index++)
        await ctx.db.insert("collections", {
          organizationId: f.organizationId,
          accessionNumber: `V-${index}`,
          normalizedIdentifier: `v-${index}`,
          title: `Vault object ${index}`,
          status: "active",
          currentLocationId: vaultId,
          catalogedBy: f.fieldId,
          catalogedAt: 1,
        });
    });
    const sessionId = await f.field.mutation(api.inventory.startSession, {
      organizationId: f.organizationId,
      name: "Vault",
      scopeLocationId: vaultId,
      includeSublocations: false,
    });
    for (let index = 0; index < 10; index++)
      await scan(
        f.scanner,
        sessionId,
        vaultId,
        `V-${index}`,
        `v${index}`,
        "manual",
      );

    await f.field.mutation(api.inventory.finishScanning, { sessionId });

    const session = await f.cataloger.query(api.inventory.getSession, {
      sessionId,
    });
    expect(session).toMatchObject({
      progress: { expected: 1000, observed: 10, remaining: 990 },
      exceptionCount: 990,
    });

    await insertObject(f.t, f.organizationId, f.fieldId, "V-1000", vaultId);
    expect(
      await inventoryErrorOf(
        f.field.mutation(api.inventory.startSession, {
          organizationId: f.organizationId,
          name: "Too big",
          scopeLocationId: vaultId,
          includeSublocations: false,
        }),
      ),
    ).toMatchObject({ code: "SCOPE_TOO_LARGE", limit: 1000 });
  });
});
