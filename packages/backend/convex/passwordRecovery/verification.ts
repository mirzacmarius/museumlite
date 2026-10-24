import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../utils/mutationBuilders";
import { releaseUnprovenSecret } from "./unprovenSecrets";

// Runs inside a mutation so the quota charge, the code replacement and the
// release of an unproven linked password commit together.
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
    const account = await ctx.db.get(args.accountId);
    if (account) await releaseUnprovenSecret(ctx, account);
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
