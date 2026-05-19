import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
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
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
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

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    // Check if condition already exists (case-insensitive)
    const existing = await ctx.db
      .query("conditionOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error("A condition with this name already exists");
    }

    const conditionId = await ctx.db.insert("conditionOptions", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_condition_option",
      entityType: "conditionOption",
      entityId: conditionId,
      changes: { name: args.name },
    });

    return conditionId;
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

    await requirePermission(
      ctx,
      condition.organizationId,
      "organization.manage_settings",
    );

    // If changing name, check for duplicates
    if (args.name && args.name !== condition.name) {
      const existing = await ctx.db
        .query("conditionOptions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", condition.organizationId),
        )
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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: condition.organizationId,
      userId,
      action: "updated_condition_option",
      entityType: "conditionOption",
      entityId: args.conditionId,
      changes: updates,
    });

    return null;
  },
});

/**
 * Check if a condition is being used in any collections
 */
export const checkUsage = query({
  args: {
    conditionId: v.id("conditionOptions"),
  },
  returns: v.object({
    isUsed: v.boolean(),
    usageCount: v.number(),
    collectionNames: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const condition = await ctx.db.get(args.conditionId);
    if (!condition) {
      return { isUsed: false, usageCount: 0, collectionNames: [] };
    }

    // Check all collections in the organization for this condition
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", condition.organizationId),
      )
      .collect();

    // Filter collections that use this condition
    const collectionsUsingCondition = collections.filter((collection) => {
      if (!collection.condition) return false;
      return collection.condition === condition.name;
    });

    return {
      isUsed: collectionsUsingCondition.length > 0,
      usageCount: collectionsUsingCondition.length,
      collectionNames: collectionsUsingCondition.map((c) => c.accessionNumber),
    };
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
    await Promise.all([
      requirePermission(
        ctx,
        condition.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.delete(args.conditionId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: condition.organizationId,
        userId,
        action: "deleted_condition_option",
        entityType: "conditionOption",
        entityId: args.conditionId,
        changes: { name: condition.name },
      }),
    ] as const);

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
