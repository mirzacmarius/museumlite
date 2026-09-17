import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  assertOptionUsageIndexReady,
  loadOptionUsage,
  optionUsageResultValidator,
  unusedOptionUsage,
} from "./utils/collectionOptionUsages";
import { requirePermission } from "./utils/permissions";

/**
 * List all custom type options for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("typeOptions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      usageCount: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    return await ctx.db
      .query("typeOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();
  },
});

/**
 * Create a new custom type option
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  returns: v.id("typeOptions"),
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

    // Check if type already exists (case-insensitive)
    const existing = await ctx.db
      .query("typeOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error("A type with this name already exists");
    }

    const typeId = await ctx.db.insert("typeOptions", {
      organizationId: args.organizationId,
      name: args.name,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_type_option",
      entityType: "typeOption",
      entityId: typeId,
      changes: { name: args.name },
    });

    return typeId;
  },
});

/**
 * Check if a type is being used in any collections
 * Optionally exclude a specific collection (e.g., when editing that collection)
 */
export const checkUsage = query({
  args: {
    typeId: v.id("typeOptions"),
    excludeCollectionId: v.optional(v.id("collections")),
  },
  returns: optionUsageResultValidator,
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const type = await ctx.db.get(args.typeId);
    if (!type) {
      return unusedOptionUsage();
    }

    try {
      await requirePermission(ctx, type.organizationId, "collections.read");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return unusedOptionUsage();
      }
      throw error;
    }

    await assertOptionUsageIndexReady(ctx, type.organizationId);

    return await loadOptionUsage(ctx, {
      organizationId: type.organizationId,
      kind: "type",
      value: type.name,
      excludeCollectionId: args.excludeCollectionId,
    });
  },
});

/**
 * Delete a custom type option
 */
export const remove = mutation({
  args: {
    typeId: v.id("typeOptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, type] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.typeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!type) {
      throw new Error("Type not found");
    }
    await Promise.all([
      requirePermission(
        ctx,
        type.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.delete(args.typeId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: type.organizationId,
        userId,
        action: "deleted_type_option",
        entityType: "typeOption",
        entityId: args.typeId,
        changes: { name: type.name },
      }),
    ] as const);

    return null;
  },
});
