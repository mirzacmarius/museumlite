import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserRole, requirePermission } from "./utils/permissions";

async function checkGroupAccessControl(
  ctx: MutationCtx,
  group: Doc<"collectionGroups">,
  _userId: Id<"users">,
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

/**
 * Get thumbnail URL for a collection group with fallback to item images
 * Priority: group.imageId → primary item image → any item thumbnail → null
 */
async function getCollectionGroupThumbnailUrl(
  ctx: QueryCtx,
  group: Doc<"collectionGroups">,
): Promise<string | null> {
  // 1. If group has its own image, use it
  if (group.imageId) {
    return await ctx.storage.getUrl(group.imageId);
  }

  // 2. Find items in this group via collectionGroupItems (many-to-many)
  const groupItems = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collectionGroup", (q) =>
      q.eq("collectionGroupId", group._id),
    )
    .take(20); // Limit to avoid scanning too many

  if (groupItems.length === 0) {
    return null;
  }

  const primaryUrls = await Promise.all(
    groupItems.map(async (groupItem) => {
      const primaryMedia = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", groupItem.collectionId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("isPrimary"), true),
            q.eq(q.field("fileType"), "image"),
          ),
        )
        .first();

      if (!primaryMedia) {
        return null;
      }

      if (primaryMedia.thumbnailStorageId) {
        return ctx.storage.getUrl(primaryMedia.thumbnailStorageId);
      }
      return ctx.storage.getUrl(primaryMedia.storageId);
    }),
  );

  const primaryMatch = primaryUrls.find((url) => url !== null);
  if (primaryMatch) {
    return primaryMatch;
  }

  const anyUrls = await Promise.all(
    groupItems.map(async (groupItem) => {
      const anyMedia = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", groupItem.collectionId),
        )
        .filter((q) => q.eq(q.field("fileType"), "image"))
        .first();

      if (!anyMedia) {
        return null;
      }

      if (anyMedia.thumbnailStorageId) {
        return ctx.storage.getUrl(anyMedia.thumbnailStorageId);
      }
      return ctx.storage.getUrl(anyMedia.storageId);
    }),
  );

  const anyMatch = anyUrls.find((url) => url !== null);
  if (anyMatch) {
    return anyMatch;
  }

  return null;
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.create"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_collection_group",
      entityType: "collectionGroup",
      entityId: groupId,
      changes: {
        name: args.name,
        description: args.description,
        curatorId: args.curatorId,
        managedByRoleId: args.managedByRoleId,
      },
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

        // Use fallback helper: group.imageId → item primary → any item image → null
        const imageUrl =
          (await getCollectionGroupThumbnailUrl(ctx, g)) ?? undefined;

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
      valuation: v.optional(v.number()),
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

    // Use fallback helper: group.imageId → item primary → any item image → null
    const imageUrl =
      (await getCollectionGroupThumbnailUrl(ctx, group)) ?? undefined;

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
    const [userId, group] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.groupId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    await Promise.all([
      ctx.db.patch(args.groupId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: group.organizationId,
        userId,
        action: "updated_collection_group",
        entityType: "collectionGroup",
        entityId: args.groupId,
        changes: {
          name: args.name,
          description: args.description,
          curatorId: args.curatorId,
          managedByRoleId: args.managedByRoleId,
        },
      }),
    ]);

    return null;
  },
});

export const deleteGroup = mutation({
  args: {
    groupId: v.id("collectionGroups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, group] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.groupId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!group) {
      throw new Error("Group not found");
    }
    const [, groupItems] = await Promise.all([
      Promise.all([
        requirePermission(ctx, group.organizationId, "collections.delete"),
        checkGroupAccessControl(ctx, group, userId),
      ]),
      ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collectionGroup", (q) =>
          q.eq("collectionGroupId", args.groupId),
        )
        .collect(),
    ] as const);

    const [, items] = await Promise.all([
      Promise.all(
        Array.from(groupItems).map((item) => ctx.db.delete(item._id)),
      ),
      ctx.db
        .query("collections")
        .withIndex("by_collectionGroup", (q) =>
          q.eq("collectionGroupId", args.groupId),
        )
        .collect(),
    ] as const);
    await Promise.all([
      Promise.all(
        Array.from(items).map(async (item) => {
          await ctx.db.patch(item._id, { collectionGroupId: undefined });
        }),
      ),
      ctx.db.delete(args.groupId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: group.organizationId,
        userId,
        action: "deleted_collection_group",
        entityType: "collectionGroup",
        entityId: args.groupId,
        changes: {
          name: group.name,
          itemsRemoved: groupItems.length,
          collectionsUnlinked: items.length,
        },
      }),
    ] as const);

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
    const [userId, group] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.groupId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!group) {
      throw new Error("Group not found");
    }

    await requirePermission(ctx, group.organizationId, "collections.update");
    await checkGroupAccessControl(ctx, group, userId);

    let addedCount = 0;

    await Promise.all(
      Array.from(args.collectionIds).map(async (collectionId) => {
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
      }),
    );

    // Update items count
    if (addedCount > 0) {
      await ctx.db.patch(args.groupId, {
        itemsCount: (group.itemsCount || 0) + addedCount,
        lastModifiedAt: Date.now(),
        lastModifiedBy: userId,
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: group.organizationId,
        userId,
        action: "added_items_to_collection_group",
        entityType: "collectionGroup",
        entityId: args.groupId,
        changes: {
          collectionIds: args.collectionIds,
          addedCount,
        },
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
    const [userId, group] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.groupId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!group) {
      throw new Error("Group not found");
    }

    await requirePermission(ctx, group.organizationId, "collections.update");
    await checkGroupAccessControl(ctx, group, userId);

    let removedCount = 0;

    await Promise.all(
      Array.from(args.collectionIds).map(async (collectionId) => {
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
      }),
    );

    // Update items count
    if (removedCount > 0) {
      await Promise.all([
        ctx.db.patch(args.groupId, {
          itemsCount: Math.max(0, (group.itemsCount || 0) - removedCount),
          lastModifiedAt: Date.now(),
          lastModifiedBy: userId,
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: group.organizationId,
          userId,
          action: "removed_items_from_collection_group",
          entityType: "collectionGroup",
          entityId: args.groupId,
          changes: {
            collectionIds: args.collectionIds,
            removedCount,
          },
        }),
      ]);
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

    const [, groupItems] = await Promise.all([
      requirePermission(ctx, group.organizationId, "collections.read"),
      ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collectionGroup", (q) =>
          q.eq("collectionGroupId", args.groupId),
        )
        .collect(),
    ] as const);

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

    await Promise.all(
      Array.from(groupItems).map(async (groupItem) => {
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
      }),
    );

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

    const [, groupItems] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "collections.read"),
      ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect(),
    ] as const);

    const groups: Array<{
      _id: Id<"collectionGroups">;
      name: string;
      description?: string;
      itemsCount?: number;
    }> = [];
    const groupIds = new Set<Id<"collectionGroups">>();

    await Promise.all(
      Array.from(groupItems).map(async (groupItem) => {
        const group = await ctx.db.get(groupItem.collectionGroupId);
        if (group) {
          groupIds.add(group._id);
          groups.push({
            _id: group._id,
            name: group.name,
            description: group.description,
            itemsCount: group.itemsCount,
          });
        }
      }),
    );

    if (
      collection.collectionGroupId &&
      !groupIds.has(collection.collectionGroupId)
    ) {
      const group = await ctx.db.get(collection.collectionGroupId);
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

    const [, groupItems] = await Promise.all([
      requirePermission(ctx, group.organizationId, "collections.read"),
      ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collectionGroup", (q) =>
          q.eq("collectionGroupId", args.groupId),
        )
        .collect(),
    ] as const);

    let active = 0;
    let loaned = 0;
    let deaccessioned = 0;

    const collections = await Promise.all(
      groupItems.map((groupItem) => ctx.db.get(groupItem.collectionId)),
    );

    for (const collection of collections) {
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
