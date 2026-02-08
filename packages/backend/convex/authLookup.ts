import { v } from "convex/values";
import { query } from "./_generated/server";

export const hasPasswordAccountForEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.object({
    hasPasswordAccount: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();

    const passwordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q
          .eq("provider", "password-with-reset")
          .eq("providerAccountId", normalizedEmail),
      )
      .unique();

    return {
      hasPasswordAccount: passwordAccount !== null,
    };
  },
});
