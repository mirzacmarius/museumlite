import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getDisplayedMediaThumbnailUrl } from "./utils/collectionDisplayHelpers";
import {
  getCurrentUserOrganization,
  getRolePermissionNames,
} from "./utils/permissions";

/** Cataloged by you counts up to this many objects, and shows 99+ beyond. */
const CATALOGED_COUNT_LIMIT = 100;

/**
 * The newest objects the viewer cataloged in the organization, and how many
 * they cataloged, up to 100. Both come from the viewer's own rows of the
 * cataloguer index, so changes to other objects do not rerun it.
 */
export const listMyAssignments = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
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
    }),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const membership = await getCurrentUserOrganization(
      ctx,
      args.organizationId,
    );
    if (!membership) {
      throw new Error("Not a member of this organization");
    }
    // The dashboard shows this section to every member; one whose role
    // cannot read Objects sees it empty rather than an error.
    const permissions = await getRolePermissionNames(ctx, membership.roleId);
    if (!permissions.includes("collections.read")) {
      return { myCatalogedItems: [], stats: { totalCatalogedItems: 0 } };
    }

    const cataloged = await ctx.db
      .query("collections")
      .withIndex("by_organizationId_and_catalogedBy_and_catalogedAt", (q) =>
        q.eq("organizationId", args.organizationId).eq("catalogedBy", userId),
      )
      .order("desc")
      .take(Math.max(limit, CATALOGED_COUNT_LIMIT));

    const myCatalogedItems = await Promise.all(
      cataloged.slice(0, limit).map(async (c) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | undefined;
        if (primaryMedia?.storageId) {
          const url = await getDisplayedMediaThumbnailUrl(ctx, primaryMedia);
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

    return {
      myCatalogedItems,
      stats: {
        totalCatalogedItems: Math.min(cataloged.length, CATALOGED_COUNT_LIMIT),
      },
    };
  },
});
