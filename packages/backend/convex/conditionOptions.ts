import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./utils/permissions";

/**
 * List all custom condition options for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conditionOptions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      usageCount: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conditionOptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
  },
});

/**
 * Create a new custom condition option
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
  },
  returns: v.id("conditionOptions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "organization.manage_settings");

    // Check if condition already exists (case-insensitive)
    const existing = await ctx.db
      .query("conditionOptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error("A condition with this name already exists");
    }

    return await ctx.db.insert("conditionOptions", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
  },
});

/**
 * Update a custom condition option
 */
export const update = mutation({
  args: {
    conditionId: v.id("conditionOptions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const condition = await ctx.db.get(args.conditionId);
    if (!condition) {
      throw new Error("Condition not found");
    }

    await requirePermission(ctx, condition.organizationId, "organization.manage_settings");

    // If changing name, check for duplicates
    if (args.name && args.name !== condition.name) {
      const existing = await ctx.db
        .query("conditionOptions")
        .withIndex("by_organization", (q) => q.eq("organizationId", condition.organizationId))
        .filter((q) => q.eq(q.field("name"), args.name))
        .first();

      if (existing) {
        throw new Error("A condition with this name already exists");
      }
    }

    const updates: {
      name?: string;
      description?: string;
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    await ctx.db.patch(args.conditionId, updates);
    return null;
  },
});

/**
 * Delete a custom condition option
 */
export const remove = mutation({
  args: {
    conditionId: v.id("conditionOptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const condition = await ctx.db.get(args.conditionId);
    if (!condition) {
      throw new Error("Condition not found");
    }

    await requirePermission(ctx, condition.organizationId, "organization.manage_settings");

    await ctx.db.delete(args.conditionId);
    return null;
  },
});

/**
 * Increment usage counter for a condition option
 */
export const incrementUsage = mutation({
  args: {
    conditionId: v.id("conditionOptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const condition = await ctx.db.get(args.conditionId);
    if (!condition) {
      return null;
    }

    await ctx.db.patch(args.conditionId, {
      usageCount: (condition.usageCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });

    return null;
  },
});
