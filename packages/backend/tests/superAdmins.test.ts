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

async function createMultiSuperAdminOrganization(
  t: ReturnType<typeof convexTest>,
) {
  const ownerUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "SuperAdmin Owner",
      email: `sa-owner-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
  const secondSuperAdminUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "SuperAdmin Two",
      email: `sa-two-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "SuperAdmin Test Org",
      slug: `sa-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "library",
      subscriptionTier: "pro",
      ownerUserId,
      isActive: true,
    });
  });

  const superAdminRoleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "super_admin",
      isSystemRole: true,
    });
  });

  const { manageSettingsPermissionId, manageRolesPermissionId } = await t.run(
    async (ctx) => {
      const manageSettingsPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      const manageRolesPermissionId = await ctx.db.insert("permissions", {
        name: "users.manage_roles",
        category: "users",
      });
      return { manageSettingsPermissionId, manageRolesPermissionId };
    },
  );

  await t.run(async (ctx) => {
    for (const permissionId of [
      manageSettingsPermissionId,
      manageRolesPermissionId,
    ]) {
      await ctx.db.insert("rolePermissions", {
        roleId: superAdminRoleId,
        permissionId,
      });
    }
    await ctx.db.insert("userOrganizations", {
      userId: ownerUserId,
      organizationId,
      roleId: superAdminRoleId,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("userOrganizations", {
      userId: secondSuperAdminUserId,
      organizationId,
      roleId: superAdminRoleId,
      joinedAt: Date.now(),
    });
  });

  return {
    organizationId,
    ownerUserId,
    secondSuperAdminUserId,
    superAdminRoleId,
  };
}

describe("superAdmin roles", () => {
  test("cannot demote the last SuperAdmin", async () => {
    const t = convexTest(schema, modules);
    const ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Only SuperAdmin",
        email: `only-sa-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Single SuperAdmin Org",
        slug: `single-sa-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        subscriptionTier: "pro",
        ownerUserId,
        isActive: true,
      });
    });
    const superAdminRoleId = await t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: "super_admin",
        isSystemRole: true,
      });
    });
    const { manageSettingsPermissionId, manageRolesPermissionId } = await t.run(
      async (ctx) => {
        const manageSettingsPermissionId = await ctx.db.insert("permissions", {
          name: "organization.manage_settings",
          category: "organization",
        });
        const manageRolesPermissionId = await ctx.db.insert("permissions", {
          name: "users.manage_roles",
          category: "users",
        });
        return { manageSettingsPermissionId, manageRolesPermissionId };
      },
    );
    await t.run(async (ctx) => {
      for (const permissionId of [
        manageSettingsPermissionId,
        manageRolesPermissionId,
      ]) {
        await ctx.db.insert("rolePermissions", {
          roleId: superAdminRoleId,
          permissionId,
        });
      }
      await ctx.db.insert("userOrganizations", {
        userId: ownerUserId,
        organizationId,
        roleId: superAdminRoleId,
        joinedAt: Date.now(),
      });
    });

    const adminRoleId = await t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: "admin",
        isSystemRole: true,
      });
    });

    const authed = authedForUser(t, ownerUserId);

    await expect(
      authed.mutation(api.organizations.updateUserRole, {
        organizationId,
        userId: ownerUserId,
        roleId: adminRoleId,
      }),
    ).rejects.toThrow(/Cannot remove the last SuperAdmin/);

    const membership = await t.run(async (ctx) =>
      ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", ownerUserId).eq("organizationId", organizationId),
        )
        .first(),
    );
    expect(membership?.roleId).toBe(superAdminRoleId);
  });

  test("multi-SuperAdmin deletion requires unanimous approval", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId, secondSuperAdminUserId } =
      await createMultiSuperAdminOrganization(t);
    const ownerAuthed = authedForUser(t, ownerUserId);
    const secondAuthed = authedForUser(t, secondSuperAdminUserId);

    const pendingSummary = await ownerAuthed.mutation(
      api.organizationDeletion.requestDeletion,
      { organizationId },
    );
    expect(pendingSummary.status).toBe("pending_super_admin_approval");

    const organizationAfterRequest = await t.run(async (ctx) =>
      ctx.db.get(organizationId),
    );
    expect(organizationAfterRequest?.isActive).toBe(true);

    const completedSummary = await secondAuthed.mutation(
      api.organizationDeletion.approveDeletion,
      { organizationId },
    );
    expect(completedSummary.status).toBe("grace_period");

    const organizationAfterApproval = await t.run(async (ctx) =>
      ctx.db.get(organizationId),
    );
    expect(organizationAfterApproval?.isActive).toBe(false);
  });

  test("owner on admin role still counts toward multi-SuperAdmin deletion approval", async () => {
    const t = convexTest(schema, modules);
    const ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Owner On Admin",
        email: `owner-admin-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const secondSuperAdminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Assigned SuperAdmin",
        email: `assigned-sa-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Pre-Migration SuperAdmin Org",
        slug: `pre-migration-${Math.random().toString(36).slice(2, 8)}`,
        type: "library",
        subscriptionTier: "pro",
        ownerUserId,
        isActive: true,
      });
    });

    const { superAdminRoleId, adminRoleId } = await t.run(async (ctx) => {
      const superAdminRoleId = await ctx.db.insert("roles", {
        organizationId,
        name: "super_admin",
        isSystemRole: true,
      });
      const adminRoleId = await ctx.db.insert("roles", {
        organizationId,
        name: "admin",
        isSystemRole: true,
      });
      const manageSettingsPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      for (const roleId of [superAdminRoleId, adminRoleId]) {
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId: manageSettingsPermissionId,
        });
      }
      return { superAdminRoleId, adminRoleId };
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: ownerUserId,
        organizationId,
        roleId: adminRoleId,
        joinedAt: Date.now(),
      });
      await ctx.db.insert("userOrganizations", {
        userId: secondSuperAdminUserId,
        organizationId,
        roleId: superAdminRoleId,
        joinedAt: Date.now(),
      });
    });

    const secondAuthed = authedForUser(t, secondSuperAdminUserId);

    const pendingSummary = await secondAuthed.mutation(
      api.organizationDeletion.requestDeletion,
      { organizationId },
    );
    expect(pendingSummary.status).toBe("pending_super_admin_approval");

    const organizationAfterRequest = await t.run(async (ctx) =>
      ctx.db.get(organizationId),
    );
    expect(organizationAfterRequest?.isActive).toBe(true);
  });

  test("creator receives super_admin role when creating organization", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Org Creator",
        email: `creator-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const authed = authedForUser(t, userId);

    const organizationId = await authed.mutation(api.organizations.create, {
      name: "New SuperAdmin Org",
      slug: `new-sa-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const membership = await t.run(async (ctx) =>
      ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", organizationId),
        )
        .first(),
    );
    const superAdminRole = await t.run(async (ctx) =>
      ctx.db
        .query("roles")
        .withIndex("by_organization_and_name", (q) =>
          q.eq("organizationId", organizationId).eq("name", "super_admin"),
        )
        .first(),
    );

    expect(superAdminRole).not.toBeNull();
    expect(membership?.roleId).toBe(superAdminRole?._id);
  });
});
