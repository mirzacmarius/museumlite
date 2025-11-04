import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
    return await ctx.db
      .query("materialOptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "organization.manage_settings");

    // Check if material already exists (case-insensitive)
    const existing = await ctx.db
      .query("materialOptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error("A material with this name already exists");
    }

    return await ctx.db.insert("materialOptions", {
      organizationId: args.organizationId,
      name: args.name,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    await requirePermission(ctx, material.organizationId, "organization.manage_settings");

    await ctx.db.delete(args.materialId);
    return null;
  },
});

/**
 * Increment usage counter for a material option
 */
export const incrementUsage = mutation({
  args: {
    materialId: v.id("materialOptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      return null;
    }

    await ctx.db.patch(args.materialId, {
      usageCount: (material.usageCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });

    return null;
  },
});
