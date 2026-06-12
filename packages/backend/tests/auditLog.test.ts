import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

describe("auditLog detailed logging", () => {
  describe("mutation operation logging", () => {
    test("should log create operations with complete data", async () => {
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
          action: "created",
          entityType: "accession",
          entityId: "acc_001",
          timestamp: Date.now(),
          changes: {
            operation: "create",
            entityData: {
              accessionNumber: "2026.001",
              title: "Test Artwork",
            },
          },
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.action).toBe("created");
      expect(result.entries[0]?.changes?.operation).toBe("create");
      expect(result.entries[0]?.changes?.entityData?.accessionNumber).toBe(
        "2026.001",
      );
    });

    test("should log update operations with before/after values", async () => {
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
          action: "updated",
          entityType: "accession",
          entityId: "acc_001",
          timestamp: Date.now(),
          changes: {
            operation: "update",
            fields: [
              {
                field: "status",
                oldValue: "draft",
                newValue: "approved",
              },
              {
                field: "approvedBy",
                oldValue: null,
                newValue: "John Doe",
              },
            ],
          },
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.action).toBe("updated");
      expect(result.entries[0]?.changes?.fields).toHaveLength(2);
      expect(result.entries[0]?.changes?.fields[0]?.field).toBe("status");
      expect(result.entries[0]?.changes?.fields[0]?.oldValue).toBe("draft");
      expect(result.entries[0]?.changes?.fields[0]?.newValue).toBe("approved");
    });

    test("should log delete operations with reason", async () => {
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
          action: "deleted",
          entityType: "loan",
          entityId: "loan_999",
          timestamp: Date.now(),
          changes: {
            operation: "delete",
            reason: "Duplicate entry",
            deletedData: {
              loanNumber: "LOAN-999",
              borrower: "Test Institution",
            },
          },
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.action).toBe("deleted");
      expect(result.entries[0]?.changes?.reason).toBe("Duplicate entry");
      expect(result.entries[0]?.changes?.deletedData).toBeDefined();
    });

    test("should log all operations in sequence", async () => {
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

      const baseTime = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "created",
          entityType: "accession",
          entityId: "acc_seq",
          timestamp: baseTime,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "updated",
          entityType: "accession",
          entityId: "acc_seq",
          timestamp: baseTime + 1000,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "approved",
          entityType: "accession",
          entityId: "acc_seq",
          timestamp: baseTime + 2000,
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.getByEntity, {
        organizationId: orgId,
        entityType: "accession",
        entityId: "acc_seq",
      });

      expect(result).toHaveLength(3);
      expect(result[0]?.action).toBe("approved");
      expect(result[1]?.action).toBe("updated");
      expect(result[2]?.action).toBe("created");
    });
  });

  describe("request metadata capture", () => {
    test("should capture IP address and user agent", async () => {
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
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "login",
          entityType: "user",
          entityId: userId,
          timestamp: Date.now(),
          ipAddress: "192.168.1.100",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        });
      });

      const logs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .collect();
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.ipAddress).toBe("192.168.1.100");
      expect(logs[0]?.userAgent).toContain("Mozilla");
    });

    test("should handle missing metadata gracefully", async () => {
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
          action: "system_action",
          entityType: "organization",
          entityId: orgId,
          timestamp: Date.now(),
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.action).toBe("system_action");
    });

    test("should track metadata across different actions", async () => {
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
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "create",
          entityType: "accession",
          entityId: "acc_meta1",
          timestamp: Date.now(),
          ipAddress: "10.0.0.1",
          userAgent: "Chrome/121.0.0.0",
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "update",
          entityType: "accession",
          entityId: "acc_meta1",
          timestamp: Date.now() + 1000,
          ipAddress: "10.0.0.2",
          userAgent: "Firefox/122.0",
        });
      });

      const logs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .order("desc")
          .collect();
      });

      expect(logs).toHaveLength(2);
      expect(logs[0]?.ipAddress).toBe("10.0.0.2");
      expect(logs[1]?.ipAddress).toBe("10.0.0.1");
    });
  });

  describe("bulk operations", () => {
    test("should handle bulk create operations", async () => {
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
        const timestamp = Date.now();
        await Promise.all(
          Array.from({ length: 10 }, async (_, i) => {
            await ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "bulk_created",
              entityType: "media",
              entityId: `media_${i}`,
              timestamp: timestamp + i,
              changes: {
                bulkOperation: true,
                batchId: "batch_001",
                itemIndex: i,
              },
            });
          }),
        );
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        action: "bulk_created",
      });

      expect(result.entries).toHaveLength(10);
      expect(result.entries.every((e) => e.changes?.bulkOperation)).toBe(true);
      expect(
        result.entries.every((e) => e.changes?.batchId === "batch_001"),
      ).toBe(true);
    });

    test("should handle bulk update operations", async () => {
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
          action: "bulk_updated",
          entityType: "collection",
          entityId: "bulk_op_001",
          timestamp: Date.now(),
          changes: {
            bulkOperation: true,
            affectedCount: 25,
            updateType: "status_change",
            oldValue: "draft",
            newValue: "published",
          },
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.action).toBe("bulk_updated");
      expect(result.entries[0]?.changes?.affectedCount).toBe(25);
    });

    test("should track bulk delete operations", async () => {
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
          action: "bulk_deleted",
          entityType: "media",
          entityId: "bulk_delete_001",
          timestamp: Date.now(),
          changes: {
            bulkOperation: true,
            deletedCount: 15,
            criteria: "uploaded before 2020",
            deletedIds: ["media_1", "media_2", "media_3"],
          },
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.changes?.deletedCount).toBe(15);
      expect(result.entries[0]?.changes?.deletedIds).toHaveLength(3);
    });
  });

  describe("compliance reporting", () => {
    test("should support audit trail export", async () => {
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

      const startDate = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const endDate = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "compliance_check",
          entityType: "organization",
          entityId: orgId,
          timestamp: startDate + 1000,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "data_access",
          entityType: "accession",
          entityId: "acc_compliance",
          timestamp: startDate + 5000,
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: startDate,
        toDate: endDate,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.entries.every((e) => e.timestamp >= startDate)).toBe(true);
      expect(result.entries.every((e) => e.timestamp <= endDate)).toBe(true);
    });

    test("should support filtering by action type for compliance", async () => {
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
          action: "exported_data",
          entityType: "accession",
          entityId: "acc_export_1",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "exported_data",
          entityType: "loan",
          entityId: "loan_export_1",
          timestamp: Date.now() + 1000,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "viewed",
          entityType: "accession",
          entityId: "acc_view_1",
          timestamp: Date.now() + 2000,
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        action: "export",
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.action.includes("export"))).toBe(
        true,
      );
    });

    test("should track sensitive data access", async () => {
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
          action: "accessed_sensitive_data",
          entityType: "valuation",
          entityId: "val_001",
          timestamp: Date.now(),
          changes: {
            dataType: "financial",
            fieldAccessed: "insuranceValue",
            complianceTag: "PCI",
          },
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.changes?.dataType).toBe("financial");
      expect(result.entries[0]?.changes?.complianceTag).toBe("PCI");
    });

    test("should generate compliance reports for specific time periods", async () => {
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
      const quarterStart = now - 90 * 24 * 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "quarterly_review",
          entityType: "organization",
          entityId: orgId,
          timestamp: quarterStart + 1000,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "policy_update",
          entityType: "organization",
          entityId: orgId,
          timestamp: quarterStart + 30 * 24 * 60 * 60 * 1000,
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "access_review",
          entityType: "user",
          entityId: userId,
          timestamp: quarterStart + 60 * 24 * 60 * 60 * 1000,
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: quarterStart,
        toDate: now,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]?.action).toBe("access_review");
      expect(result.entries[2]?.action).toBe("quarterly_review");
    });
  });

  describe("auditLog.list pagination", () => {
    async function setupListTestOrg(t: ReturnType<typeof convexTest>) {
      return t.run(async (ctx) => {
        const [orgId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Pagination Org",
            slug: `pagination-org-${Math.random().toString(36).slice(2, 8)}`,
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Pagination User",
            email: `pagination-${Math.random().toString(36).slice(2, 8)}@test.dev`,
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
    }

    test("filters by date range and preserves return shape", async () => {
      const t = convexTest(schema, modules);
      const { orgId, userId } = await setupListTestOrg(t);

      const rangeStart = 1_700_000_000_000;
      const rangeEnd = 1_700_086_400_000;
      const beforeRange = rangeStart - 86_400_000;
      const afterRange = rangeEnd + 86_400_000;

      await t.run(async (ctx) => {
        for (const timestamp of [
          beforeRange,
          rangeStart + 1_000,
          rangeEnd - 1_000,
          afterRange,
        ]) {
          await ctx.db.insert("auditLog", {
            organizationId: orgId,
            userId,
            action: "range_test",
            entityType: "accession",
            entityId: `entry_${timestamp}`,
            timestamp,
          });
        }
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: rangeStart,
        toDate: rangeEnd,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.nextCursor).toBeUndefined();
      expect(
        result.entries.every(
          (e) => e.timestamp >= rangeStart && e.timestamp <= rangeEnd,
        ),
      ).toBe(true);
      expect(result.entries[0]).toMatchObject({
        _id: expect.any(String),
        action: "range_test",
        entityType: "accession",
        userId,
      });
    });

    test("paginates with cursor across entries in range", async () => {
      const t = convexTest(schema, modules);
      const { orgId, userId } = await setupListTestOrg(t);

      const rangeStart = 1_710_000_000_000;
      const rangeEnd = 1_710_172_800_000;
      const entryCount = 55;
      const pageSize = 20;

      await t.run(async (ctx) => {
        for (let i = 0; i < entryCount; i++) {
          await ctx.db.insert("auditLog", {
            organizationId: orgId,
            userId,
            action: "page_test",
            entityType: "loan",
            entityId: `page_${i}`,
            timestamp: rangeStart + i * 1_000,
          });
        }
        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId,
          action: "outside_range",
          entityType: "loan",
          entityId: "outside",
          timestamp: rangeEnd + 86_400_000,
        });
      });

      const authed = authedForUser(t, userId);
      const firstPage = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: rangeStart,
        toDate: rangeEnd,
        limit: pageSize,
      });

      expect(firstPage.entries).toHaveLength(pageSize);
      expect(firstPage.totalCount).toBe(entryCount);
      expect(firstPage.nextCursor).toBeDefined();

      const secondPage = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: rangeStart,
        toDate: rangeEnd,
        limit: pageSize,
        cursor: firstPage.nextCursor,
      });

      expect(secondPage.entries).toHaveLength(pageSize);
      expect(secondPage.totalCount).toBe(entryCount);
      expect(secondPage.nextCursor).toBeDefined();

      const thirdPage = await authed.query(api.auditLog.list, {
        organizationId: orgId,
        fromDate: rangeStart,
        toDate: rangeEnd,
        limit: pageSize,
        cursor: secondPage.nextCursor,
      });

      expect(thirdPage.entries).toHaveLength(entryCount - pageSize * 2);
      expect(thirdPage.totalCount).toBe(entryCount);
      expect(thirdPage.nextCursor).toBeUndefined();

      const firstPageIds = new Set(firstPage.entries.map((e) => e._id));
      const secondPageIds = new Set(secondPage.entries.map((e) => e._id));
      for (const id of secondPageIds) {
        expect(firstPageIds.has(id)).toBe(false);
      }
    });
  });

  describe("data integrity", () => {
    test("should maintain timestamp ordering", async () => {
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

      const timestamps = [1000, 2000, 3000, 4000, 5000].map(
        (offset) => Date.now() + offset,
      );

      await t.run(async (ctx) => {
        await Promise.all(
          Array.from(timestamps).map(async (timestamp) => {
            await ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "integrity_test",
              entityType: "test",
              entityId: `test_${timestamp}`,
              timestamp,
            });
          }),
        );
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(5);
      for (let i = 0; i < result.entries.length - 1; i++) {
        const current = result.entries[i];
        const next = result.entries[i + 1];
        expect(current).toBeDefined();
        expect(next).toBeDefined();
        expect(current.timestamp).toBeGreaterThanOrEqual(next.timestamp);
      }
    });

    test("should preserve all required fields", async () => {
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
          action: "complete_record",
          entityType: "accession",
          entityId: "acc_complete",
          timestamp: Date.now(),
          changes: {
            testField: "testValue",
          },
          ipAddress: "192.168.1.1",
          userAgent: "TestAgent/1.0",
        });
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(1);
      const entry = result.entries[0];
      expect(entry?._id).toBeDefined();
      expect(entry?.action).toBeDefined();
      expect(entry?.entityType).toBeDefined();
      expect(entry?.entityId).toBeDefined();
      expect(entry?.timestamp).toBeDefined();
      expect(entry?.userId).toBeDefined();
    });

    test("should handle concurrent inserts correctly", async () => {
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
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            ctx.db.insert("auditLog", {
              organizationId: orgId,
              userId,
              action: "concurrent",
              entityType: "test",
              entityId: `concurrent_${i}`,
              timestamp: Date.now() + i,
            }),
          );
        }
        await Promise.all(promises);
      });

      const authed = authedForUser(t, userId);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(5);
    });

    test("should maintain referential integrity with users", async () => {
      const t = convexTest(schema, modules);

      const { orgId, user1Id, user2Id } = await t.run(async (ctx) => {
        const [orgId, user1Id, user2Id] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "User One",
            email: "user1@example.com",
          }),
          ctx.db.insert("users", {
            name: "User Two",
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
          action: "action_by_user1",
          entityType: "test",
          entityId: "test_1",
          timestamp: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: orgId,
          userId: user2Id,
          action: "action_by_user2",
          entityType: "test",
          entityId: "test_2",
          timestamp: Date.now() + 1000,
        });
      });

      const authed = authedForUser(t, user1Id);
      const result = await authed.query(api.auditLog.list, {
        organizationId: orgId,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]?.userName).toBe("User Two");
      expect(result.entries[1]?.userName).toBe("User One");
    });
  });
});
