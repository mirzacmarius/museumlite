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
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
      .collect();

    for (const authAccount of authAccounts) {
      await ctx.db.delete(authAccount._id);
    }

    await ctx.db.delete(args.userId);
    return null;
  },
});
