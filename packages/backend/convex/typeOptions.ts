import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";
import { storedStringListIncludes } from "./utils/stringListField";

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
      if (
        args.excludeCollectionId &&
        collection._id === args.excludeCollectionId
      ) {
        return false;
      }

      return storedStringListIncludes(collection.objectType, type.name);
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
