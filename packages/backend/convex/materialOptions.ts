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
 * List all custom material options for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("materialOptions"),
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
      .query("materialOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();
  },
});

/**
 * Create a new custom material option
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  returns: v.id("materialOptions"),
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

    // Check if material already exists (case-insensitive)
    const existing = await ctx.db
      .query("materialOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error("A material with this name already exists");
    }

    const materialId = await ctx.db.insert("materialOptions", {
      organizationId: args.organizationId,
      name: args.name,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_material_option",
      entityType: "materialOption",
      entityId: materialId,
      changes: { name: args.name },
    });

    return materialId;
  },
});

/**
 * Check if a material is being used in any collections
 * Optionally exclude a specific collection (e.g., when editing that collection)
 */
export const checkUsage = query({
  args: {
    materialId: v.id("materialOptions"),
    excludeCollectionId: v.optional(v.id("collections")),
  },
  returns: optionUsageResultValidator,
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material) {
      return unusedOptionUsage();
    }

    try {
      await requirePermission(ctx, material.organizationId, "collections.read");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return unusedOptionUsage();
      }
      throw error;
    }

    await assertOptionUsageIndexReady(ctx, material.organizationId);

    return await loadOptionUsage(ctx, {
      organizationId: material.organizationId,
      kind: "material",
      value: material.name,
      excludeCollectionId: args.excludeCollectionId,
    });
  },
});

/**
 * Delete a custom material option
 */
export const remove = mutation({
  args: {
    materialId: v.id("materialOptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, material] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.materialId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!material) {
      throw new Error("Material not found");
    }
    await Promise.all([
      requirePermission(
        ctx,
        material.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.delete(args.materialId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: material.organizationId,
        userId,
        action: "deleted_material_option",
        entityType: "materialOption",
        entityId: args.materialId,
        changes: { name: material.name },
      }),
    ] as const);

    return null;
  },
});
