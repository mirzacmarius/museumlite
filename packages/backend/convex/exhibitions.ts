import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePermission } from "./utils/permissions";

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      _creationTime: v.number(),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    const results = await Promise.all(
      exhibitions.map(async (exhibition) => {
        const collection = await ctx.db.get(exhibition.collectionId);
        return {
          _id: exhibition._id,
          _creationTime: exhibition._creationTime,
          title: exhibition.title,
          location: exhibition.location,
          startDate: exhibition.startDate,
          endDate: exhibition.endDate,
          isCurrent: exhibition.isCurrent,
          isLoan: exhibition.isLoan,
          loanVenue: exhibition.loanVenue,
          notes: exhibition.notes,
          collectionId: exhibition.collectionId,
          collectionTitle: collection?.title,
        };
      }),
    );

    return results;
  },
});

export const get = query({
  args: {
    id: v.id("exhibitions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("exhibitions"),
      _creationTime: v.number(),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      return null;
    }

    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const collection = await ctx.db.get(exhibition.collectionId);

    return {
      _id: exhibition._id,
      _creationTime: exhibition._creationTime,
      title: exhibition.title,
      location: exhibition.location,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      isCurrent: exhibition.isCurrent,
      isLoan: exhibition.isLoan,
      loanVenue: exhibition.loanVenue,
      notes: exhibition.notes,
      collectionId: exhibition.collectionId,
      organizationId: exhibition.organizationId,
      collectionTitle: collection?.title,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("exhibitions"),
    title: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isCurrent: v.optional(v.boolean()),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (filteredUpdates.isCurrent === true) {
      const currentExhibitions = await ctx.db
        .query("exhibitions")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", exhibition.collectionId),
        )
        .filter((q) => q.eq(q.field("isCurrent"), true))
        .collect();

      for (const ex of currentExhibitions) {
        if (ex._id !== args.id) {
          await ctx.db.patch(ex._id, { isCurrent: false });
        }
      }
    }

    await ctx.db.patch(args.id, filteredUpdates);
    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.delete",
    );

    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * List exhibitions for a collection
 */
export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .collect();

    return exhibitions.map((exhibition) => ({
      _id: exhibition._id,
      title: exhibition.title,
      location: exhibition.location,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      isCurrent: exhibition.isCurrent,
      isLoan: exhibition.isLoan,
      loanVenue: exhibition.loanVenue,
      notes: exhibition.notes,
    }));
  },
});

/**
 * Create an exhibition record
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    title: v.string(),
    location: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isCurrent: v.boolean(),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("exhibitions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    // If this is marked as current, unmark any existing current exhibitions
    if (args.isCurrent) {
      const currentExhibitions = await ctx.db
        .query("exhibitions")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .filter((q) => q.eq(q.field("isCurrent"), true))
        .collect();

      for (const exhibition of currentExhibitions) {
        await ctx.db.patch(exhibition._id, { isCurrent: false });
      }
    }

    const exhibitionId = await ctx.db.insert("exhibitions", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      title: args.title,
      location: args.location,
      startDate: args.startDate,
      endDate: args.endDate,
      isCurrent: args.isCurrent,
      isLoan: args.isLoan,
      loanVenue: args.loanVenue,
      notes: args.notes,
    });

    return exhibitionId;
  },
});
