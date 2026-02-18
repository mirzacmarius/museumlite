import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import schema from "./schema";

test("collections.list includeDeaccessioned behavior", async () => {
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
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "D-0001",
      title: "Deaccessioned item",
      status: "deaccessioned",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  const defaultList = await asUser.query(api.collections.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(defaultList.page.map((c) => c.status)).toEqual(["active"]);

  const includeAll = await asUser.query(api.collections.list, {
    organizationId,
    includeDeaccessioned: true,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(new Set(includeAll.page.map((c) => c.status))).toEqual(
    new Set(["active", "deaccessioned"]),
  );

  const onlyDeaccessioned = await asUser.query(api.collections.list, {
    organizationId,
    status: "deaccessioned",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(onlyDeaccessioned.page.map((c) => c.status)).toEqual([
    "deaccessioned",
  ]);
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
    const viewPermissionId = await ctx.db.insert("permissions", {
      name: "collections.view",
      category: "collections",
      description: "View collection details",
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
      permissionId: viewPermissionId,
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
