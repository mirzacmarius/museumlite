import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePermission } from "./utils/permissions";

const treatmentTypeValidator = v.union(
  v.literal("routine"),
  v.literal("stabilization"),
  v.literal("restoration"),
  v.literal("cleaning"),
  v.literal("repair"),
  v.literal("assessment"),
  v.literal("other"),
);

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationTreatments"),
      _creationTime: v.number(),
      treatmentType: treatmentTypeValidator,
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    const results = await Promise.all(
      treatments.map(async (treatment) => {
        const collection = await ctx.db.get(treatment.collectionId);
        const user = await ctx.db.get(treatment.performedBy);
        return {
          _id: treatment._id,
          _creationTime: treatment._creationTime,
          treatmentType: treatment.treatmentType,
          title: treatment.title,
          description: treatment.description,
          performedAt: treatment.performedAt,
          performedByName:
            treatment.performedByName || user?.name || user?.email,
          notes: treatment.notes,
          collectionId: treatment.collectionId,
          collectionTitle: collection?.title,
        };
      }),
    );

    return results;
  },
});

export const get = query({
  args: {
    id: v.id("conservationTreatments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conservationTreatments"),
      _creationTime: v.number(),
      treatmentType: treatmentTypeValidator,
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedBy: v.id("users"),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.id);
    if (!treatment) {
      return null;
    }

    await requirePermission(ctx, treatment.organizationId, "collections.read");

    const collection = await ctx.db.get(treatment.collectionId);
    const user = await ctx.db.get(treatment.performedBy);

    return {
      _id: treatment._id,
      _creationTime: treatment._creationTime,
      treatmentType: treatment.treatmentType,
      title: treatment.title,
      description: treatment.description,
      performedAt: treatment.performedAt,
      performedBy: treatment.performedBy,
      performedByName: treatment.performedByName || user?.name || user?.email,
      notes: treatment.notes,
      collectionId: treatment.collectionId,
      organizationId: treatment.organizationId,
      collectionTitle: collection?.title,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("conservationTreatments"),
    treatmentType: v.optional(treatmentTypeValidator),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    performedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.id);
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await ctx.db.patch(args.id, filteredUpdates);
    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("conservationTreatments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.id);
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.delete",
    );

    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * List conservation treatments for a collection
 */
export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationTreatments"),
      treatmentType: v.union(
        v.literal("routine"),
        v.literal("stabilization"),
        v.literal("restoration"),
        v.literal("cleaning"),
        v.literal("repair"),
        v.literal("assessment"),
        v.literal("other"),
      ),
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .collect();

    // Enrich with performer names
    const enrichedTreatments = await Promise.all(
      treatments.map(async (treatment) => {
        const user = await ctx.db.get(treatment.performedBy);
        return {
          _id: treatment._id,
          treatmentType: treatment.treatmentType,
          title: treatment.title,
          description: treatment.description,
          performedAt: treatment.performedAt,
          performedByName:
            treatment.performedByName || user?.name || user?.email,
          notes: treatment.notes,
        };
      }),
    );

    return enrichedTreatments;
  },
});

/**
 * Create a conservation treatment record
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    treatmentType: v.union(
      v.literal("routine"),
      v.literal("stabilization"),
      v.literal("restoration"),
      v.literal("cleaning"),
      v.literal("repair"),
      v.literal("assessment"),
      v.literal("other"),
    ),
    title: v.string(),
    description: v.string(),
    performedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("conservationTreatments"),
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

    const user = await ctx.db.get(userId);

    const treatmentId = await ctx.db.insert("conservationTreatments", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      treatmentType: args.treatmentType,
      title: args.title,
      description: args.description,
      performedBy: userId,
      performedByName: user?.name || user?.email || undefined,
      performedAt: args.performedAt ?? Date.now(),
      notes: args.notes,
    });

    return treatmentId;
  },
});
