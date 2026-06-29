import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
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
    deaccessioned: 2,
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

  expect(deaccessionedA?.status).toBe("deaccessioned");
  expect(deaccessionedB?.status).toBe("deaccessioned");
  expect(skipped?.status).toBe("deaccessioned");
  expect(loaned?.status).toBe("loaned");

  expect(deaccessionRecords).toHaveLength(2);
  expect(
    deaccessionRecords.map((record) => record.collectionId).sort(),
  ).toEqual([activeCollectionIdA, activeCollectionIdB].sort());
  for (const record of deaccessionRecords) {
    expect(record.method).toBe("destruction");
    expect(record.reason).toBe("Bulk catalog cleanup");
    expect(record.status).toBe("approved");
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

test("bulkDeaccession counts permission failures without throwing", async () => {
  const t = createConvexTest();
  const { organizationId, activeCollectionIdA, activeCollectionIdB } =
    await createBulkDeaccessionFixture(t);

  const readOnlyUserId = await t.run(async (ctx) => {
    const readOnlyRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Read Only",
      isSystemRole: false,
    });
    const readPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
    });
    await ctx.db.insert("rolePermissions", {
      roleId: readOnlyRoleId,
      permissionId: readPermissionId,
    });

    const readOnlyUserId = await ctx.db.insert("users", {
      email: `reader-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Read Only User",
    });
    await ctx.db.insert("userOrganizations", {
      userId: readOnlyUserId,
      organizationId,
      roleId: readOnlyRoleId,
      joinedAt: Date.now(),
    });

    return readOnlyUserId;
  });

  const readOnlyAuthed = authedForUser(t, readOnlyUserId);
  const result = await readOnlyAuthed.mutation(api.collections.bulkDeaccession, {
    collectionIds: [activeCollectionIdA, activeCollectionIdB],
    reason: "Unauthorized attempt",
  });

  expect(result).toEqual({
    deaccessioned: 0,
    skipped: 0,
    failed: 2,
  });
});
