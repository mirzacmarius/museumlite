import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

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
    const result = await authed.mutation(api.invitations.createInvitation, {
      organizationId: orgId,
      email: "newuser@test.com",
      roleId,
    });

    expect(result).toBeDefined();
    expect(result.invitationId).toBeDefined();
    expect(result.token).toBeDefined();

    // Verify invitation was created
    const invitation = await t.run(async (ctx) => {
      return await ctx.db.get(result.invitationId);
    });

    expect(invitation).toBeDefined();
    expect(invitation?.email).toBe("newuser@test.com");
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
