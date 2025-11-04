import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

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

    return await ctx.db.insert("typeOptions", {
      organizationId: args.organizationId,
      name: args.name,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
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
  returns: v.object({
    isUsed: v.boolean(),
    usageCount: v.number(),
    collectionNames: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const type = await ctx.db.get(args.typeId);
    if (!type) {
      return { isUsed: false, usageCount: 0, collectionNames: [] };
    }

    // Check all collections in the organization for this type
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", type.organizationId),
      )
      .collect();

    // Filter collections that use this type (excluding the specified collection if provided)
    const collectionsUsingType = collections.filter((collection) => {
      // Exclude the current collection being edited
      if (
        args.excludeCollectionId &&
        collection._id === args.excludeCollectionId
      ) {
        return false;
      }

      if (!collection.objectType) return false;

      // Safely parse objectType - handle both JSON arrays and plain strings
      let types: string[];
      try {
        types = JSON.parse(collection.objectType) as string[];
      } catch {
        // If parsing fails, treat as a single type string
        types = [collection.objectType];
      }

      // Ensure types is an array
      if (!Array.isArray(types)) {
        types = [types];
      }

      return types.includes(type.name);
    });

    return {
      isUsed: collectionsUsingType.length > 0,
      usageCount: collectionsUsingType.length,
      collectionNames: collectionsUsingType.map((c) => c.accessionNumber),
    };
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const type = await ctx.db.get(args.typeId);
    if (!type) {
      throw new Error("Type not found");
    }

    await requirePermission(
      ctx,
      type.organizationId,
      "organization.manage_settings",
    );

    await ctx.db.delete(args.typeId);
    return null;
  },
});

/**
 * Increment usage counter for a type option
 */
export const incrementUsage = mutation({
  args: {
    typeId: v.id("typeOptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const type = await ctx.db.get(args.typeId);
    if (!type) {
      return null;
    }

    await ctx.db.patch(args.typeId, {
      usageCount: (type.usageCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });

    return null;
  },
});
