import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
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

async function getEffectiveGroupItems(
  ctx: QueryCtx,
  group: Doc<"collectionGroups">,
) {
  const [memberships, legacyPrimaryObjects] = await Promise.all([
    ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collectionGroup", (q) =>
        q.eq("collectionGroupId", group._id),
      )
      .collect(),
    ctx.db
      .query("collections")
      .withIndex("by_collectionGroup", (q) =>
        q.eq("collectionGroupId", group._id),
      )
      .collect(),
  ]);
  const byObject = new Map<
    Id<"collections">,
    {
      membershipId?: Id<"collectionGroupItems">;
      collection: Doc<"collections">;
      addedAt: number;
      role: "primary" | "secondary";
    }
  >();
  for (const membership of memberships) {
    const collection = await ctx.db.get(membership.collectionId);
    if (!collection || collection.organizationId !== group.organizationId) continue;
    byObject.set(collection._id, {
      membershipId: membership._id,
      collection,
      addedAt: membership.addedAt,
      role:
        membership.role ??
        (collection.collectionGroupId === group._id ? "primary" : "secondary"),
    });
  }
  for (const collection of legacyPrimaryObjects) {
    if (collection.organizationId !== group.organizationId) continue;
    if (!byObject.has(collection._id)) {
      byObject.set(collection._id, {
        collection,
        addedAt: collection.catalogedAt,
        role: "primary",
      });
    }
  }
  return [...byObject.values()];
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

  const scopedGroupItems = (
    await Promise.all(
      groupItems.map(async (item) => {
        const collection = await ctx.db.get(item.collectionId);
        return collection?.organizationId === group.organizationId
          ? item
          : null;
      }),
    )
  ).filter((item) => item !== null);

  if (scopedGroupItems.length === 0) {
    return null;
  }

  const primaryUrls = await Promise.all(
    scopedGroupItems.map(async (groupItem) => {
      const primaryMedia = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection_and_isPrimary_and_fileType", (q) =>
          q
            .eq("collectionId", groupItem.collectionId)
            .eq("isPrimary", true)
            .eq("fileType", "image"),
        )
        .first();

      if (
        !primaryMedia ||
        primaryMedia.organizationId !== group.organizationId
      ) {
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
    scopedGroupItems.map(async (groupItem) => {
      const anyMedia = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection_and_fileType", (q) =>
          q.eq("collectionId", groupItem.collectionId).eq("fileType", "image"),
        )
        .first();

      if (!anyMedia || anyMedia.organizationId !== group.organizationId) {
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
          itemsCount: (await getEffectiveGroupItems(ctx, g)).length,
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
      storageLocation: v.optional(v.string()),
      createdAt: v.number(),
      createdBy: v.id("users"),
      lastModifiedAt: v.optional(v.number()),
      lastModifiedBy: v.optional(v.id("users")),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) return null;

    try {
      await requirePermission(ctx, group.organizationId, "collections.read");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return null;
      }
      throw error;
    }

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
      itemsCount: (await getEffectiveGroupItems(ctx, group)).length,
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
    await Promise.all([
      requirePermission(ctx, group.organizationId, "collections.delete"),
      checkGroupAccessControl(ctx, group, userId),
    ]);
    const items = await getEffectiveGroupItems(ctx, group);
    if (items.length > 0) {
      throw new Error("Move or remove all object memberships before deleting this collection group");
    }
    await Promise.all([
      ctx.db.delete(args.groupId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: group.organizationId,
        userId,
        action: "deleted_collection_group",
        entityType: "collectionGroup",
        entityId: args.groupId,
        changes: {
          name: group.name,
          itemsRemoved: 0,
          collectionsUnlinked: 0,
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

    const addResults = await Promise.all(
      Array.from(new Set(args.collectionIds)).map(async (collectionId) => {
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
            role:
              collection.collectionGroupId === args.groupId
                ? "primary"
                : "secondary",
            addedAt: Date.now(),
            addedBy: userId,
          });
          return 1;
        }
        return 0;
      }),
    );
    const addedCount = addResults.reduce<number>(
      (total, added) => total + added,
      0,
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

    const removeResults = await Promise.all(
      Array.from(new Set(args.collectionIds)).map(async (collectionId) => {
        const collection = await ctx.db.get(collectionId);
        if (!collection || collection.organizationId !== group.organizationId) {
          throw new Error("Object not found in this organization");
        }
        if (collection.collectionGroupId === args.groupId) {
          throw new Error("Change the primary group on the object before removing this membership");
        }
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
          return 1;
        }
        return 0;
      }),
    );
    const removedCount = removeResults.reduce<number>(
      (total, removed) => total + removed,
      0,
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
      _id: v.optional(v.id("collectionGroupItems")),
      collectionId: v.id("collections"),
      role: v.union(v.literal("primary"), v.literal("secondary")),
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
    const groupItems = await getEffectiveGroupItems(ctx, group);

    const items: Array<{
      _id?: Id<"collectionGroupItems">;
      collectionId: Id<"collections">;
      role: "primary" | "secondary";
      accessionNumber: string;
      title: string;
      description?: string;
      currentLocationId?: Id<"locations">;
      status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
      addedAt: number;
    }> = [];

    await Promise.all(
      Array.from(groupItems).map(async (groupItem) => {
        const collection = groupItem.collection;
        if (collection) {
          items.push({
            _id: groupItem.membershipId,
            collectionId: collection._id,
            role: groupItem.role,
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
      role: v.union(v.literal("primary"), v.literal("secondary")),
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
      role: "primary" | "secondary";
    }> = [];
    const groupIds = new Set<Id<"collectionGroups">>();

    await Promise.all(
      Array.from(groupItems).map(async (groupItem) => {
        const group = await ctx.db.get(groupItem.collectionGroupId);
        if (group?.organizationId === collection.organizationId) {
          groupIds.add(group._id);
          groups.push({
            _id: group._id,
            name: group.name,
            description: group.description,
            itemsCount: group.itemsCount,
            role: groupItem.role ?? (collection.collectionGroupId === group._id ? "primary" : "secondary"),
          });
        }
      }),
    );

    if (
      collection.collectionGroupId &&
      !groupIds.has(collection.collectionGroupId)
    ) {
      const group = await ctx.db.get(collection.collectionGroupId);
      if (group?.organizationId === collection.organizationId) {
        groups.push({
          _id: group._id,
          name: group.name,
          description: group.description,
          itemsCount: group.itemsCount,
          role: "primary",
        });
      }
    }

    return groups.sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === "primary" ? -1 : 1,
    );
  },
});

export const backfillMemberships = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  returns: v.object({
    examined: v.number(),
    added: v.number(),
    updated: v.number(),
    conflicts: v.array(
      v.object({
        collectionId: v.id("collections"),
        code: v.union(
          v.literal("conflicting_primary"),
          v.literal("invalid_group"),
          v.literal("duplicate_membership"),
        ),
      }),
    ),
    cursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50) {
      throw new Error("Backfill page size must be between 1 and 50");
    }
    const page = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({ numItems: args.limit, cursor: args.cursor });
    let added = 0;
    let updated = 0;
    const conflicts: Array<{
      collectionId: Id<"collections">;
      code: "conflicting_primary" | "invalid_group" | "duplicate_membership";
    }> = [];
    for (const collection of page.page) {
      const memberships = await ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", collection._id),
        )
        .collect();
      const seen = new Set<Id<"collectionGroups">>();
      for (const membership of memberships) {
        if (seen.has(membership.collectionGroupId)) {
          conflicts.push({
            collectionId: collection._id,
            code: "duplicate_membership",
          });
        }
        seen.add(membership.collectionGroupId);
        const group = await ctx.db.get(membership.collectionGroupId);
        if (!group || group.organizationId !== args.organizationId) {
          conflicts.push({ collectionId: collection._id, code: "invalid_group" });
        }
      }
      const explicitPrimaries = memberships.filter(
        (membership) => membership.role === "primary",
      );
      if (
        explicitPrimaries.length > 1 ||
        (collection.collectionGroupId &&
          explicitPrimaries.some(
            (membership) =>
              membership.collectionGroupId !== collection.collectionGroupId,
          ))
      ) {
        conflicts.push({
          collectionId: collection._id,
          code: "conflicting_primary",
        });
      }
      if (collection.collectionGroupId) {
        const primaryGroup = await ctx.db.get(collection.collectionGroupId);
        if (!primaryGroup || primaryGroup.organizationId !== args.organizationId) {
          conflicts.push({ collectionId: collection._id, code: "invalid_group" });
        } else if (!seen.has(primaryGroup._id)) {
          await ctx.db.insert("collectionGroupItems", {
            collectionGroupId: primaryGroup._id,
            collectionId: collection._id,
            role: "primary",
            addedAt: collection.catalogedAt,
            addedBy: collection.catalogedBy,
          });
          added++;
        }
      }
      for (const membership of memberships) {
        if (membership.role) continue;
        await ctx.db.patch(membership._id, {
          role:
            membership.collectionGroupId === collection.collectionGroupId
              ? "primary"
              : "secondary",
        });
        updated++;
      }
    }
    return {
      examined: page.page.length,
      added,
      updated,
      conflicts,
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
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
    const groupItems = await getEffectiveGroupItems(ctx, group);

    let active = 0;
    let loaned = 0;
    let deaccessioned = 0;

    const collections = groupItems.map((item) => item.collection);

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
