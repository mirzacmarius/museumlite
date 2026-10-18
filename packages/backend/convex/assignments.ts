import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * The objects the viewer cataloged, and those they changed this week, in the
 * organization.
 */
export const listMyAssignments = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    recentlyModified: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        lastModifiedAt: v.number(),
        thumbnailUrl: v.optional(v.string()),
      }),
    ),
    myCatalogedItems: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        catalogedAt: v.number(),
        thumbnailUrl: v.optional(v.string()),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
      }),
    ),
    stats: v.object({
      totalCatalogedItems: v.number(),
      itemsModifiedThisWeek: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get items recently modified by the user
    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const recentlyModifiedByUser = allCollections
      .filter(
        (c) =>
          c.lastModifiedBy === userId &&
          c.lastModifiedAt &&
          c.lastModifiedAt > oneWeekAgo,
      )
      .sort((a, b) => (b.lastModifiedAt ?? 0) - (a.lastModifiedAt ?? 0))
      .slice(0, limit);

    // Get thumbnails for recently modified
    const recentlyModified = await Promise.all(
      recentlyModifiedByUser.map(async (c) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | undefined;
        if (primaryMedia?.storageId) {
          const url = await ctx.storage.getUrl(primaryMedia.storageId);
          thumbnailUrl = url ?? undefined;
        }

        return {
          _id: c._id,
          title: c.title,
          accessionNumber: c.accessionNumber,
          lastModifiedAt: c.lastModifiedAt!,
          thumbnailUrl,
        };
      }),
    );

    // Get items cataloged by the user
    const myCatalogedCollections = allCollections
      .filter((c) => c.catalogedBy === userId)
      .sort((a, b) => b.catalogedAt - a.catalogedAt)
      .slice(0, limit);

    const myCatalogedItems = await Promise.all(
      myCatalogedCollections.map(async (c) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | undefined;
        if (primaryMedia?.storageId) {
          const url = await ctx.storage.getUrl(primaryMedia.storageId);
          thumbnailUrl = url ?? undefined;
        }

        return {
          _id: c._id,
          title: c.title,
          accessionNumber: c.accessionNumber,
          catalogedAt: c.catalogedAt,
          thumbnailUrl,
          status: c.status,
        };
      }),
    );

    // Calculate stats
    const itemsModifiedThisWeek = allCollections.filter(
      (c) =>
        c.lastModifiedBy === userId &&
        c.lastModifiedAt &&
        c.lastModifiedAt > oneWeekAgo,
    ).length;

    const totalCatalogedItems = allCollections.filter(
      (c) => c.catalogedBy === userId,
    ).length;

    return {
      recentlyModified,
      myCatalogedItems,
      stats: {
        totalCatalogedItems,
        itemsModifiedThisWeek,
      },
    };
  },
});
