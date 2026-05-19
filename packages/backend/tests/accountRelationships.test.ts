import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("accountRelationships: create and list", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, readPermissionId, writePermissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.read",
        category: "accounts",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.write",
        category: "accounts",
      });
    }),
  ]);
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

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session-create-and-list`,
    issuer: "https://example.test",
  });

  const relationshipId = await authed.mutation(
    api.accountRelationships.create,
    {
      accountId,
      relatedEntityType: "loan",
      relatedEntityId: "LN-001",
      relationshipType: "lender",
      startDate: Date.now(),
      notes: "Test relationship",
    },
  );

  expect(relationshipId).toBeDefined();

  const relationships = await authed.query(api.accountRelationships.list, {
    accountId,
  });

  expect(relationships).toHaveLength(1);
  expect(relationships[0].relatedEntityType).toBe("loan");
  expect(relationships[0].relationshipType).toBe("lender");
});

test("accountRelationships: listByEntity", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, readPermissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.read",
        category: "accounts",
      });
    }),
  ]);
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

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("accountRelationships", {
      organizationId: orgId,
      accountId,
      relatedEntityType: "loan",
      relatedEntityId: "LN-001",
      relationshipType: "lender",
      startDate: Date.now(),
      createdAt: Date.now(),
    });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session-listByEntity`,
    issuer: "https://example.test",
  });

  const relationships = await authed.query(
    api.accountRelationships.listByEntity,
    {
      relatedEntityType: "loan",
      relatedEntityId: "LN-001",
    },
  );

  expect(relationships).toHaveLength(1);
  expect(relationships[0].accountId).toBe(accountId);
});

test("accountRelationships: timeline", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, readPermissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.read",
        category: "accounts",
      });
    }),
  ]);
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

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("accountRelationships", {
      organizationId: orgId,
      accountId,
      relatedEntityType: "loan",
      relatedEntityId: "LN-001",
      relationshipType: "lender",
      startDate: Date.now(),
      createdAt: Date.now(),
    });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session-timeline`,
    issuer: "https://example.test",
  });

  const timeline = await authed.query(api.accountRelationships.timeline, {
    accountId,
  });

  expect(timeline.events.length).toBeGreaterThan(0);
  expect(timeline.events[0].type).toBe("relationship");
});

test("accountRelationships: update and remove", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, writePermissionId, deletePermissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.write",
        category: "accounts",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.delete",
        category: "accounts",
      });
    }),
  ]);
  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: writePermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: deletePermissionId,
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

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const relationshipId = await t.run(async (ctx) => {
    return await ctx.db.insert("accountRelationships", {
      organizationId: orgId,
      accountId,
      relatedEntityType: "loan",
      relatedEntityId: "LN-001",
      relationshipType: "lender",
      startDate: Date.now(),
      createdAt: Date.now(),
    });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session-update-and-remove`,
    issuer: "https://example.test",
  });

  await authed.mutation(api.accountRelationships.update, {
    relationshipId,
    relationshipType: "borrower",
    notes: "Updated notes",
  });

  const updated = await t.run(async (ctx) => {
    return await ctx.db.get(relationshipId);
  });

  expect(updated?.relationshipType).toBe("borrower");
  expect(updated?.notes).toBe("Updated notes");

  await authed.mutation(api.accountRelationships.remove, {
    relationshipId,
  });

  const removed = await t.run(async (ctx) => {
    return await ctx.db.get(relationshipId);
  });

  expect(removed).toBeNull();
});
