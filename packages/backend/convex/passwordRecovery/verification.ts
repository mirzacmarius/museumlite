import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

// Runs inside a mutation so the quota charge and the code replacement commit together.
export const createCode = internalMutation({
  args: {
    accountId: v.id("authAccounts"),
    provider: v.string(),
    email: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    isReserved: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { isReserved, ...args }) => {
    await ctx.runMutation(internal.auth.store, {
      args: {
        type: "createVerificationCode",
        ...args,
        allowExtraProviders: true,
        codeRequestReserved: isReserved,
      },
    });
    return null;
  },
});

/**
 * A sign-up for an unverified account by someone who does not know its
 * password leaves two unproven claims on one email. Neither may survive
 * verification, so the mailbox owner sets a password through reset.
 */
export const releaseUnverifiedSecret = internalMutation({
  args: { accountId: v.id("authAccounts") },
  returns: v.null(),
  handler: async (ctx, { accountId }) => {
    const account = await ctx.db.get(accountId);
    if (account && !account.emailVerified && account.secret !== undefined) {
      await ctx.db.patch(accountId, { secret: undefined });
    }
    return null;
  },
});
