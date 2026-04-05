import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {
    key: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const preference = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_organization_key", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("key", args.key),
      )
      .unique();

    return preference?.value ?? null;
  },
});

export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_organization_key", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("key", args.key),
      )
      .unique();

    if (existing) {
      if (existing.value === args.value) {
        return null;
      }

      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        organizationId: args.organizationId,
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

export const remove = mutation({
  args: {
    key: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_organization_key", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("key", args.key),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});
