import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

// The code and its pending password must change in the same transaction.
export const createCode = internalMutation({
  args: {
    accountId: v.id("authAccounts"),
    provider: v.string(),
    email: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    passwordHash: v.optional(v.string()),
    isReserved: v.boolean(),
    preservePassword: v.boolean(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { passwordHash, isReserved, preservePassword, ...args },
  ) => {
    const previous = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", args.accountId))
      .unique();
    await ctx.runMutation(internal.auth.store, {
      args: {
        type: "createVerificationCode",
        ...args,
        allowExtraProviders: true,
        codeRequestReserved: isReserved,
      },
    });
    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", args.accountId))
      .unique();
    if (!code) throw new Error("Verification code was not created");
    await ctx.db.patch(code._id, {
      pendingPasswordHash:
        passwordHash ??
        (preservePassword ? previous?.pendingPasswordHash : undefined),
    });
    return null;
  },
});
