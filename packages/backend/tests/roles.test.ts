import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("roles", () => {
  describe("createRole", () => {
    test("should create a custom role with permissions", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId, permissionIds } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        const permissionIds = [
          await ctx.db.insert("permissions", {
            name: "collections.read",
            category: "collections",
          }),
          await ctx.db.insert("permissions", {
            name: "collections.create",
            category: "collections",
          }),
        ];

        return { orgId, userId, permissionIds };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      const newRoleId = await authed.mutation(api.roles.createRole, {
        organizationId: orgId,
        name: "Curator",
        description: "Can manage collections",
        permissionIds,
      });

      expect(newRoleId).toBeDefined();

      const role = await t.run(async (ctx) => {
        return await ctx.db.get(newRoleId);
      });

      expect(role).toBeDefined();
      expect(role?.name).toBe("Curator");
      expect(role?.description).toBe("Can manage collections");
      expect(role?.isSystemRole).toBe(false);

      const rolePermissions = await t.run(async (ctx) => {
        return await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", newRoleId))
          .collect();
      });

      expect(rolePermissions).toHaveLength(2);
    });

    test("should reject duplicate role name", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId, permissionId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        // Create existing role with same name
        await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Curator",
          isSystemRole: false,
        });

        return { orgId, userId, permissionId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await expect(
        authed.mutation(api.roles.createRole, {
          organizationId: orgId,
          name: "Curator",
          permissionIds: [permissionId],
        }),
      ).rejects.toThrow("Role name already exists");
    });

    test("should require authentication", async () => {
      const t = convexTest(schema, modules);

      const { orgId, permissionId } = await t.run(async (ctx) => {
        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const permissionId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        return { orgId, permissionId };
      });

      await expect(
        t.mutation(api.roles.createRole, {
          organizationId: orgId,
          name: "Curator",
          permissionIds: [permissionId],
        }),
      ).rejects.toThrow("Not authenticated");
    });

    test("should require users.manage_roles permission", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId, permissionId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "user@test.com",
          name: "Regular User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Member",
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

        return { orgId, userId, permissionId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await expect(
        authed.mutation(api.roles.createRole, {
          organizationId: orgId,
          name: "Curator",
          permissionIds: [permissionId],
        }),
      ).rejects.toThrow("Permission denied: users.manage_roles");
    });
  });

  describe("updateRole", () => {
    test("should update role name and description", async () => {
      const t = convexTest(schema, modules);

      const { customRoleId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const adminRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: adminRoleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId: adminRoleId,
          joinedAt: Date.now(),
        });

        const customRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Curator",
          description: "Old description",
          isSystemRole: false,
        });

        return { customRoleId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await authed.mutation(api.roles.updateRole, {
        roleId: customRoleId,
        name: "Senior Curator",
        description: "Updated description",
      });

      const updatedRole = await t.run(async (ctx) => {
        return await ctx.db.get(customRoleId);
      });

      expect(updatedRole?.name).toBe("Senior Curator");
      expect(updatedRole?.description).toBe("Updated description");
    });

    test("should update role permissions", async () => {
      const t = convexTest(schema, modules);

      const { customRoleId, userId, newPermissionIds } = await t.run(
        async (ctx) => {
          const userId = await ctx.db.insert("users", {
            email: "admin@test.com",
            name: "Admin User",
          });

          const orgId = await ctx.db.insert("organizations", {
            name: "Test Org",
            slug: "test-org",
            type: "museum",
          });

          const adminRoleId = await ctx.db.insert("roles", {
            organizationId: orgId,
            name: "Admin",
            isSystemRole: true,
          });

          const manageRolesPermId = await ctx.db.insert("permissions", {
            name: "users.manage_roles",
            category: "users",
          });

          await ctx.db.insert("rolePermissions", {
            roleId: adminRoleId,
            permissionId: manageRolesPermId,
          });

          await ctx.db.insert("userOrganizations", {
            userId,
            organizationId: orgId,
            roleId: adminRoleId,
            joinedAt: Date.now(),
          });

          const customRoleId = await ctx.db.insert("roles", {
            organizationId: orgId,
            name: "Curator",
            isSystemRole: false,
          });

          const oldPermId = await ctx.db.insert("permissions", {
            name: "collections.read",
            category: "collections",
          });

          await ctx.db.insert("rolePermissions", {
            roleId: customRoleId,
            permissionId: oldPermId,
          });

          const newPermissionIds = [
            await ctx.db.insert("permissions", {
              name: "collections.create",
              category: "collections",
            }),
            await ctx.db.insert("permissions", {
              name: "collections.update",
              category: "collections",
            }),
          ];

          return { customRoleId, userId, newPermissionIds };
        },
      );

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await authed.mutation(api.roles.updateRole, {
        roleId: customRoleId,
        permissionIds: newPermissionIds,
      });

      const rolePermissions = await t.run(async (ctx) => {
        return await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", customRoleId))
          .collect();
      });

      expect(rolePermissions).toHaveLength(2);
      expect(rolePermissions.map((rp) => rp.permissionId).sort()).toEqual(
        newPermissionIds.sort(),
      );
    });

    test("should reject updating to duplicate name", async () => {
      const t = convexTest(schema, modules);

      const { customRoleId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const adminRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: adminRoleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId: adminRoleId,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Existing Role",
          isSystemRole: false,
        });

        const customRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Curator",
          isSystemRole: false,
        });

        return { customRoleId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await expect(
        authed.mutation(api.roles.updateRole, {
          roleId: customRoleId,
          name: "Existing Role",
        }),
      ).rejects.toThrow("Role name already exists");
    });

    test("should not allow modifying system roles", async () => {
      const t = convexTest(schema, modules);

      const { systemRoleId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const systemRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: systemRoleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId: systemRoleId,
          joinedAt: Date.now(),
        });

        return { systemRoleId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await expect(
        authed.mutation(api.roles.updateRole, {
          roleId: systemRoleId,
          name: "Modified Admin",
        }),
      ).rejects.toThrow("Cannot modify system roles");
    });
  });

  describe("deleteRole", () => {
    test("should delete a custom role", async () => {
      const t = convexTest(schema, modules);

      const { customRoleId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const adminRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: adminRoleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId: adminRoleId,
          joinedAt: Date.now(),
        });

        const customRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Temporary Role",
          isSystemRole: false,
        });

        const permId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: customRoleId,
          permissionId: permId,
        });

        return { customRoleId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await authed.mutation(api.roles.deleteRole, {
        roleId: customRoleId,
      });

      const deletedRole = await t.run(async (ctx) => {
        return await ctx.db.get(customRoleId);
      });

      expect(deletedRole).toBeNull();

      const rolePermissions = await t.run(async (ctx) => {
        return await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", customRoleId))
          .collect();
      });

      expect(rolePermissions).toHaveLength(0);
    });

    test("should not allow deleting system roles", async () => {
      const t = convexTest(schema, modules);

      const { systemRoleId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const systemRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: systemRoleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId: systemRoleId,
          joinedAt: Date.now(),
        });

        return { systemRoleId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await expect(
        authed.mutation(api.roles.deleteRole, {
          roleId: systemRoleId,
        }),
      ).rejects.toThrow("Cannot delete system roles");
    });

    test("should not allow deleting role assigned to users", async () => {
      const t = convexTest(schema, modules);

      const { customRoleId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        });

        const regularUserId = await ctx.db.insert("users", {
          email: "user@test.com",
          name: "Regular User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const adminRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });

        const manageRolesPermId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: adminRoleId,
          permissionId: manageRolesPermId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId: adminRoleId,
          joinedAt: Date.now(),
        });

        const customRoleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Custom Role",
          isSystemRole: false,
        });

        await ctx.db.insert("userOrganizations", {
          userId: regularUserId,
          organizationId: orgId,
          roleId: customRoleId,
          joinedAt: Date.now(),
        });

        return { customRoleId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      await expect(
        authed.mutation(api.roles.deleteRole, {
          roleId: customRoleId,
        }),
      ).rejects.toThrow("Cannot delete role that is assigned to users");
    });
  });

  describe("listRoles", () => {
    test("should list all roles for an organization", async () => {
      const t = convexTest(schema, modules);

      const { orgId, roleIds } = await t.run(async (ctx) => {
        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleIds = [
          await ctx.db.insert("roles", {
            organizationId: orgId,
            name: "Admin",
            isSystemRole: true,
          }),
          await ctx.db.insert("roles", {
            organizationId: orgId,
            name: "Curator",
            description: "Collection curator",
            isSystemRole: false,
          }),
          await ctx.db.insert("roles", {
            organizationId: orgId,
            name: "Viewer",
            isSystemRole: false,
          }),
        ];

        const permId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId: roleIds[1],
          permissionId: permId,
        });

        return { orgId, roleIds };
      });

      const roles = await t.query(api.roles.listRoles, {
        organizationId: orgId,
      });

      expect(roles).toHaveLength(3);
      expect(roles.map((r) => r.name).sort()).toEqual([
        "Admin",
        "Curator",
        "Viewer",
      ]);

      const curatorRole = roles.find((r) => r.name === "Curator");
      expect(curatorRole?.description).toBe("Collection curator");
      expect(curatorRole?.permissions).toHaveLength(1);
      expect(curatorRole?.permissions[0].name).toBe("collections.read");
    });

    test("should return empty array for organization with no roles", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Empty Org",
          slug: "empty-org",
          type: "museum",
        });
      });

      const roles = await t.query(api.roles.listRoles, {
        organizationId: orgId,
      });

      expect(roles).toHaveLength(0);
    });
  });

  describe("getRole", () => {
    test("should get a role with its permissions", async () => {
      const t = convexTest(schema, modules);

      const { roleId, permissionIds } = await t.run(async (ctx) => {
        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Curator",
          description: "Manages collections",
          isSystemRole: false,
        });

        const permissionIds = [
          await ctx.db.insert("permissions", {
            name: "collections.read",
            category: "collections",
          }),
          await ctx.db.insert("permissions", {
            name: "collections.create",
            category: "collections",
          }),
        ];

        for (const permId of permissionIds) {
          await ctx.db.insert("rolePermissions", {
            roleId,
            permissionId: permId,
          });
        }

        return { roleId, permissionIds };
      });

      const role = await t.query(api.roles.getRole, {
        roleId,
      });

      expect(role).not.toBeNull();
      expect(role?.name).toBe("Curator");
      expect(role?.description).toBe("Manages collections");
      expect(role?.isSystemRole).toBe(false);
      expect(role?.permissions).toHaveLength(2);
      expect(role?.permissions.map((p) => p.name).sort()).toEqual([
        "collections.create",
        "collections.read",
      ]);
    });

    test("should return null for non-existent role", async () => {
      const t = convexTest(schema, modules);

      const fakeRoleId = "jh71bn7mx8qpvnnh5zt0ewynnx6y4s8r" as Id<"roles">;

      const role = await t.query(api.roles.getRole, {
        roleId: fakeRoleId,
      });

      expect(role).toBeNull();
    });
  });

  describe("listPermissions", () => {
    test("should list all permissions", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });
        await ctx.db.insert("permissions", {
          name: "loans.create",
          category: "loans",
        });
        await ctx.db.insert("permissions", {
          name: "users.invite",
          category: "users",
        });
      });

      const permissions = await t.query(api.roles.listPermissions, {});

      expect(permissions.length).toBeGreaterThanOrEqual(3);
      expect(permissions.map((p) => p.name)).toContain("collections.read");
      expect(permissions.map((p) => p.name)).toContain("loans.create");
      expect(permissions.map((p) => p.name)).toContain("users.invite");
    });

    test("should filter permissions by category", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });
        await ctx.db.insert("permissions", {
          name: "collections.create",
          category: "collections",
        });
        await ctx.db.insert("permissions", {
          name: "loans.create",
          category: "loans",
        });
      });

      const permissions = await t.query(api.roles.listPermissions, {
        category: "collections",
      });

      expect(permissions.length).toBeGreaterThanOrEqual(2);
      expect(permissions.every((p) => p.category === "collections")).toBe(true);
    });
  });

  describe("checkPermission", () => {
    test("should return true when user has permission", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "user@test.com",
          name: "Test User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Curator",
          isSystemRole: false,
        });

        const permId = await ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId: permId,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        return { orgId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      const hasPermission = await authed.query(api.roles.checkPermission, {
        organizationId: orgId,
        permissionName: "collections.read",
      });

      expect(hasPermission).toBe(true);
    });

    test("should return false when user lacks permission", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "user@test.com",
          name: "Test User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Viewer",
          isSystemRole: false,
        });

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        return { orgId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      const hasPermission = await authed.query(api.roles.checkPermission, {
        organizationId: orgId,
        permissionName: "collections.delete",
      });

      expect(hasPermission).toBe(false);
    });

    test("should return false for unauthenticated user", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      });

      const hasPermission = await t.query(api.roles.checkPermission, {
        organizationId: orgId,
        permissionName: "collections.read",
      });

      expect(hasPermission).toBe(false);
    });
  });

  describe("getUserPermissions", () => {
    test("should return all permissions for user role", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "user@test.com",
          name: "Test User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        const roleId = await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Curator",
          isSystemRole: false,
        });

        const permIds = [
          await ctx.db.insert("permissions", {
            name: "collections.read",
            category: "collections",
          }),
          await ctx.db.insert("permissions", {
            name: "collections.create",
            category: "collections",
          }),
          await ctx.db.insert("permissions", {
            name: "collections.update",
            category: "collections",
          }),
        ];

        for (const permId of permIds) {
          await ctx.db.insert("rolePermissions", {
            roleId,
            permissionId: permId,
          });
        }

        await ctx.db.insert("userOrganizations", {
          userId,
          organizationId: orgId,
          roleId,
          joinedAt: Date.now(),
        });

        return { orgId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      const permissions = await authed.query(api.roles.getUserPermissions, {
        organizationId: orgId,
      });

      expect(permissions).toHaveLength(3);
      expect(permissions.sort()).toEqual([
        "collections.create",
        "collections.read",
        "collections.update",
      ]);
    });

    test("should return empty array for user not in organization", async () => {
      const t = convexTest(schema, modules);

      const { orgId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "user@test.com",
          name: "Test User",
        });

        const orgId = await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });

        return { orgId, userId };
      });

      const authed = t.withIdentity({
        subject: `${userId}|session-1`,
        issuer: "https://example.test",
      });

      const permissions = await authed.query(api.roles.getUserPermissions, {
        organizationId: orgId,
      });

      expect(permissions).toHaveLength(0);
    });

    test("should return empty array for unauthenticated user", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      });

      const permissions = await t.query(api.roles.getUserPermissions, {
        organizationId: orgId,
      });

      expect(permissions).toHaveLength(0);
    });
  });
});
