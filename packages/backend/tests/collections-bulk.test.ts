import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { capabilityUnavailableFromError } from "../convex/utils/capabilities";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function createBulkDeaccessionFixture(
  t: ReturnType<typeof createConvexTest>,
) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.read", "collections.delete"],
    {
      slugPrefix: "bulk-deaccession",
      organizationName: "Bulk Deaccession Museum",
    },
  );

  await t.run(async (ctx) => {
    const organization = await ctx.db.get(organizationId);
    await ctx.db.patch(organizationId, {
      settings: {
        ...organization?.settings,
        deaccessionWorkflowEnabled: false,
      },
    });
  });

  const {
    activeCollectionIdA,
    activeCollectionIdB,
    deaccessionedCollectionId,
    loanedCollectionId,
    missingCollectionId,
  } = await t.run(async (ctx) => {
    const [
      activeCollectionIdA,
      activeCollectionIdB,
      deaccessionedCollectionId,
      loanedCollectionId,
    ] = await Promise.all([
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "BULK-001",
        title: "Active object A",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "BULK-002",
        title: "Active object B",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "BULK-003",
        title: "Already deaccessioned",
        status: "deaccessioned",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "BULK-004",
        title: "Loaned object",
        status: "loaned",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
    ]);

    const missingCollectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "BULK-MISSING",
      title: "Deleted placeholder",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.delete(missingCollectionId);

    return {
      activeCollectionIdA,
      activeCollectionIdB,
      deaccessionedCollectionId,
      loanedCollectionId,
      missingCollectionId,
    };
  });

  return {
    authed: authedForUser(t, userId),
    organizationId,
    userId,
    activeCollectionIdA,
    activeCollectionIdB,
    deaccessionedCollectionId,
    loanedCollectionId,
    missingCollectionId,
  };
}

test("bulkDeaccession returns correct counts for mixed collection states", async () => {
  const t = createConvexTest();
  const {
    authed,
    organizationId,
    activeCollectionIdA,
    activeCollectionIdB,
    deaccessionedCollectionId,
    loanedCollectionId,
    missingCollectionId,
  } = await createBulkDeaccessionFixture(t);

  const result = await authed.mutation(api.collections.bulkDeaccession, {
    collectionIds: [
      activeCollectionIdA,
      activeCollectionIdB,
      deaccessionedCollectionId,
      loanedCollectionId,
      missingCollectionId,
    ],
    reason: "Bulk catalog cleanup",
  });

  expect(result).toEqual({
    deaccessioned: 0,
    awaitingDecision: 2,
    skipped: 1,
    failed: 2,
  });

  const [deaccessionedA, deaccessionedB, skipped, loaned, deaccessionRecords] =
    await t.run(async (ctx) => {
      const records = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();

      return Promise.all([
        ctx.db.get(activeCollectionIdA),
        ctx.db.get(activeCollectionIdB),
        ctx.db.get(deaccessionedCollectionId),
        ctx.db.get(loanedCollectionId),
        records,
      ] as const);
    });

  expect(deaccessionedA?.status).toBe("active");
  expect(deaccessionedB?.status).toBe("active");
  expect(skipped?.status).toBe("deaccessioned");
  expect(loaned?.status).toBe("loaned");

  expect(deaccessionRecords).toHaveLength(2);
  expect(
    deaccessionRecords.map((record) => record.collectionId).sort(),
  ).toEqual([activeCollectionIdA, activeCollectionIdB].sort());
  for (const record of deaccessionRecords) {
    expect(record.method).toBe("destruction");
    expect(record.reason).toBe("Bulk catalog cleanup");
    expect(record.status).toBe("pending");
  }
});

test("bulkDeaccession rejects unauthenticated callers", async () => {
  const t = createConvexTest();
  const { activeCollectionIdA } = await createBulkDeaccessionFixture(t);

  await expect(
    t.mutation(api.collections.bulkDeaccession, {
      collectionIds: [activeCollectionIdA],
      reason: "Should fail",
    }),
  ).rejects.toThrow("Not authenticated");
});

/** A member of the fixture's organization holding exactly these permissions. */
async function addMember(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
  permissionNames: string[],
) {
  return t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Member role",
      isSystemRole: false,
    });
    for (const name of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    const userId = await ctx.db.insert("users", {
      email: `member-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Member",
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return { userId, roleId };
  });
}

async function pendingRecordsFor(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
) {
  return t.run((ctx) =>
    ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  );
}

test("bulkDeaccession refuses a role that cannot start one, with the coded reason", async () => {
  const t = createConvexTest();
  const { organizationId, activeCollectionIdA, activeCollectionIdB } =
    await createBulkDeaccessionFixture(t);
  // Approving decisions is not the right to start one.
  const { userId } = await addMember(t, organizationId, [
    "collections.read",
    "collections.update",
    "collections.approve_deaccession",
  ]);
  const authed = authedForUser(t, userId);

  expect(
    await authed.query(api.capabilities.deaccessionInitiation, {
      organizationId,
    }),
  ).toMatchObject({ capability: "deaccession", status: "permission_missing" });

  const error = await authed
    .mutation(api.collections.bulkDeaccession, {
      collectionIds: [activeCollectionIdA, activeCollectionIdB],
      reason: "Unauthorized attempt",
    })
    .catch((caught: unknown) => caught);

  expect(capabilityUnavailableFromError(error)).toMatchObject({
    reason: "permission_missing",
    capability: "deaccession",
  });
  expect(await pendingRecordsFor(t, organizationId)).toHaveLength(0);
});

test("bulkDeaccession lets a role with collections.create start proposals", async () => {
  const t = createConvexTest();
  const { organizationId, activeCollectionIdA, activeCollectionIdB } =
    await createBulkDeaccessionFixture(t);
  // A Curator-like role: no collections.delete, which bulk used to demand.
  const { userId } = await addMember(t, organizationId, [
    "collections.read",
    "collections.create",
  ]);
  const authed = authedForUser(t, userId);

  expect(
    await authed.query(api.capabilities.deaccessionInitiation, {
      organizationId,
    }),
  ).toMatchObject({ capability: "deaccession", status: "available" });

  const result = await authed.mutation(api.collections.bulkDeaccession, {
    collectionIds: [activeCollectionIdA, activeCollectionIdB],
    reason: "Curatorial review",
  });

  expect(result).toEqual({
    deaccessioned: 0,
    awaitingDecision: 2,
    skipped: 0,
    failed: 0,
  });
  const records = await pendingRecordsFor(t, organizationId);
  expect(records.map((record) => record.status)).toEqual([
    "pending",
    "pending",
  ]);
});

test("bulkDeaccession follows the workflow's initiating roles and never decides", async () => {
  const t = createConvexTest();
  const { organizationId, activeCollectionIdA } =
    await createBulkDeaccessionFixture(t);
  const initiator = await addMember(t, organizationId, ["collections.read"]);
  const outsider = await addMember(t, organizationId, [
    "collections.read",
    "collections.delete",
  ]);
  await t.run(async (ctx) => {
    const organization = await ctx.db.get(organizationId);
    await ctx.db.patch(organizationId, {
      settings: { ...organization?.settings, deaccessionWorkflowEnabled: true },
    });
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [
        { stepNumber: 1, roleId: outsider.roleId, name: "Collections review" },
      ],
      canInitiateRoles: [initiator.roleId],
    });
  });

  // With a workflow, collections.delete alone does not start one.
  const refused = await authedForUser(t, outsider.userId)
    .mutation(api.collections.bulkDeaccession, {
      collectionIds: [activeCollectionIdA],
      reason: "Not an initiator",
    })
    .catch((caught: unknown) => caught);
  expect(capabilityUnavailableFromError(refused)?.reason).toBe(
    "permission_missing",
  );

  const result = await authedForUser(t, initiator.userId).mutation(
    api.collections.bulkDeaccession,
    { collectionIds: [activeCollectionIdA], reason: "Workflow proposal" },
  );
  expect(result).toEqual({
    deaccessioned: 0,
    awaitingDecision: 1,
    skipped: 0,
    failed: 0,
  });
  const [record] = await pendingRecordsFor(t, organizationId);
  expect(record).toMatchObject({ status: "pending", workflowStep: 1 });
  expect(record?.approvedBy).toBeUndefined();
});

/** Two catalogued objects and an active store in the member's organization. */
async function createBulkMoveFixture(
  t: ReturnType<typeof createConvexTest>,
  permissions: string[],
) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    permissions,
    { slugPrefix: "bulk-move", organizationName: "Bulk Move Museum" },
  );
  const [objectA, objectB, storeId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "MOVE-001",
        title: "Ship's bell",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "MOVE-002",
        title: "Pilot's logbook",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("locations", {
        organizationId,
        name: "Store room B",
        type: "room",
        sortOrder: 0,
        isActive: true,
      }),
    ]),
  );
  const authed = authedForUser(t, userId);
  const locationsOf = async () =>
    Promise.all(
      [objectA, objectB].map(
        async (collectionId) =>
          (await authed.query(api.collections.get, { collectionId }))
            ?.currentLocationId,
      ),
    );
  return { authed, objectA, objectB, storeId, locationsOf };
}

test("staff who move objects can move several at once, as they move one", async () => {
  const t = createConvexTest();
  const { authed, objectA, objectB, storeId, locationsOf } =
    await createBulkMoveFixture(t, [
      "collections.read",
      "locations.read",
      "locations.update",
    ]);

  const result = await authed.mutation(api.collections.bulkUpdateLocation, {
    collectionIds: [objectA, objectB],
    locationId: storeId,
  });

  expect(result).toEqual({ updated: 2, failed: 0 });
  expect(await locationsOf()).toEqual([storeId, storeId]);
});

test("a bulk move by staff who may not move objects is refused and nothing moves", async () => {
  const t = createConvexTest();
  const { authed, objectA, objectB, storeId, locationsOf } =
    await createBulkMoveFixture(t, ["collections.read", "collections.update"]);

  const refusal = await authed
    .mutation(api.collections.bulkUpdateLocation, {
      collectionIds: [objectA, objectB],
      locationId: storeId,
    })
    .then(
      () => null,
      (error: unknown) => error,
    );

  expect(capabilityUnavailableFromError(refusal)).toMatchObject({
    reason: "permission_missing",
  });
  expect(await locationsOf()).toEqual([undefined, undefined]);
});
