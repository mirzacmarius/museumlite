import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

/**
 * Generate a secure random token for invitation links
 */
function generateInvitationToken(): string {
  // Generate a cryptographically secure random token
  // Using base64url encoding for URL-safe tokens
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Check if an invitation has expired
 */
function isInvitationExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

function shouldScheduleInvitationEmail(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

/**
 * List pending invitations for an organization
 */
export const listPendingInvitations = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("organizationInvitations"),
      _creationTime: v.number(),
      email: v.string(),
      roleId: v.id("roles"),
      roleName: v.string(),
      expiresAt: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("expired"),
      ),
      invitedBy: v.id("users"),
      inviterName: v.optional(v.string()),
      createdAt: v.number(),
      isExpired: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission to view invitations (users.invite permission allows viewing pending invitations)
    await requirePermission(ctx, args.organizationId, "users.invite");

    // Get all pending invitations for the organization
    const invitations = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Enrich with role and inviter information
    const enrichedInvitations = await Promise.all(
      invitations.map(async (invitation) => {
        const [role, inviter] = await Promise.all([
          ctx.db.get(invitation.roleId),
          ctx.db.get(invitation.invitedBy),
        ] as const);
        return {
          _id: invitation._id,
          _creationTime: invitation._creationTime,
          email: invitation.email,
          roleId: invitation.roleId,
          roleName: role?.name ?? "Unknown",
          expiresAt: invitation.expiresAt,
          status: invitation.status,
          invitedBy: invitation.invitedBy,
          inviterName: inviter?.name,
          createdAt: invitation.createdAt,
          isExpired: isInvitationExpired(invitation.expiresAt),
        };
      }),
    );

    return enrichedInvitations;
  },
});

/**
 * Get invitation details by token (public, no auth required)
 */
export const getInvitationByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizationInvitations"),
      email: v.string(),
      organizationId: v.id("organizations"),
      organizationName: v.string(),
      roleId: v.id("roles"),
      roleName: v.string(),
      expiresAt: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("expired"),
      ),
      inviterName: v.optional(v.string()),
      isExpired: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return null;
    }

    const [organization, role, inviter] = await Promise.all([
      ctx.db.get(invitation.organizationId),
      ctx.db.get(invitation.roleId),
      ctx.db.get(invitation.invitedBy),
    ] as const);
    return {
      _id: invitation._id,
      email: invitation.email,
      organizationId: invitation.organizationId,
      organizationName: organization?.name ?? "Unknown Organization",
      roleId: invitation.roleId,
      roleName: role?.name ?? "Unknown",
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      inviterName: inviter?.name,
      isExpired: isInvitationExpired(invitation.expiresAt),
    };
  },
});

/**
 * Accept an invitation
 */
export const acceptInvitation = mutation({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
      organizationId: v.id("organizations"),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Find invitation by token
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return { success: false, error: "Invitation already accepted" };
    }

    // Check if declined
    if (invitation.status === "declined") {
      return { success: false, error: "Invitation was declined" };
    }

    // Check if expired
    if (isInvitationExpired(invitation.expiresAt)) {
      // Update status to expired
      await ctx.db.patch(invitation._id, { status: "expired" });
      return { success: false, error: "Invitation has expired" };
    }

    // Get user's email
    const user = await ctx.db.get(userId);
    if (!user?.email) {
      return { success: false, error: "User email not found" };
    }

    // Verify email matches invitation
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return {
        success: false,
        error: "This invitation is for a different email address",
      };
    }

    // Check if user is already in organization
    const existing = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", invitation.organizationId),
      )
      .first();

    if (existing) {
      // Update invitation status but don't fail
      await ctx.db.patch(invitation._id, {
        status: "accepted",
        acceptedAt: Date.now(),
      });
      return { success: false, error: "Already a member of this organization" };
    }
    await Promise.all([
      ctx.db.insert("userOrganizations", {
        userId,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId,
        invitedBy: invitation.invitedBy,
        joinedAt: Date.now(),
      }),
      ctx.db.patch(invitation._id, {
        status: "accepted",
        acceptedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: invitation.organizationId,
        userId,
        action: "accepted_invitation",
        entityType: "invitation",
        entityId: invitation._id,
        changes: {
          email: invitation.email,
          roleId: invitation.roleId,
        },
      }),
    ] as const);

    return { success: true, organizationId: invitation.organizationId };
  },
});

/**
 * Decline an invitation
 */
export const declineInvitation = mutation({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Get current user (optional - can decline without auth)
    const [userId, invitation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db
        .query("organizationInvitations")
        .withIndex("by_token", (q) => q.eq("token", args.token))
        .first(),
    ] as const);

    // Find invitation by token
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return { success: false, error: "Invitation already accepted" };
    }

    // Check if already declined
    if (invitation.status === "declined") {
      return { success: false, error: "Invitation already declined" };
    }

    // Check if expired
    if (isInvitationExpired(invitation.expiresAt)) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      return { success: false, error: "Invitation has expired" };
    }

    // Update invitation status
    await ctx.db.patch(invitation._id, {
      status: "declined",
    });

    // Log audit action only if authenticated
    if (userId) {
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: invitation.organizationId,
        userId,
        action: "declined_invitation",
        entityType: "invitation",
        entityId: invitation._id,
        changes: {
          email: invitation.email,
        },
      });
    }

    return { success: true };
  },
});

/**
 * Resend an invitation (generates new token and extends expiration)
 */
export const resendInvitation = mutation({
  args: {
    invitationId: v.id("organizationInvitations"),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
      token: v.string(),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.status !== "pending") {
      return {
        success: false,
        error: `Cannot resend ${invitation.status} invitation`,
      };
    }

    await requirePermission(ctx, invitation.organizationId, "users.invite");

    // Generate new token and extend expiration
    const newToken = generateInvitationToken();
    const newExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await Promise.all([
      ctx.db.patch(args.invitationId, {
        token: newToken,
        expiresAt: newExpiresAt,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: invitation.organizationId,
        userId,
        action: "resent_invitation",
        entityType: "invitation",
        entityId: invitation._id,
        changes: {
          email: invitation.email,
        },
      }),
    ] as const);

    const [organization, role, inviter] = await Promise.all([
      ctx.db.get(invitation.organizationId),
      ctx.db.get(invitation.roleId),
      ctx.db.get(invitation.invitedBy),
    ] as const);
    const inviterName = inviter?.name ?? inviter?.email ?? "A team member";

    if (shouldScheduleInvitationEmail()) {
      await ctx.scheduler.runAfter(
        0,
        internal.email.actions.sendInvitationEmailAction,
        {
          email: invitation.email,
          organizationName: organization?.name ?? "MuseumLite",
          inviterName,
          role: role?.name ?? "member",
          token: newToken,
        },
      );
    }

    return { success: true, token: newToken };
  },
});

/**
 * Cancel a pending invitation
 */
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("organizationInvitations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, invitation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.invitationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Cannot cancel ${invitation.status} invitation`);
    }

    await requirePermission(ctx, invitation.organizationId, "users.invite");

    await Promise.all([
      ctx.db.delete(args.invitationId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: invitation.organizationId,
        userId,
        action: "cancelled_invitation",
        entityType: "invitation",
        entityId: invitation._id,
        changes: {
          email: invitation.email,
        },
      }),
    ] as const);
  },
});

/**
 * Internal: Create an invitation (called from organizations.inviteUser)
 */
export const createInvitationInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
    invitedBy: v.id("users"),
  },
  returns: v.object({
    invitationId: v.id("organizationInvitations"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check if invitation already exists for this email
    const existingInvitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("email"), args.email.toLowerCase()),
          q.eq(q.field("status"), "pending"),
        ),
      )
      .first();

    if (existingInvitation) {
      // Return existing invitation if not expired
      if (!isInvitationExpired(existingInvitation.expiresAt)) {
        return {
          invitationId: existingInvitation._id,
          token: existingInvitation.token,
        };
      }
      // Mark expired invitation as expired
      await ctx.db.patch(existingInvitation._id, { status: "expired" });
    }

    // Generate secure token
    const token = generateInvitationToken();

    // Set expiration to 7 days from now
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Create invitation
    const invitationId = await ctx.db.insert("organizationInvitations", {
      organizationId: args.organizationId,
      email: args.email.toLowerCase(),
      roleId: args.roleId,
      token,
      expiresAt,
      invitedBy: args.invitedBy,
      status: "pending",
      createdAt: Date.now(),
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId: args.invitedBy,
      action: "created_invitation",
      entityType: "invitation",
      entityId: invitationId,
      changes: {
        email: args.email,
        roleId: args.roleId,
      },
    });

    return { invitationId, token };
  },
});

/**
 * Create an invitation (used by organizations.inviteUser)
 */
export const createInvitation = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
  },
  returns: v.object({
    invitationId: v.id("organizationInvitations"),
    token: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    invitationId: Id<"organizationInvitations">;
    token: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "users.invite");

    // Call internal mutation
    return await ctx.runMutation(
      internal.invitations.createInvitationInternal,
      {
        organizationId: args.organizationId,
        email: args.email,
        roleId: args.roleId,
        invitedBy: userId,
      },
    );
  },
});
