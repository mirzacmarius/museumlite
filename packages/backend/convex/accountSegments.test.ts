import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("accountSegments: create and list", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const readPermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
  });

  const writePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.write",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: writePermissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const segmentId = await t.mutation(api.accountSegments.create, {
    organizationId: orgId,
    name: "Active Institutions",
    description: "All active institution accounts",
    filters: [
      {
        field: "accountType",
        operator: "eq",
        value: "institution",
      },
      {
        field: "status",
        operator: "eq",
        value: "active",
      },
    ],
  });

  expect(segmentId).toBeDefined();

  const segments = await t.query(api.accountSegments.list, {
    organizationId: orgId,
  });

  expect(segments).toHaveLength(1);
  expect(segments[0].name).toBe("Active Institutions");
  expect(segments[0].filters).toHaveLength(2);
});

test("accountSegments: apply filters", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const readPermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Active Institution",
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00002",
      accountType: "institution",
      businessName: "Inactive Institution",
      status: "inactive",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00003",
      accountType: "patron",
      firstName: "John",
      lastName: "Doe",
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const segmentId = await t.run(async (ctx) => {
    return await ctx.db.insert("accountSegments", {
      organizationId: orgId,
      name: "Active Institutions",
      filters: [
        {
          field: "accountType",
          operator: "eq",
          value: "institution",
        },
        {
          field: "status",
          operator: "eq",
          value: "active",
        },
      ],
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const results = await t.query(api.accountSegments.apply, {
    segmentId,
  });

  expect(results).toHaveLength(1);
  expect(results[0].businessName).toBe("Active Institution");
});

test("accountSegments: update and remove", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const writePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.write",
      category: "accounts",
    });
  });

  const managePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.manage",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: writePermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: managePermissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const segmentId = await t.run(async (ctx) => {
    return await ctx.db.insert("accountSegments", {
      organizationId: orgId,
      name: "Test Segment",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "active",
        },
      ],
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  await t.mutation(api.accountSegments.update, {
    segmentId,
    name: "Updated Segment",
    description: "Updated description",
  });

  const updated = await t.run(async (ctx) => {
    return await ctx.db.get(segmentId);
  });

  expect(updated?.name).toBe("Updated Segment");
  expect(updated?.description).toBe("Updated description");

  await t.mutation(api.accountSegments.remove, {
    segmentId,
  });

  const removed = await t.run(async (ctx) => {
    return await ctx.db.get(segmentId);
  });

  expect(removed).toBeNull();
});

test("accountSegments: filter operators", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const readPermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      tags: ["vip", "partner"],
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const segmentId = await t.run(async (ctx) => {
    return await ctx.db.insert("accountSegments", {
      organizationId: orgId,
      name: "VIP Accounts",
      filters: [
        {
          field: "tags",
          operator: "contains",
          value: "vip",
        },
      ],
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const results = await t.query(api.accountSegments.apply, {
    segmentId,
  });

  expect(results).toHaveLength(1);
  expect(results[0].businessName).toBe("Test Institution");
});
