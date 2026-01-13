import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserRole, requirePermission } from "./utils/permissions";

async function checkGroupAccessControl(
  ctx: MutationCtx,
  group: Doc<"collectionGroups">,
  userId: Id<"users">,
): Promise<void> {
  if (!group.managedByRoleId) {
    return;
  }

  const userRole = await getUserRole(ctx, group.organizationId);
  if (!userRole) {
    throw new Error("You do not have access to manage this collection group");
  }

  if (userRole.name === "admin" || userRole.isSystemRole) {
    const isAdmin = userRole.name === "admin";
    if (isAdmin) return;
  }

  if (userRole._id !== group.managedByRoleId) {
    throw new Error(
      "You do not have the required role to manage this collection group",
    );
  }
}

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    curatorId: v.optional(v.id("users")),
    imageId: v.optional(v.id("_storage")),
    managedByRoleId: v.optional(v.id("roles")),
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
      curatorId: args.curatorId,
      imageId: args.imageId,
      managedByRoleId: args.managedByRoleId,
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
      curatorId: v.optional(v.id("users")),
      curatorName: v.optional(v.string()),
      managedByRoleId: v.optional(v.id("roles")),
      managedByRoleName: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      itemsCount: v.optional(v.number()),
      createdAt: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    let groups: Doc<"collectionGroups">[];
    if (args.search) {
      groups = await ctx.db
        .query("collectionGroups")
        .withSearchIndex("search_index", (q) =>
          q
            .search("name", args.search!)
            .eq("organizationId", args.organizationId),
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

    return await Promise.all(
      groups.map(async (g) => {
        let curatorName: string | undefined;
        if (g.curatorId) {
          const curator = await ctx.db.get(g.curatorId);
          curatorName = curator?.name ?? curator?.email ?? undefined;
        }

        let managedByRoleName: string | undefined;
        if (g.managedByRoleId) {
          const role = await ctx.db.get(g.managedByRoleId);
          managedByRoleName = role?.name;
        }

        let imageUrl: string | undefined;
        if (g.imageId) {
          imageUrl = (await ctx.storage.getUrl(g.imageId)) ?? undefined;
        }

        return {
          _id: g._id,
          name: g.name,
          description: g.description,
          curatorId: g.curatorId,
          curatorName,
          managedByRoleId: g.managedByRoleId,
          managedByRoleName,
          imageUrl,
          itemsCount: g.itemsCount,
          createdAt: g.createdAt,
          _creationTime: g._creationTime,
        };
      }),
    );
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
      curatorId: v.optional(v.id("users")),
      curatorName: v.optional(v.string()),
      managedByRoleId: v.optional(v.id("roles")),
      managedByRoleName: v.optional(v.string()),
      imageId: v.optional(v.id("_storage")),
      imageUrl: v.optional(v.string()),
      itemsCount: v.optional(v.number()),
      createdAt: v.number(),
      createdBy: v.id("users"),
      lastModifiedAt: v.optional(v.number()),
      lastModifiedBy: v.optional(v.id("users")),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;

    let curatorName: string | undefined;
    if (group.curatorId) {
      const curator = await ctx.db.get(group.curatorId);
      curatorName = curator?.name ?? curator?.email ?? undefined;
    }

    let managedByRoleName: string | undefined;
    if (group.managedByRoleId) {
      const role = await ctx.db.get(group.managedByRoleId);
      managedByRoleName = role?.name;
    }

    let imageUrl: string | undefined;
    if (group.imageId) {
      imageUrl = (await ctx.storage.getUrl(group.imageId)) ?? undefined;
    }

    return {
      ...group,
      curatorName,
      managedByRoleName,
      imageUrl,
    };
  },
});

export const update = mutation({
  args: {
    groupId: v.id("collectionGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    curatorId: v.optional(v.union(v.id("users"), v.null())),
    imageId: v.optional(v.union(v.id("_storage"), v.null())),
    managedByRoleId: v.optional(v.union(v.id("roles"), v.null())),
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
    await checkGroupAccessControl(ctx, group, userId);

    const updates: {
      lastModifiedAt: number;
      lastModifiedBy: Id<"users">;
      name?: string;
      description?: string;
      curatorId?: Id<"users"> | undefined;
      imageId?: Id<"_storage"> | undefined;
      managedByRoleId?: Id<"roles"> | undefined;
    } = {
      lastModifiedAt: Date.now(),
      lastModifiedBy: userId,
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.curatorId !== undefined)
      updates.curatorId = args.curatorId ?? undefined;
    if (args.imageId !== undefined) updates.imageId = args.imageId ?? undefined;
    if (args.managedByRoleId !== undefined)
      updates.managedByRoleId = args.managedByRoleId ?? undefined;

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
    await checkGroupAccessControl(ctx, group, userId);

    // Remove all collection group items (many-to-many relationships)
    const groupItems = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collectionGroup", (q) =>
        q.eq("collectionGroupId", args.groupId),
      )
      .collect();

    for (const item of groupItems) {
      await ctx.db.delete(item._id);
    }

    // Also unset groupId on items using legacy one-to-many relationship
    const items = await ctx.db
      .query("collections")
      .withIndex("by_collectionGroup", (q) =>
        q.eq("collectionGroupId", args.groupId),
      )
      .collect();

    for (const item of items) {
      await ctx.db.patch(item._id, { collectionGroupId: undefined });
    }

    await ctx.db.delete(args.groupId);

    return null;
  },
});

export const addItems = mutation({
  args: {
    groupId: v.id("collectionGroups"),
    collectionIds: v.array(v.id("collections")),
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
    await checkGroupAccessControl(ctx, group, userId);

    let addedCount = 0;

    for (const collectionId of args.collectionIds) {
      // Check if collection exists and belongs to same organization
      const collection = await ctx.db.get(collectionId);
      if (!collection) {
        throw new Error(`Collection ${collectionId} not found`);
      }
      if (collection.organizationId !== group.organizationId) {
        throw new Error("Collection belongs to a different organization");
      }

      // Check if already in group
      const existing = await ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collectionGroup_and_collection", (q) =>
          q
            .eq("collectionGroupId", args.groupId)
            .eq("collectionId", collectionId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("collectionGroupItems", {
          collectionGroupId: args.groupId,
          collectionId,
          addedAt: Date.now(),
          addedBy: userId,
        });
        addedCount++;
      }
    }

    // Update items count
    if (addedCount > 0) {
      await ctx.db.patch(args.groupId, {
        itemsCount: (group.itemsCount || 0) + addedCount,
        lastModifiedAt: Date.now(),
        lastModifiedBy: userId,
      });
    }

    return null;
  },
});

export const removeItems = mutation({
  args: {
    groupId: v.id("collectionGroups"),
    collectionIds: v.array(v.id("collections")),
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
    await checkGroupAccessControl(ctx, group, userId);

    let removedCount = 0;

    for (const collectionId of args.collectionIds) {
      const item = await ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collectionGroup_and_collection", (q) =>
          q
            .eq("collectionGroupId", args.groupId)
            .eq("collectionId", collectionId),
        )
        .first();

      if (item) {
        await ctx.db.delete(item._id);
        removedCount++;
      }
    }

    // Update items count
    if (removedCount > 0) {
      await ctx.db.patch(args.groupId, {
        itemsCount: Math.max(0, (group.itemsCount || 0) - removedCount),
        lastModifiedAt: Date.now(),
        lastModifiedBy: userId,
      });
    }

    return null;
  },
});

/**
 * List items in a collection group (using many-to-many relationship)
 */
export const listItems = query({
  args: {
    groupId: v.id("collectionGroups"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collectionGroupItems"),
      collectionId: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      currentLocationId: v.optional(v.id("locations")),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
        v.literal("archived"),
        v.literal("deleted"),
      ),
      addedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return [];
    }

    await requirePermission(ctx, group.organizationId, "collections.read");

    const groupItems = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collectionGroup", (q) =>
        q.eq("collectionGroupId", args.groupId),
      )
      .collect();

    const items: Array<{
      _id: Id<"collectionGroupItems">;
      collectionId: Id<"collections">;
      accessionNumber: string;
      title: string;
      description?: string;
      currentLocationId?: Id<"locations">;
      status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
      addedAt: number;
    }> = [];

    for (const groupItem of groupItems) {
      const collection = await ctx.db.get(groupItem.collectionId);
      if (collection) {
        items.push({
          _id: groupItem._id,
          collectionId: collection._id,
          accessionNumber: collection.accessionNumber,
          title: collection.title,
          description: collection.description,
          currentLocationId: collection.currentLocationId,
          status: collection.status,
          addedAt: groupItem.addedAt,
        });
      }
    }

    // Sort by addedAt descending (newest first)
    items.sort((a, b) => b.addedAt - a.addedAt);

    return items;
  },
});

/**
 * Get all collection groups that an object belongs to
 */
export const getGroupsForCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collectionGroups"),
      name: v.string(),
      description: v.optional(v.string()),
      itemsCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const groupItems = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    const groups: Array<{
      _id: Id<"collectionGroups">;
      name: string;
      description?: string;
      itemsCount?: number;
    }> = [];

    for (const groupItem of groupItems) {
      const group = await ctx.db.get(groupItem.collectionGroupId);
      if (group) {
        groups.push({
          _id: group._id,
          name: group.name,
          description: group.description,
          itemsCount: group.itemsCount,
        });
      }
    }

    return groups;
  },
});

export const getStats = query({
  args: {
    groupId: v.id("collectionGroups"),
  },
  returns: v.union(
    v.object({
      total: v.number(),
      active: v.number(),
      loaned: v.number(),
      deaccessioned: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return null;
    }

    await requirePermission(ctx, group.organizationId, "collections.read");

    const groupItems = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collectionGroup", (q) =>
        q.eq("collectionGroupId", args.groupId),
      )
      .collect();

    let active = 0;
    let loaned = 0;
    let deaccessioned = 0;

    for (const groupItem of groupItems) {
      const collection = await ctx.db.get(groupItem.collectionId);
      if (collection) {
        switch (collection.status) {
          case "active":
            active++;
            break;
          case "loaned":
            loaned++;
            break;
          case "deaccessioned":
            deaccessioned++;
            break;
        }
      }
    }

    return {
      total: groupItems.length,
      active,
      loaned,
      deaccessioned,
    };
  },
});
