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

test("collections.create allows module collection types when module is disabled", async () => {
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

  const collectionId = await asUser.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "W-0001",
    title: "Wine Object",
    collectionType: "wine",
  });

  const collection = await asUser.query(api.collections.get, { collectionId });
  expect(collection?._id).toEqual(collectionId);
  expect(collection?.collectionType).toBe("wine");

  const withDetails = await asUser.query(api.collections.getWithModuleDetails, {
    collectionId,
  });
  expect(withDetails?.moduleDetails).toBeNull();
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

  const asUnauthorizedUser = t.withIdentity({ subject: userWithoutPermissionId });
  await expect(
    asUnauthorizedUser.query(api.collections.get, { collectionId }),
  ).rejects.toThrow("Permission denied: collections.read");
});
