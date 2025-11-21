import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("collectionGroups"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const groupId = await ctx.db.insert("collectionGroups", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      createdAt: Date.now(),
      createdBy: userId,
      itemsCount: 0,
    });

    return groupId;
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("collectionGroups"),
      name: v.string(),
      description: v.optional(v.string()),
      itemsCount: v.optional(v.number()),
      createdAt: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    let groups;
    if (args.search) {
      groups = await ctx.db
        .query("collectionGroups")
        .withSearchIndex("search_index", (q) => 
          q.search("name", args.search!)
           .eq("organizationId", args.organizationId)
        )
        .collect();
    } else {
      groups = await ctx.db
        .query("collectionGroups")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .collect();
    }

    return groups.map((g) => ({
      _id: g._id,
      name: g.name,
      description: g.description,
      itemsCount: g.itemsCount,
      createdAt: g.createdAt,
      _creationTime: g._creationTime,
    }));
  },
});

export const get = query({
  args: {
    groupId: v.id("collectionGroups"),
  },
  returns: v.union(
    v.object({
      _id: v.id("collectionGroups"),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      itemsCount: v.optional(v.number()),
      createdAt: v.number(),
      createdBy: v.id("users"),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    return group;
  },
});

export const update = mutation({
  args: {
    groupId: v.id("collectionGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    await requirePermission(ctx, group.organizationId, "collections.update");

    const updates: any = {
      lastModifiedAt: Date.now(),
      lastModifiedBy: userId,
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.groupId, updates);

    return null;
  },
});

export const deleteGroup = mutation({
  args: {
    groupId: v.id("collectionGroups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    await requirePermission(ctx, group.organizationId, "collections.delete");

    // Check if there are items in the group
    // For now, we might allow deletion and just unset the groupId on items, or block it.
    // Let's unset groupId on items.
    const items = await ctx.db
      .query("collections")
      .withIndex("by_collectionGroup", (q) => q.eq("collectionGroupId", args.groupId))
      .collect();

    for (const item of items) {
      await ctx.db.patch(item._id, { collectionGroupId: undefined });
    }

    await ctx.db.delete(args.groupId);

    return null;
  },
});
