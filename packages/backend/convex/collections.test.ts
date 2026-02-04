import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "../tests/testSetup";

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
  expect(onlyDeaccessioned.page.map((c) => c.status)).toEqual(["deaccessioned"]);
});
