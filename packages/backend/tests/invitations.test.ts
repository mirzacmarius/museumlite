import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
} from "./testHarness";
import { modules } from "./testSetup";

describe("invitations", () => {
  test("should create an invitation", async () => {
    const t = convexTest(schema, modules);

    // Setup: Create organization and role
    const { orgId, roleId, userId } = await t.run(async (ctx) => {
      const [userId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const [roleId, permissionId] = await Promise.all([
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "member",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "users.invite",
          category: "users",
        }),
      ]);

      // Add user to org with admin permission
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });

      const adminPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: adminPermissionId,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });

      return { orgId, roleId, userId };
    });

    // Create authenticated context
    const authed = t.withIdentity({
      subject: `${userId}|session-1`,
      issuer: "https://example.test",
    });

    // Create invitation
    await authed.mutation(api.organizations.inviteUser, {
      organizationId: orgId,
      email: "newuser@test.com",
      roleId,
    });

    // Verify invitation was created
    const invitation = await t.run(async (ctx) => {
      return await ctx.db
        .query("organizationInvitations")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .unique();
    });

    expect(invitation?.email).toBe("newuser@test.com");
    expect(invitation?.roleId).toBe(roleId);
    expect(invitation?.token).toEqual(expect.any(String));
    expect(invitation?.status).toBe("pending");
  });

  test("should list pending invitations", async () => {
    const t = convexTest(schema, modules);

    // Setup
    const {
      orgId,
      roleId: _roleId,
      userId,
    } = await t.run(async (ctx) => {
      const [userId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const [roleId, viewPermissionId, invitePermissionId] = await Promise.all([
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "member",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "users.view",
          category: "users",
        }),
        ctx.db.insert("permissions", {
          name: "users.invite",
          category: "users",
        }),
      ]);
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: viewPermissionId,
      });

      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: invitePermissionId,
      });

      const adminPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: adminPermissionId,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });

      // Create an invitation
      await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "invited@test.com",
        roleId,
        token: "test-token-123",
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        invitedBy: userId,
        status: "pending",
        createdAt: Date.now(),
      });

      return { orgId, roleId, userId };
    });

    // Create authenticated context
    const authed = t.withIdentity({
      subject: `${userId}|session-1`,
      issuer: "https://example.test",
    });

    // List invitations
    const invitations = await authed.query(
      api.invitations.listPendingInvitations,
      {
        organizationId: orgId,
      },
    );

    expect(invitations).toHaveLength(1);
    expect(invitations[0].email).toBe("invited@test.com");
    expect(invitations[0].status).toBe("pending");
  });

  test("should get invitation by token", async () => {
    const t = convexTest(schema, modules);

    const token = await t.run(async (ctx) => {
      const [userId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const roleId = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "member",
        isSystemRole: true,
      });

      const token = "test-token-456";
      await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "invited@test.com",
        roleId,
        token,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        invitedBy: userId,
        status: "pending",
        createdAt: Date.now(),
      });

      return token;
    });

    const invitation = await t.query(api.invitations.getInvitationByToken, {
      token,
    });

    expect(invitation).not.toBeNull();
    expect(invitation?.email).toBe("invited@test.com");
    expect(invitation?.organizationName).toBe("Test Org");
  });

  test("should accept invitation", async () => {
    const t = convexTest(schema, modules);

    const { token, orgId, newUserId } = await t.run(async (ctx) => {
      const [adminId, newUserId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("users", {
          email: "newuser@test.com",
          name: "New User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const roleId = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "member",
        isSystemRole: true,
      });

      const token = "test-token-789";
      await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "newuser@test.com",
        roleId,
        token,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        invitedBy: adminId,
        status: "pending",
        createdAt: Date.now(),
      });

      return { token, orgId, newUserId };
    });

    // Authenticate as the invited user
    const authed = t.withIdentity({
      subject: `${newUserId}|session-1`,
      issuer: "https://example.test",
    });

    // Accept invitation
    const result = await authed.mutation(api.invitations.acceptInvitation, {
      token,
    });

    expect(result.success).toBe(true);
    if ("organizationId" in result) {
      expect(result.organizationId).toBe(orgId);
    }
  });

  test("should decline invitation", async () => {
    const t = convexTest(schema, modules);

    const token = await t.run(async (ctx) => {
      const [adminId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const roleId = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "member",
        isSystemRole: true,
      });

      const token = "test-token-decline";
      await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "decline@test.com",
        roleId,
        token,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        invitedBy: adminId,
        status: "pending",
        createdAt: Date.now(),
      });

      return token;
    });

    // Decline invitation
    const result = await t.mutation(api.invitations.declineInvitation, {
      token,
    });

    expect(result.success).toBe(true);
  });

  test("should not accept expired invitation", async () => {
    const t = convexTest(schema, modules);

    const { token, expiredUserId } = await t.run(async (ctx) => {
      const [adminId, expiredUserId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("users", {
          email: "expired@test.com",
          name: "Expired User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const roleId = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "member",
        isSystemRole: true,
      });

      const token = "test-token-expired";
      // Set expiration in the past
      await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "expired@test.com",
        roleId,
        token,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        invitedBy: adminId,
        status: "pending",
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });

      return { token, expiredUserId };
    });

    // Authenticate as the expired user
    const authed = t.withIdentity({
      subject: `${expiredUserId}|session-1`,
      issuer: "https://example.test",
    });

    // Try to accept expired invitation
    const result = await authed.mutation(api.invitations.acceptInvitation, {
      token,
    });

    expect(result.success).toBe(false);
    if ("error" in result) {
      expect(result.error).toBe("Invitation has expired");
    }
  });

  test("should cancel invitation", async () => {
    const t = convexTest(schema, modules);

    const { invitationId, userId } = await t.run(async (ctx) => {
      const [userId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const [roleId, permissionId] = await Promise.all([
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "member",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "users.invite",
          category: "users",
        }),
      ]);
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });

      const adminPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: adminPermissionId,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });

      const invitationId = await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "cancel@test.com",
        roleId,
        token: "test-token-cancel",
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        invitedBy: userId,
        status: "pending",
        createdAt: Date.now(),
      });

      return { invitationId, userId };
    });

    // Authenticate
    const authed = t.withIdentity({
      subject: `${userId}|session-1`,
      issuer: "https://example.test",
    });

    // Cancel invitation
    await authed.mutation(api.invitations.cancelInvitation, {
      invitationId,
    });

    // Verify invitation was deleted
    const invitation = await t.run(async (ctx) => {
      return await ctx.db.get(invitationId);
    });

    expect(invitation).toBeNull();
  });

  test("should resend invitation with new token", async () => {
    const t = convexTest(schema, modules);

    const { invitationId, oldToken, userId } = await t.run(async (ctx) => {
      const [userId, orgId] = await Promise.all([
        ctx.db.insert("users", {
          email: "admin@test.com",
          name: "Admin User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
      ]);
      const [roleId, permissionId] = await Promise.all([
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "member",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "users.invite",
          category: "users",
        }),
      ]);
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });

      const adminPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: adminPermissionId,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });

      const oldToken = "test-token-resend";
      const invitationId = await ctx.db.insert("organizationInvitations", {
        organizationId: orgId,
        email: "resend@test.com",
        roleId,
        token: oldToken,
        expiresAt: Date.now() + 1000, // Expires soon
        invitedBy: userId,
        status: "pending",
        createdAt: Date.now(),
      });

      return { invitationId, oldToken, userId };
    });

    // Authenticate
    const authed = t.withIdentity({
      subject: `${userId}|session-1`,
      issuer: "https://example.test",
    });

    // Resend invitation
    const result = await authed.mutation(api.invitations.resendInvitation, {
      invitationId,
    });

    expect(result.success).toBe(true);
    if ("token" in result) {
      expect(result.token).not.toBe(oldToken);
      expect(result.token).toBeDefined();
    }
  });
});

async function createOrganizationWithSuperAdmin(t: ConvexTest) {
  return await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "super-admin-org",
      type: "museum",
      subscriptionTier: "pro",
    });
    const [
      ownerId,
      administratorId,
      superAdminRoleId,
      adminRoleId,
      viewerRoleId,
    ] = await Promise.all([
      ctx.db.insert("users", { email: "owner@test.com", name: "Owner" }),
      ctx.db.insert("users", {
        email: "administrator@test.com",
        name: "Administrator",
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "super_admin",
        isSystemRole: true,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "admin",
        isSystemRole: true,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "viewer",
        isSystemRole: true,
      }),
    ]);
    for (const [name, category] of [
      ["organization.manage_settings", "organization"],
      ["users.invite", "users"],
    ] as const) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category,
      });
      for (const roleId of [superAdminRoleId, adminRoleId]) {
        await ctx.db.insert("rolePermissions", { roleId, permissionId });
      }
    }
    for (const [userId, roleId] of [
      [ownerId, superAdminRoleId],
      [administratorId, adminRoleId],
    ] as const) {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    }
    return {
      organizationId,
      ownerId,
      administratorId,
      superAdminRoleId,
      viewerRoleId,
    };
  });
}

/** Stores a pending invitation directly, as older invitation paths could. */
async function seedInvitation(
  t: ConvexTest,
  invitation: {
    organizationId: Id<"organizations">;
    roleId: Id<"roles">;
    invitedBy: Id<"users">;
  },
) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("organizationInvitations", {
      ...invitation,
      email: "invitee@test.com",
      token: "seeded-token",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: "pending",
      createdAt: Date.now(),
    });
    return await ctx.db.insert("users", {
      email: "invitee@test.com",
      name: "Invitee",
    });
  });
}

async function membershipOf(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  return await t.run((ctx) =>
    ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", organizationId),
      )
      .unique(),
  );
}

describe("super admin invitations", () => {
  test("only a super admin can invite someone as super admin", async () => {
    const t = createConvexTest();
    const org = await createOrganizationWithSuperAdmin(t);
    const administrator = authedForUser(t, org.administratorId);
    await expect(
      administrator.mutation(api.organizations.inviteUser, {
        organizationId: org.organizationId,
        email: "invitee@test.com",
        roleId: org.superAdminRoleId,
      }),
    ).rejects.toThrow(/Only a SuperAdmin/);
    await administrator.mutation(api.organizations.inviteUser, {
      organizationId: org.organizationId,
      email: "viewer@test.com",
      roleId: org.viewerRoleId,
    });
    await authedForUser(t, org.ownerId).mutation(api.organizations.inviteUser, {
      organizationId: org.organizationId,
      email: "invitee@test.com",
      roleId: org.superAdminRoleId,
    });

    const invitations = await t.run((ctx) =>
      ctx.db
        .query("organizationInvitations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", org.organizationId),
        )
        .collect(),
    );
    expect(
      invitations.map(({ email, roleId, invitedBy }) => ({
        email,
        roleId,
        invitedBy,
      })),
    ).toEqual([
      {
        email: "viewer@test.com",
        roleId: org.viewerRoleId,
        invitedBy: org.administratorId,
      },
      {
        email: "invitee@test.com",
        roleId: org.superAdminRoleId,
        invitedBy: org.ownerId,
      },
    ]);
  });

  test("a super admin's invitation makes the invitee a super admin", async () => {
    const t = createConvexTest();
    const org = await createOrganizationWithSuperAdmin(t);
    const inviteeId = await seedInvitation(t, {
      organizationId: org.organizationId,
      roleId: org.superAdminRoleId,
      invitedBy: org.ownerId,
    });

    const result = await authedForUser(t, inviteeId).mutation(
      api.invitations.acceptInvitation,
      { token: "seeded-token" },
    );

    expect(result).toEqual({
      success: true,
      organizationId: org.organizationId,
    });
    expect((await membershipOf(t, org.organizationId, inviteeId))?.roleId).toBe(
      org.superAdminRoleId,
    );
  });

  test("acceptance refuses a super admin invitation from someone who is not a super admin", async () => {
    const t = createConvexTest();
    const org = await createOrganizationWithSuperAdmin(t);
    const inviteeId = await seedInvitation(t, {
      organizationId: org.organizationId,
      roleId: org.superAdminRoleId,
      invitedBy: org.administratorId,
    });

    const result = await authedForUser(t, inviteeId).mutation(
      api.invitations.acceptInvitation,
      { token: "seeded-token" },
    );

    expect(result).toEqual({ success: false, error: "Invitation not found" });
    expect(await membershipOf(t, org.organizationId, inviteeId)).toBeNull();
  });

  test("acceptance refuses an invitation whose role belongs to another organization", async () => {
    const t = createConvexTest();
    const org = await createOrganizationWithSuperAdmin(t);
    const foreignRoleId = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org",
        type: "museum",
      });
      return await ctx.db.insert("roles", {
        organizationId,
        name: "Everything",
        isSystemRole: false,
      });
    });
    const inviteeId = await seedInvitation(t, {
      organizationId: org.organizationId,
      roleId: foreignRoleId,
      invitedBy: org.ownerId,
    });

    const result = await authedForUser(t, inviteeId).mutation(
      api.invitations.acceptInvitation,
      { token: "seeded-token" },
    );

    expect(result).toEqual({ success: false, error: "Invitation not found" });
    expect(await membershipOf(t, org.organizationId, inviteeId)).toBeNull();
  });

  test("invitations can no longer be created outside organizations.inviteUser", async () => {
    const t = createConvexTest();
    const org = await createOrganizationWithSuperAdmin(t);
    await expect(
      authedForUser(t, org.administratorId).mutation(
        anyApi.invitations?.createInvitation,
        {
          organizationId: org.organizationId,
          email: "invitee@test.com",
          roleId: org.superAdminRoleId,
        },
      ),
    ).rejects.toThrow();
  });
});
