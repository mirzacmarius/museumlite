import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Internal mutation to delete a user account and its associated auth data.
 * This is kept in a separate file to avoid Node.js runtime requirements
 * from the polar SDK used in users.ts.
 */
export const deleteUserAccount = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userOrganizations = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    await Promise.all(
      userOrganizations.map((userOrganization) =>
        ctx.db.delete(userOrganization._id),
      ),
    );

    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    await Promise.all(
      authSessions.map(async (authSession) => {
        const refreshTokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", authSession._id))
          .collect();

        await Promise.all(
          refreshTokens.map((refreshToken) => ctx.db.delete(refreshToken._id)),
        );

        await ctx.db.delete(authSession._id);
      }),
    );

    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
      .collect();

    await Promise.all(
      authAccounts.map(async (authAccount) => {
        const verificationCode = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
          .unique();

        if (verificationCode) {
          await ctx.db.delete(verificationCode._id);
        }

        await ctx.db.delete(authAccount._id);
      }),
    );

    await ctx.db.delete(args.userId);
    return null;
  },
});

export const relinkUserAuthRecords = internalMutation({
  args: {
    sourceUserId: v.id("users"),
    targetUserId: v.id("users"),
  },
  returns: v.object({
    authAccountsUpdated: v.number(),
    userOrganizationsUpdated: v.number(),
  }),
  handler: async (ctx, args) => {
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.sourceUserId))
      .collect();

    await Promise.all(
      authAccounts.map((authAccount) =>
        ctx.db.patch(authAccount._id, { userId: args.targetUserId }),
      ),
    );

    const userOrganizations = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", args.sourceUserId))
      .collect();

    await Promise.all(
      userOrganizations.map(async (userOrganization) => {
        const existingMembership = await ctx.db
          .query("userOrganizations")
          .withIndex("by_user_and_organization", (q) =>
            q
              .eq("userId", args.targetUserId)
              .eq("organizationId", userOrganization.organizationId),
          )
          .first();

        if (existingMembership) {
          await ctx.db.delete(userOrganization._id);
          return;
        }

        await ctx.db.patch(userOrganization._id, { userId: args.targetUserId });
      }),
    );

    return {
      authAccountsUpdated: authAccounts.length,
      userOrganizationsUpdated: userOrganizations.length,
    };
  },
});
