import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./utils/permissions";

/**
 * Generate accession number based on organization format
 */
async function generateAccessionNumber(
  ctx: any,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const format = org.settings?.accessionNumberFormat;
  const autoGenerate = org.settings?.autoGenerateAccessionNumbers ?? false;

  if (!autoGenerate || !format) {
    throw new Error("Accession number generation not configured");
  }

  // Simple format implementation - can be enhanced
  // Format examples: "ORG-YYYY-###" or "YYYY-ORG-###"
  const year = new Date().getFullYear();
  const orgSlug = org.slug.toUpperCase().substring(0, 3);

  // Count existing accessions this year
  const existing = await ctx.db
    .query("collections")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .filter((q) =>
      q.eq(
        q.field("accessionNumber"),
        `${orgSlug}-${year}-001`,
      ),
    )
    .collect();

  const sequence = String(existing.length + 1).padStart(3, "0");
  return `${orgSlug}-${year}-${sequence}`;
}

/**
 * Create new collection object
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.optional(v.string()),
    title: v.string(),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
    currentLocationId: v.optional(v.id("locations")),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.create");

    // Generate or validate accession number
    let accessionNumber: string;
    if (args.accessionNumber) {
      accessionNumber = args.accessionNumber;
    } else {
      accessionNumber = await generateAccessionNumber(
        ctx,
        args.organizationId,
      );
    }

    // Check uniqueness
    const existing = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accessionNumber", accessionNumber),
      )
      .first();

    if (existing) {
      throw new Error("Accession number already exists");
    }

    // Create collection object
    const collectionId = await ctx.db.insert("collections", {
      organizationId: args.organizationId,
      accessionNumber,
      title: args.title,
      objectType: args.objectType,
      objectName: args.objectName,
      culture: args.culture,
      period: args.period,
      dateCreated: args.dateCreated,
      materials: args.materials,
      dimensions: args.dimensions,
      description: args.description,
      condition: args.condition,
      provenance: args.provenance,
      exhibitionHistory: args.exhibitionHistory,
      currentLocationId: args.currentLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return collectionId;
  },
});

/**
 * Get collection object by ID
 */
export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      organizationId: v.id("organizations"),
      accessionNumber: v.string(),
      alternateAccessionNumbers: v.optional(v.array(v.string())),
      accessionNumberHistory: v.optional(
        v.array(
          v.object({
            number: v.string(),
            validFrom: v.number(),
            validTo: v.optional(v.number()),
          }),
        ),
      ),
      title: v.string(),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      condition: v.optional(v.string()),
      provenance: v.optional(v.string()),
      exhibitionHistory: v.optional(v.string()),
      currentLocationId: v.optional(v.id("locations")),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
      catalogedBy: v.id("users"),
      catalogedAt: v.number(),
      lastModifiedBy: v.optional(v.id("users")),
      lastModifiedAt: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    return collection;
  },
});

/**
 * List collections with pagination and filters
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
    ),
    locationId: v.optional(v.id("locations")),
    objectType: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    materials: v.optional(v.string()),
    search: v.optional(v.string()),
    dateCreatedFrom: v.optional(v.number()),
    dateCreatedTo: v.optional(v.number()),
    catalogedFrom: v.optional(v.number()),
    catalogedTo: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("collections"),
        accessionNumber: v.string(),
        title: v.string(),
        objectType: v.optional(v.string()),
        currentLocationId: v.optional(v.id("locations")),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
        ),
        _creationTime: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.read");

    let allResults: Array<{
      _id: Id<"collections">;
      title: string;
      accessionNumber: string;
      objectType?: string;
      currentLocationId?: Id<"locations">;
      status: "active" | "loaned" | "deaccessioned";
      culture?: string;
      period?: string;
      materials?: string;
      description?: string;
      objectName?: string;
      provenance?: string;
      catalogedAt: number;
      _creationTime: number;
    }>;

    // Use searchIndex when search term is provided for better performance
    if (args.search && args.search.trim().length > 0) {
      // Use searchIndex for efficient full-text search on title
      let searchQuery = ctx.db
        .query("collections")
        .withSearchIndex("search_index", (q) => {
          let filter = q
            .search("title", args.search!)
            .eq("organizationId", args.organizationId);
          
          if (args.status) {
            filter = filter.eq("status", args.status);
          }
          
          return filter;
        });

      const searchResults = await searchQuery.collect();

      // Also search other fields that aren't in the searchIndex
      const regularQuery = ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );

      let filteredQuery = regularQuery;
      if (args.status) {
        filteredQuery = filteredQuery.filter((q) => q.eq(q.field("status"), args.status));
      }

      const allCollections = await filteredQuery.collect();
      const searchLower = args.search.toLowerCase();
      const searchResultIds = new Set(searchResults.map((r) => r._id));

      // Find additional matches in fields not covered by searchIndex
      const additionalResults = allCollections.filter((c) => {
        if (searchResultIds.has(c._id)) return false;
        
        return (
          c.accessionNumber?.toLowerCase().includes(searchLower) ||
          c.description?.toLowerCase().includes(searchLower) ||
          c.objectName?.toLowerCase().includes(searchLower) ||
          c.objectType?.toLowerCase().includes(searchLower) ||
          c.culture?.toLowerCase().includes(searchLower) ||
          c.period?.toLowerCase().includes(searchLower) ||
          c.materials?.toLowerCase().includes(searchLower) ||
          c.provenance?.toLowerCase().includes(searchLower) ||
          false
        );
      });

      // Combine and deduplicate
      allResults = [...searchResults, ...additionalResults];
    } else {
      // No search term - use regular index
      let query = ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );

      // Apply database-level filters
      if (args.status) {
        query = query.filter((q) => q.eq(q.field("status"), args.status));
      }

      if (args.locationId) {
        query = query.filter((q) =>
          q.eq(q.field("currentLocationId"), args.locationId),
        );
      }

      if (args.objectType) {
        query = query.filter((q) =>
          q.eq(q.field("objectType"), args.objectType),
        );
      }

      // Date range filters
      if (args.catalogedFrom || args.catalogedTo) {
        query = query.filter((q) => {
          let condition = q.gte(q.field("catalogedAt"), args.catalogedFrom ?? 0);
          if (args.catalogedTo) {
            condition = q.and(
              condition,
              q.lte(q.field("catalogedAt"), args.catalogedTo),
            );
          }
          return condition;
        });
      }

      allResults = await query.collect();
    }

    // Apply JavaScript-level filters (partial matching for text fields)
    if (args.culture) {
      const cultureLower = args.culture.toLowerCase();
      allResults = allResults.filter(
        (c) => c.culture?.toLowerCase().includes(cultureLower) ?? false,
      );
    }

    if (args.period) {
      const periodLower = args.period.toLowerCase();
      allResults = allResults.filter(
        (c) => c.period?.toLowerCase().includes(periodLower) ?? false,
      );
    }

    if (args.materials) {
      const materialsLower = args.materials.toLowerCase();
      allResults = allResults.filter(
        (c) => c.materials?.toLowerCase().includes(materialsLower) ?? false,
      );
    }

    // Apply location filter if not already applied (for search case)
    if (args.locationId && args.search) {
      allResults = allResults.filter(
        (c) => c.currentLocationId === args.locationId,
      );
    }

    // Apply objectType filter if not already applied (for search case)
    if (args.objectType && args.search) {
      allResults = allResults.filter(
        (c) => c.objectType === args.objectType,
      );
    }

    // Apply date range filters if not already applied (for search case)
    if ((args.catalogedFrom || args.catalogedTo) && args.search) {
      allResults = allResults.filter((c) => {
        if (args.catalogedFrom && c.catalogedAt < args.catalogedFrom) {
          return false;
        }
        if (args.catalogedTo && c.catalogedAt > args.catalogedTo) {
          return false;
        }
        return true;
      });
    }

    // Sort by creation time (newest first)
    allResults.sort((a, b) => b._creationTime - a._creationTime);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allResults.length,
    );
    const page = allResults.slice(startIndex, endIndex);

    return {
      page: page.map((item) => ({
        _id: item._id,
        accessionNumber: item.accessionNumber,
        title: item.title,
        objectType: item.objectType,
        currentLocationId: item.currentLocationId,
        status: item.status,
        _creationTime: item._creationTime,
      })),
      isDone: endIndex >= allResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

/**
 * Search collections using searchIndex for better performance
 * This is optimized for full-text search on the title field
 */
export const search = query({
  args: {
    organizationId: v.id("organizations"),
    searchQuery: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id("collections"),
        accessionNumber: v.string(),
        title: v.string(),
        objectType: v.optional(v.string()),
        currentLocationId: v.optional(v.id("locations")),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
        ),
        _creationTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = args.limit ?? 50;

    // Use searchIndex for efficient full-text search on title
    let searchQuery = ctx.db
      .query("collections")
      .withSearchIndex("search_index", (q) => {
        let filter = q
          .search("title", args.searchQuery)
          .eq("organizationId", args.organizationId);
        
        if (args.status) {
          filter = filter.eq("status", args.status);
        }
        
        return filter;
      });

    const results = await searchQuery.take(limit);

    // Also search other fields that aren't in the searchIndex
    // This extends the search to accession numbers and other fields
    const additionalResults: typeof results = [];
    
    if (args.searchQuery.length > 0) {
      const allCollections = await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => {
          let condition = q.eq(q.field("organizationId"), args.organizationId);
          if (args.status) {
            condition = q.and(condition, q.eq(q.field("status"), args.status));
          }
          return condition;
        })
        .collect();

      const searchLower = args.searchQuery.toLowerCase();
      const resultIds = new Set(results.map((r) => r._id));
      
      const additional = allCollections
        .filter((c) => {
          // Skip if already in results
          if (resultIds.has(c._id)) return false;
          
          // Search in accession number and other fields
          return (
            c.accessionNumber?.toLowerCase().includes(searchLower) ||
            c.description?.toLowerCase().includes(searchLower) ||
            c.objectName?.toLowerCase().includes(searchLower) ||
            c.objectType?.toLowerCase().includes(searchLower) ||
            false
          );
        })
        .slice(0, Math.max(0, limit - results.length));
      
      additionalResults.push(...additional);
    }

    // Combine and deduplicate results
    const combined = [...results, ...additionalResults];
    const uniqueResults = Array.from(
      new Map(combined.map((item) => [item._id, item])).values(),
    );

    // Sort by creation time (newest first)
    uniqueResults.sort((a, b) => b._creationTime - a._creationTime);

    return {
      results: uniqueResults.slice(0, limit).map((item) => ({
        _id: item._id,
        accessionNumber: item.accessionNumber,
        title: item.title,
        objectType: item.objectType,
        currentLocationId: item.currentLocationId,
        status: item.status,
        _creationTime: item._creationTime,
      })),
    };
  },
});

/**
 * Update collection object
 */
export const update = mutation({
  args: {
    collectionId: v.id("collections"),
    title: v.optional(v.string()),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
    currentLocationId: v.optional(v.id("locations")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    // Build update object
    const updates: {
      title?: string;
      objectType?: string;
      objectName?: string;
      culture?: string;
      period?: string;
      dateCreated?: string;
      materials?: string;
      dimensions?: string;
      description?: string;
      condition?: string;
      provenance?: string;
      exhibitionHistory?: string;
      currentLocationId?: Id<"locations">;
      lastModifiedBy?: Id<"users">;
      lastModifiedAt?: number;
    } = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.objectType !== undefined) updates.objectType = args.objectType;
    if (args.objectName !== undefined) updates.objectName = args.objectName;
    if (args.culture !== undefined) updates.culture = args.culture;
    if (args.period !== undefined) updates.period = args.period;
    if (args.dateCreated !== undefined) updates.dateCreated = args.dateCreated;
    if (args.materials !== undefined) updates.materials = args.materials;
    if (args.dimensions !== undefined) updates.dimensions = args.dimensions;
    if (args.description !== undefined)
      updates.description = args.description;
    if (args.condition !== undefined) updates.condition = args.condition;
    if (args.provenance !== undefined) updates.provenance = args.provenance;
    if (args.exhibitionHistory !== undefined)
      updates.exhibitionHistory = args.exhibitionHistory;
    if (args.currentLocationId !== undefined)
      updates.currentLocationId = args.currentLocationId;

    updates.lastModifiedBy = userId;
    updates.lastModifiedAt = Date.now();

    await ctx.db.patch(args.collectionId, updates);

    return null;
  },
});

/**
 * Delete collection (soft delete - mark as deaccessioned)
 */
export const deleteCollection = mutation({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.delete",
    );

    // Soft delete - mark as deaccessioned
    await ctx.db.patch(args.collectionId, {
      status: "deaccessioned",
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Find collection by accession number
 */
export const getByAccessionNumber = query({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    // Check primary accession number
    let collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accessionNumber", args.accessionNumber),
      )
      .first();

    if (collection) {
      return {
        _id: collection._id,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        status: collection.status,
      };
    }

    // Check alternate accession numbers
    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    collection = allCollections.find(
      (c) =>
        c.alternateAccessionNumbers?.includes(args.accessionNumber),
    ) ?? null;

    if (collection) {
      return {
        _id: collection._id,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        status: collection.status,
      };
    }

    return null;
  },
});

/**
 * Add alternate accession number
 */
export const addAlternateAccessionNumber = mutation({
  args: {
    collectionId: v.id("collections"),
    accessionNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const alternateNumbers =
      collection.alternateAccessionNumbers ?? [];
    if (alternateNumbers.includes(args.accessionNumber)) {
      throw new Error("Alternate accession number already exists");
    }

    await ctx.db.patch(args.collectionId, {
      alternateAccessionNumbers: [...alternateNumbers, args.accessionNumber],
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Remove alternate accession number
 */
export const removeAlternateAccessionNumber = mutation({
  args: {
    collectionId: v.id("collections"),
    accessionNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const alternateNumbers =
      collection.alternateAccessionNumbers ?? [];
    const updated = alternateNumbers.filter(
      (num) => num !== args.accessionNumber,
    );

    await ctx.db.patch(args.collectionId, {
      alternateAccessionNumbers: updated,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Get accession number history
 */
export const getAccessionHistory = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      number: v.string(),
      validFrom: v.number(),
      validTo: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.read",
    );

    return collection.accessionNumberHistory ?? [];
  },
});

