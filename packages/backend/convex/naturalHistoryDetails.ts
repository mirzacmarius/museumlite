import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  naturalHistoryDetailFields,
  typeDetailRecordFields,
} from "./utils/collectionTypeDetailFields";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { requireModuleEnabled } from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

async function requireNaturalHistoryModule(
  ctx: MutationCtx | QueryCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "natural_history");
}

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("naturalHistoryDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...naturalHistoryDetailFields,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      return null;
    }
    await Promise.all([
      requireNaturalHistoryModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.read"),
    ]);
    const details = await ctx.db
      .query("naturalHistoryDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    return details;
  },
});

export const upsert = mutation({
  args: {
    collectionId: v.id("collections"),
    ...naturalHistoryDetailFields,
  },
  returns: v.id("naturalHistoryDetails"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    const [, , existing] = await Promise.all([
      requireNaturalHistoryModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
      ctx.db
        .query("naturalHistoryDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique(),
    ] as const);

    const { collectionId, ...updateData } = args;

    if (existing) {
      await Promise.all([
        ctx.db.patch(existing._id, {
          ...updateData,
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "updated",
          entityType: "naturalHistoryDetails",
          entityId: existing._id,
          changes: updateData,
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("naturalHistoryDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      ...updateData,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "naturalHistoryDetails",
      entityId: id,
      changes: updateData,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    naturalHistoryDetailsId: v.id("naturalHistoryDetails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.naturalHistoryDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Natural history details not found");
    }
    await Promise.all([
      requireNaturalHistoryModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
    ]);
    return rejectPermanentEvidenceDeletion();
  },
});

export const searchByTaxonomy = query({
  args: {
    organizationId: v.id("organizations"),
    kingdom: v.optional(v.string()),
    phylum: v.optional(v.string()),
    genus: v.optional(v.string()),
    species: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("naturalHistoryDetails"),
      collectionId: v.id("collections"),
      kingdom: v.optional(v.string()),
      phylum: v.optional(v.string()),
      genus: v.optional(v.string()),
      species: v.optional(v.string()),
      commonName: v.optional(v.string()),
      scientificName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const query = ctx.db
      .query("naturalHistoryDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const specimens = await query.collect();

    const filtered = specimens.filter((s) => {
      if (args.kingdom && s.kingdom !== args.kingdom) return false;
      if (args.phylum && s.phylum !== args.phylum) return false;
      if (args.genus && s.genus !== args.genus) return false;
      if (args.species && s.species !== args.species) return false;
      return true;
    });

    return filtered.map((s) => ({
      _id: s._id,
      collectionId: s.collectionId,
      kingdom: s.kingdom,
      phylum: s.phylum,
      genus: s.genus,
      species: s.species,
      commonName: s.commonName,
      scientificName: s.scientificName,
    }));
  },
});

export const listByLocation = query({
  args: {
    organizationId: v.id("organizations"),
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id("naturalHistoryDetails"),
      collectionId: v.id("collections"),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      locality: v.optional(v.string()),
      scientificName: v.optional(v.string()),
      commonName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const specimens = await ctx.db
      .query("naturalHistoryDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filtered = specimens.filter((s) => {
      if (s.latitude === undefined || s.longitude === undefined) return false;
      return (
        s.latitude >= args.minLat &&
        s.latitude <= args.maxLat &&
        s.longitude >= args.minLng &&
        s.longitude <= args.maxLng
      );
    });

    return filtered.map((s) => ({
      _id: s._id,
      collectionId: s.collectionId,
      latitude: s.latitude,
      longitude: s.longitude,
      locality: s.locality,
      scientificName: s.scientificName,
      commonName: s.commonName,
    }));
  },
});
