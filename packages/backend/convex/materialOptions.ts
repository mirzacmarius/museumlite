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
 * Check if a material is being used in any collections
 * Optionally exclude a specific collection (e.g., when editing that collection)
 */
export const checkUsage = query({
  args: {
    materialId: v.id("materialOptions"),
    excludeCollectionId: v.optional(v.id("collections")),
  },
  returns: v.object({
    isUsed: v.boolean(),
    usageCount: v.number(),
    collectionNames: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      return { isUsed: false, usageCount: 0, collectionNames: [] };
    }

    // Check all collections in the organization for this material
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) => q.eq("organizationId", material.organizationId))
      .collect();

    // Filter collections that use this material (excluding the specified collection if provided)
    const collectionsUsingMaterial = collections.filter((collection) => {
      // Exclude the current collection being edited
      if (args.excludeCollectionId && collection._id === args.excludeCollectionId) {
        return false;
      }
      
      if (!collection.materials) return false;
      
      // Safely parse materials - handle both JSON arrays and plain strings
      let materials: string[];
      try {
        materials = JSON.parse(collection.materials) as string[];
      } catch {
        // If parsing fails, treat as a single material string
        materials = [collection.materials];
      }
      
      // Ensure materials is an array
      if (!Array.isArray(materials)) {
        materials = [materials];
      }
      
      return materials.includes(material.name);
    });

    return {
      isUsed: collectionsUsingMaterial.length > 0,
      usageCount: collectionsUsingMaterial.length,
      collectionNames: collectionsUsingMaterial.map((c) => c.accessionNumber),
    };
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
