import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

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
