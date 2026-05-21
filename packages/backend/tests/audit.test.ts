import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

describe("auditLog", () => {
  describe("list", () => {
    test("should list audit log entries for organization", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId, roleId } = await t.run(async (ctx) => {
        // Create organization
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);

        // Create user
        // Create role with permissions
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        // Add user to organization
        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        // Add permission to role

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId, roleId };
      });

      // Create audit log entries
      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "update",
          entityType: "collection",
          entityId: "col_456",
          timestamp: Date.now() + 1000,
        });
      });

      // List audit logs
      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.entries[0]?.action).toBe("update");
      expect(result.entries[1]?.action).toBe("create");
    });

    test("should filter by entity type", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "loan",
          entityId: "loan_456",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        entityType: "accession",
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.entityType).toBe("accession");
    });

    test("should filter by user", async () => {
      const t = convexTest(schema, modules);

      const { orgId, user1Id, user2Id } = await t.run(async (ctx) => {
        const [orgId, user1Id, user2Id] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "User 1",
            email: "user1@example.com",
          }),
          ctx.db.insert("users", {
            name: "User 2",
            email: "user2@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId: user1Id,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, user1Id, user2Id };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId: user1Id,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId: user2Id,
          action: "create",
          entityType: "accession",
          entityId: "acc_456",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, user1Id);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        userId: user1Id,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.userId).toBe(user1Id);
    });

    test("should filter by date range", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;
      const tomorrow = now + 24 * 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_old",
          timestamp: yesterday,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_new",
          timestamp: now,
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: yesterday + 1000,
        toDate: tomorrow,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.entityId).toBe("acc_new");
    });

    test("should paginate results", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      // Create multiple entries
      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "create",
              entityType: "accession",
              entityId: `acc_${i}`,
              timestamp: Date.now() + i,
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      const firstPage = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        limit: 2,
      });

      expect(firstPage.entries).toHaveLength(2);
      expect(firstPage.nextCursor).toBeDefined();

      const secondPage = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        limit: 2,
        cursor: firstPage.nextCursor,
      });

      expect(secondPage.entries).toHaveLength(2);
      expect(secondPage.entries[0]?._id).not.toBe(firstPage.entries[0]?._id);
    });

    test("should enrich with user details", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "John Doe",
            email: "john@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries[0]?.userName).toBe("John Doe");
      expect(result.entries[0]?.userEmail).toBe("john@example.com");
    });
  });

  describe("getEntityTypes", () => {
    test("should return available entity types", async () => {
      const t = convexTest(schema, modules);

      const types = await t.query(api.auditLog.getEntityTypes, {});

      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain("collection");
      expect(types).toContain("accession");
      expect(types).toContain("loan");
    });
  });

  describe("getAvailableActions", () => {
    test("should return unique actions from audit log", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "update",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "collection",
          entityId: "col_456",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const actions = await authed.query(api.auditLog.getAvailableActions, {
        organizationId: orgId,
      });

      expect(actions).toHaveLength(2);
      expect(actions).toContain("create");
      expect(actions).toContain("update");
    });
  });

  describe("getActiveUsers", () => {
    test("should return users with audit log entries", async () => {
      const t = convexTest(schema, modules);

      const { orgId, user1Id, user2Id } = await t.run(async (ctx) => {
        const [orgId, user1Id, user2Id] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "User 1",
            email: "user1@example.com",
          }),
          ctx.db.insert("users", {
            name: "User 2",
            email: "user2@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId: user1Id,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, user1Id, user2Id };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId: user1Id,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId: user2Id,
          action: "create",
          entityType: "collection",
          entityId: "col_456",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, user1Id);
      const users = await authed.query(api.auditLog.getActiveUsers, {
        organizationId: orgId,
      });

      expect(users).toHaveLength(2);
      const userIds = users.map((u) => u._id);
      expect(userIds).toContain(user1Id);
      expect(userIds).toContain(user2Id);
    });
  });

  describe("getByEntity", () => {
    test("should return audit logs for specific entity", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "update",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now() + 1000,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_456",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const logs = await authed.query(api.auditLog.getByEntity, {
        organizationId: orgId,
        entityType: "accession",
        entityId: "acc_123",
      });

      expect(logs).toHaveLength(2);
      expect(logs[0]?.action).toBe("update");
      expect(logs[1]?.action).toBe("create");
    });

    test("should limit results", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "update",
              entityType: "accession",
              entityId: "acc_123",
              timestamp: Date.now() + i,
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      const logs = await authed.query(api.auditLog.getByEntity, {
        organizationId: orgId,
        entityType: "accession",
        entityId: "acc_123",
        limit: 2,
      });

      expect(logs).toHaveLength(2);
    });
  });

  describe("getRecent", () => {
    test("should return recent audit logs", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 3 }, (_, i) =>
            ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "create",
              entityType: "accession",
              entityId: `acc_${i}`,
              timestamp: Date.now() + i,
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      const logs = await authed.query(api.auditLog.getRecent, {
        organizationId: orgId,
      });

      expect(logs).toHaveLength(3);
      expect(logs[0]?.timestamp).toBeGreaterThanOrEqual(logs[1]?.timestamp!);
    });

    test("should respect limit parameter", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "create",
              entityType: "accession",
              entityId: `acc_${i}`,
              timestamp: Date.now() + i,
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      const logs = await authed.query(api.auditLog.getRecent, {
        organizationId: orgId,
        limit: 5,
      });

      expect(logs).toHaveLength(5);
    });
  });
});

describe("audit (notifications & activity)", () => {
  describe("listOrganizationActivity", () => {
    test("should list organization activity", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "organization.view_analytics",
          category: "organization",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.audit.listOrganizationActivity, {
        organizationId: orgId,
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0]?.action).toBe("create");
      expect(result.isDone).toBe(true);
    });

    test("should filter by entity type", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "organization.view_analytics",
          category: "organization",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_123",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "loan",
          entityId: "loan_456",
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.audit.listOrganizationActivity, {
        organizationId: orgId,
        entityType: "accession",
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0]?.entityType).toBe("accession");
    });

    test("should filter by date range", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "organization.view_analytics",
          category: "organization",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        return { orgId, userId };
      });

      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_old",
          timestamp: yesterday,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_new",
          timestamp: now,
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.audit.listOrganizationActivity, {
        organizationId: orgId,
        startDate: yesterday + 1000,
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0]?.entityId).toBe("acc_new");
    });
  });

  describe("logAction", () => {
    test("should create audit log entry", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      const authed = authedForUser(t, userId);
      await authed.mutation(internal.audit.logAction, {
        organizationId: orgId,
        userId,
        action: "create",
        entityType: "accession",
        entityId: "acc_123",
      });

      const logs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .collect();
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.action).toBe("create");
      expect(logs[0]?.entityType).toBe("accession");
      expect(logs[0]?.entityId).toBe("acc_123");
    });

    test("should include changes when provided", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      const authed = authedForUser(t, userId);
      await authed.mutation(internal.audit.logAction, {
        organizationId: orgId,
        userId,
        action: "update",
        entityType: "accession",
        entityId: "acc_123",
        changes: {
          field: "status",
          oldValue: "pending",
          newValue: "approved",
        },
      });

      const logs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .collect();
      });

      expect(logs[0]?.changes).toBeDefined();
      expect(logs[0]?.changes?.field).toBe("status");
      expect(logs[0]?.changes?.oldValue).toBe("pending");
      expect(logs[0]?.changes?.newValue).toBe("approved");
    });
  });

  describe("createNotification", () => {
    test("should create notification for current user", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      const authed = authedForUser(t, userId);
      const notificationId = await authed.mutation(
        api.audit.createNotification,
        {
          organizationId: orgId,
          type: "info",
          title: "Test Notification",
          message: "This is a test notification",
        },
      );

      expect(notificationId).toBeDefined();

      const notification = await t.run(async (ctx) => {
        return await ctx.db.get(notificationId);
      });

      expect(notification?.userId).toBe(userId);
      expect(notification?.title).toBe("Test Notification");
      expect(notification?.read).toBe(false);
    });

    test("should include related entity info", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      const authed = authedForUser(t, userId);
      const notificationId = await authed.mutation(
        api.audit.createNotification,
        {
          organizationId: orgId,
          type: "info",
          title: "Accession Created",
          message: "A new accession was created",
          relatedEntityType: "accession",
          relatedEntityId: "acc_123",
        },
      );

      const notification = await t.run(async (ctx) => {
        return await ctx.db.get(notificationId);
      });

      expect(notification?.relatedEntityType).toBe("accession");
      expect(notification?.relatedEntityId).toBe("acc_123");
    });
  });

  describe("createNotificationInternal", () => {
    test("should create notification for any user", async () => {
      const t = convexTest(schema, modules);

      const { orgId, targetUserId } = await t.run(async (ctx) => {
        const [orgId, targetUserId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Target User",
            email: "target@example.com",
          }),
        ]);
        return { orgId, targetUserId };
      });

      const notificationId = await t.mutation(
        internal.audit.createNotificationInternal,
        {
          organizationId: orgId,
          userId: targetUserId,
          type: "alert",
          title: "Important Notice",
          message: "This is an important notification",
        },
      );

      const notification = await t.run(async (ctx) => {
        return await ctx.db.get(notificationId);
      });

      expect(notification?.userId).toBe(targetUserId);
      expect(notification?.title).toBe("Important Notice");
    });
  });

  describe("markRead", () => {
    test("should mark notification as read", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      const authed = authedForUser(t, userId);
      const notificationId = await authed.mutation(
        api.audit.createNotification,
        {
          organizationId: orgId,
          type: "info",
          title: "Test",
          message: "Test message",
        },
      );

      await authed.mutation(api.audit.markRead, {
        notificationId,
      });

      const notification = await t.run(async (ctx) => {
        return await ctx.db.get(notificationId);
      });

      expect(notification?.read).toBe(true);
    });

    test("should prevent unauthorized users from marking as read", async () => {
      const t = convexTest(schema, modules);

      const { orgId, user1Id, user2Id } = await t.run(async (ctx) => {
        const [orgId, user1Id, user2Id] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "User 1",
            email: "user1@example.com",
          }),
          ctx.db.insert("users", {
            name: "User 2",
            email: "user2@example.com",
          }),
        ]);
        return { orgId, user1Id, user2Id };
      });

      const authedUser1 = authedForUser(t, user1Id);
      const notificationId = await authedUser1.mutation(
        api.audit.createNotification,
        {
          organizationId: orgId,
          type: "info",
          title: "Test",
          message: "Test message",
        },
      );

      await expect(
        authedForUser(t, user2Id).mutation(api.audit.markRead, {
          notificationId,
        }),
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("markAllRead", () => {
    test("should mark all notifications as read", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      // Create multiple notifications
      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 3 }, (_, i) =>
            ctx.db.insert("notifications", {
              organizationId: orgId,
              userId,
              type: "info",
              title: `Notification ${i}`,
              message: `Message ${i}`,
              read: false,
              createdAt: Date.now(),
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      await authed.mutation(api.audit.markAllRead, {
        organizationId: orgId,
      });

      const notifications = await t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
      });

      expect(notifications.every((n) => n.read)).toBe(true);
    });
  });

  describe("listNotifications", () => {
    test("should list user notifications", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 3 }, (_, i) =>
            ctx.db.insert("notifications", {
              organizationId: orgId,
              userId,
              type: "info",
              title: `Notification ${i}`,
              message: `Message ${i}`,
              read: i === 0,
              createdAt: Date.now() + i,
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.audit.listNotifications, {
        organizationId: orgId,
      });

      expect(result.notifications).toHaveLength(3);
      expect(result.unreadCount).toBe(2);
    });

    test("should filter unread notifications", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          organizationId: orgId,
          userId,
          type: "info",
          title: "Read Notification",
          message: "This is read",
          read: true,
          createdAt: Date.now(),
        });

        await ctx.db.insert("notifications", {
          organizationId: orgId,
          userId,
          type: "info",
          title: "Unread Notification",
          message: "This is unread",
          read: false,
          createdAt: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.audit.listNotifications, {
        organizationId: orgId,
        unreadOnly: true,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.title).toBe("Unread Notification");
    });

    test("should respect limit parameter", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Test User",
            email: "test@example.com",
          }),
        ]);
        return { orgId, userId };
      });

      await t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            ctx.db.insert("notifications", {
              organizationId: orgId,
              userId,
              type: "info",
              title: `Notification ${i}`,
              message: `Message ${i}`,
              read: false,
              createdAt: Date.now() + i,
            }),
          ),
        );
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.audit.listNotifications, {
        organizationId: orgId,
        limit: 5,
      });

      expect(result.notifications).toHaveLength(5);
    });
  });
});
