import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import schema from "./schema";

test("collections.list hides deleted and deaccession workflow objects by default", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test User" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
    });

    const collectionsReadPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
      description: "Read collections",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      description: "Test role",
      isSystemRole: false,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: collectionsReadPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0001",
      title: "Active item",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    const pendingDeaccessionCollectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0002",
      title: "Pending deaccession item",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "D-0001",
      title: "Deaccessioned item",
      status: "deaccessioned",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "X-0001",
      title: "Deleted item",
      status: "deleted",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("deaccessions", {
      organizationId,
      collectionId: pendingDeaccessionCollectionId,
      deaccessionNumber: "DA-TES-2026-001",
      dateDeaccessioned: Date.now(),
      reason: "Duplicate entry",
      method: "destruction",
      status: "pending",
      workflowStep: 1,
      workflowHistory: [],
    });

    return { organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  const defaultList = await asUser.query(api.collections.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(defaultList.page.map((c) => c.title)).toEqual(["Active item"]);

  const includeAll = await asUser.query(api.collections.list, {
    organizationId,
    includeDeaccessioned: true,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(new Set(includeAll.page.map((c) => c.title))).toEqual(
    new Set(["Active item", "Deaccessioned item"]),
  );

  const onlyDeaccessioned = await asUser.query(api.collections.list, {
    organizationId,
    status: "deaccessioned",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(onlyDeaccessioned.page.map((c) => c.status)).toEqual([
    "deaccessioned",
  ]);

  const onlyDeleted = await asUser.query(api.collections.list, {
    organizationId,
    status: "deleted",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(onlyDeleted.page.map((c) => c.status)).toEqual(["deleted"]);

  const onlyActive = await asUser.query(api.collections.list, {
    organizationId,
    status: "active",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(onlyActive.page.map((c) => c.title)).toEqual(["Active item"]);
});

test("collections.emptyDeletedCollections permanently deletes deleted objects", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId, activeCollectionId, deletedCollectionId } =
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Test User" });
      const organizationId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org-empty-trash",
        type: "museum",
      });

      const readPermissionId = await ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
        description: "Read collections",
      });
      const deletePermissionId = await ctx.db.insert("permissions", {
        name: "collections.delete",
        category: "collections",
        description: "Delete collections",
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Collection Manager",
        description: "Test role",
        isSystemRole: false,
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: readPermissionId,
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: deletePermissionId,
      });
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });

      const activeCollectionId = await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-0001",
        title: "Active item",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });

      const deletedCollectionId = await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "D-0001",
        title: "Deleted item",
        status: "deleted",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });

      const groupId = await ctx.db.insert("collectionGroups", {
        organizationId,
        name: "Trash test group",
        createdBy: userId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("collectionGroupItems", {
        collectionGroupId: groupId,
        collectionId: deletedCollectionId,
        addedAt: Date.now(),
        addedBy: userId,
      });
      await ctx.db.insert("objectComments", {
        organizationId,
        objectId: deletedCollectionId,
        userId,
        content: "Delete with object",
        createdAt: Date.now(),
      });
      await ctx.db.insert("coinsStampsDetails", {
        organizationId,
        collectionId: deletedCollectionId,
        itemCategory: "coin",
        catalogNumber: "CS-TRASH-001",
        createdAt: Date.now(),
      });

      return {
        organizationId,
        userId,
        activeCollectionId,
        deletedCollectionId,
      };
    });

  const asUser = t.withIdentity({ subject: userId });

  await expect(
    asUser.query(api.collections.countDeletedCollections, { organizationId }),
  ).resolves.toBe(1);

  await expect(
    asUser.mutation(api.collections.emptyDeletedCollections, {
      organizationId,
    }),
  ).resolves.toEqual({ deletedCount: 1 });

  await t.run(async (ctx) => {
    await expect(ctx.db.get(activeCollectionId)).resolves.not.toBeNull();
    await expect(ctx.db.get(deletedCollectionId)).resolves.toBeNull();

    const groupItems = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", deletedCollectionId),
      )
      .collect();
    expect(groupItems).toEqual([]);

    const comments = await ctx.db
      .query("objectComments")
      .withIndex("by_object", (q) => q.eq("objectId", deletedCollectionId))
      .collect();
    expect(comments).toEqual([]);

    const coinsStampsDetails = await ctx.db
      .query("coinsStampsDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", deletedCollectionId),
      )
      .collect();
    expect(coinsStampsDetails).toEqual([]);
  });
});

test("collections.create rejects module collection types when module is disabled", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test User" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org-create",
      type: "museum",
      settings: {
        enabledModules: [],
      },
    });

    const createPermissionId = await ctx.db.insert("permissions", {
      name: "collections.create",
      category: "collections",
      description: "Create collections",
    });
    const readPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
      description: "Read collections",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Manager",
      description: "Test role",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: createPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  await expect(
    asUser.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "W-0001",
      title: "Wine Object",
      collectionType: "wine",
    }),
  ).rejects.toThrow("Collection type requires enabled module");
});

test("coins and stamps details require enabled module and surface in module details", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId, collectionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test User" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org-coins-stamps",
      type: "museum",
      settings: {
        enabledModules: ["coins_stamps"],
      },
    });

    const createPermissionId = await ctx.db.insert("permissions", {
      name: "collections.create",
      category: "collections",
      description: "Create collections",
    });
    const readPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
      description: "Read collections",
    });
    const updatePermissionId = await ctx.db.insert("permissions", {
      name: "collections.update",
      category: "collections",
      description: "Update collections",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Manager",
      description: "Test role",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: createPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: updatePermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "CS-0001",
      title: "Penny Black",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      collectionType: "coins_stamps",
    });

    return { collectionId, organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  const detailsId = await asUser.mutation(api.coinsStampsDetails.upsert, {
    collectionId,
    itemCategory: "stamp",
    issuingAuthority: "United Kingdom",
    countryOrRegion: "Great Britain",
    denomination: "1d",
    issueYear: 1840,
    catalogNumber: "SG 2",
    grade: "Fine used",
    estimatedValue: 250,
  });

  const details = await asUser.query(api.coinsStampsDetails.get, {
    collectionId,
  });
  expect(details?._id).toEqual(detailsId);
  expect(details?.catalogNumber).toBe("SG 2");

  const withDetails = await asUser.query(api.collections.getWithModuleDetails, {
    collectionId,
  });
  const moduleDetails = withDetails?.moduleDetails;
  expect(moduleDetails?.type).toBe("coins_stamps");
  if (!moduleDetails || moduleDetails.type !== "coins_stamps") {
    throw new Error("Expected coins and stamps module details");
  }
  expect(moduleDetails.data.catalogNumber).toBe("SG 2");
});

test("collections.getWithModuleDetails allows collections.read", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId, collectionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test User" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org-read-view-alias",
      type: "museum",
    });

    const readPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
      description: "Read collections",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      description: "Read-only role",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "R-0001",
      title: "Read Alias Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { organizationId, userId, collectionId };
  });

  const asUser = t.withIdentity({ subject: userId });
  const result = await asUser.query(api.collections.getWithModuleDetails, {
    collectionId,
  });

  expect(result?.collection._id).toEqual(collectionId);
  expect(result?.collection.organizationId).toEqual(organizationId);
});

test("collections.get requires collections.read permission", async () => {
  const t = convexTest(schema, modules);

  const { collectionId, userWithoutPermissionId } = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { name: "Owner User" });
    const userWithoutPermissionId = await ctx.db.insert("users", {
      name: "No Permission User",
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org-no-read",
      type: "museum",
    });

    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "NoReadRole",
      description: "Role without collection read",
      isSystemRole: false,
    });

    await ctx.db.insert("userOrganizations", {
      userId: userWithoutPermissionId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "NR-0001",
      title: "No Read Object",
      status: "active",
      catalogedBy: ownerId,
      catalogedAt: Date.now(),
    });

    return { collectionId, userWithoutPermissionId };
  });

  const asUnauthorizedUser = t.withIdentity({
    subject: userWithoutPermissionId,
  });
  await expect(
    asUnauthorizedUser.query(api.collections.get, { collectionId }),
  ).rejects.toThrow("Permission denied: collections.read");
});
