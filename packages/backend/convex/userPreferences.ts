import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx, query } from "./_generated/server";
import { mutation } from "./utils/mutationBuilders";

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

export const emailLocaleValidator = v.union(
  v.literal("en"),
  v.literal("fr"),
  v.literal("es"),
  v.literal("no"),
  v.literal("ro"),
);

function parseEmailLocale(value: string | undefined) {
  switch (value) {
    case "fr":
    case "es":
    case "no":
    case "ro":
    case "en":
      return value;
    default:
      return "en" as const;
  }
}

export const getEmailLocaleByEmail = internalQuery({
  args: { email: v.string() },
  returns: emailLocaleValidator,
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .take(2);
    if (users.length !== 1) return "en" as const;
    const user = users[0];
    if (!user) return "en" as const;

    const preference = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_organization_key", (q) =>
        q
          .eq("userId", user._id)
          .eq("organizationId", undefined)
          .eq("key", "language"),
      )
      .unique();
    return parseEmailLocale(preference?.value);
  },
});

/** The language a user chose for the app, which their emails follow. */
export async function emailLocaleOf(ctx: QueryCtx, userId: Id<"users">) {
  const preference = await ctx.db
    .query("userPreferences")
    .withIndex("by_user_organization_key", (q) =>
      q.eq("userId", userId).eq("organizationId", undefined).eq("key", "language"),
    )
    .unique();
  return parseEmailLocale(preference?.value);
}

export const getEmailLocaleByUserId = internalQuery({
  args: { userId: v.id("users") },
  returns: emailLocaleValidator,
  handler: async (ctx, args) => await emailLocaleOf(ctx, args.userId),
});
