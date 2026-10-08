import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import {
  assertOptionUsageIndexReady,
  loadOptionUsage,
  optionUsageResultValidator,
  unusedOptionUsage,
} from "./utils/collectionOptionUsages";
import { mutation } from "./utils/mutationBuilders";
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
    await requirePermission(ctx, args.organizationId, "collections.read");

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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
    const [userId, condition] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.conditionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    await Promise.all([
      ctx.db.patch(args.conditionId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: condition.organizationId,
        userId,
        action: "updated_condition_option",
        entityType: "conditionOption",
        entityId: args.conditionId,
        changes: updates,
      }),
    ]);

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
  returns: optionUsageResultValidator,
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const condition = await ctx.db.get(args.conditionId);
    if (!condition) {
      return unusedOptionUsage();
    }

    try {
      await requirePermission(
        ctx,
        condition.organizationId,
        "collections.read",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return unusedOptionUsage();
      }
      throw error;
    }

    await assertOptionUsageIndexReady(ctx, condition.organizationId);

    return await loadOptionUsage(ctx, {
      organizationId: condition.organizationId,
      kind: "condition",
      value: condition.name,
    });
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
    const [userId, condition] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.conditionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
