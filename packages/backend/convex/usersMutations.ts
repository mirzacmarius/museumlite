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
    const [userOrganizations, authSessions, authAccounts] = await Promise.all([
      ctx.db
        .query("userOrganizations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    await Promise.all(
      userOrganizations.map((userOrganization) =>
        ctx.db.delete(userOrganization._id),
      ),
    );

    const sessionsWithRefreshTokens = await Promise.all(
      authSessions.map((authSession) =>
        ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", authSession._id))
          .collect()
          .then((refreshTokens) => ({
            authSessionId: authSession._id,
            refreshTokenIds: refreshTokens.map(
              (refreshToken) => refreshToken._id,
            ),
          })),
      ),
    );
    await Promise.all(
      sessionsWithRefreshTokens.flatMap(
        ({ authSessionId, refreshTokenIds }) => [
          ...refreshTokenIds.map((refreshTokenId) =>
            ctx.db.delete(refreshTokenId),
          ),
          ctx.db.delete(authSessionId),
        ],
      ),
    );

    const accountsWithVerificationCodes = await Promise.all(
      authAccounts.map((authAccount) =>
        ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
          .unique()
          .then((verificationCode) => ({
            authAccountId: authAccount._id,
            verificationCodeId: verificationCode?._id,
          })),
      ),
    );
    await Promise.all(
      accountsWithVerificationCodes.flatMap(
        ({ authAccountId, verificationCodeId }) => [
          verificationCodeId
            ? ctx.db.delete(verificationCodeId)
            : Promise.resolve(),
          ctx.db.delete(authAccountId),
        ],
      ),
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
    const [targetUser, authAccounts] = await Promise.all([
      ctx.db.get(args.targetUserId),
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", args.sourceUserId),
        )
        .collect(),
    ]);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

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
