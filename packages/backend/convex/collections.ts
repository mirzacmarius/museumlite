import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./utils/permissions";
import { accessionParser } from "./utils/accessionNumberParser";
import { getNextCounterValue } from "./utils/accessionCounter";

/**
 * Generate accession number based on organization format template
 */
async function generateAccessionNumber(
  ctx: any,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const template = org.settings?.accessionNumberFormat;
  const autoGenerate = org.settings?.autoGenerateAccessionNumbers ?? false;

  if (!autoGenerate) {
    throw new Error(
      "Auto-generate accession numbers is disabled. Please enable it in Organization Settings or provide a custom accession number.",
    );
  }

  if (!template) {
    throw new Error(
      "Accession number format is not configured. Please set up an accession format template in Organization Settings.",
    );
  }

  const now = new Date();

  // Determine counter scope from settings or template
  const counterScope =
    org.settings?.accessionCounterScope ||
    accessionParser.getCounterScopeFromTemplate(template);

  // Get scope key for counter tracking
  const scopeKey = accessionParser.getScopeKey(counterScope, now);

  // Get next counter value (atomic operation)
  const counterValue = await getNextCounterValue(
    ctx,
    organizationId,
    counterScope,
    scopeKey,
  );

  // Parse template and generate accession number
  const accessionNumber = accessionParser.parse(template, {
    organizationSlug: org.slug,
    currentDate: now,
    counterValue,
    counterScope,
  });

  return accessionNumber;
}

/**
 * Create new collection object
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionGroupId: v.optional(v.id("collectionGroups")),
    accessionNumber: v.optional(v.string()),
    title: v.string(),
    creator: v.optional(v.string()),
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
    donated_by: v.optional(v.array(v.string())),
    donated_date: v.optional(v.string()),
    donation_info: v.optional(v.string()),
    previous_owners: v.optional(v.array(v.string())),
    links: v.optional(
      v.array(
        v.object({
          url: v.string(),
          label: v.optional(v.string()),
        }),
      ),
    ),
    parentObjectId: v.optional(v.id("collections")),
    currentLocationId: v.optional(v.id("locations")),
    alternateAccessionNumbers: v.optional(v.array(v.string())),
    acquisitionMethod: v.optional(v.string()),
    legalRestrictions: v.optional(v.boolean()),
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
      accessionNumber = await generateAccessionNumber(ctx, args.organizationId);
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
      collectionGroupId: args.collectionGroupId,
      accessionNumber,
      title: args.title,
      creator: args.creator,
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
      donated_by: args.donated_by,
      donated_date: args.donated_date,
      donation_info: args.donation_info,
      previous_owners: args.previous_owners,
      links: args.links,
      parentObjectId: args.parentObjectId,
      currentLocationId: args.currentLocationId,
      alternateAccessionNumbers: args.alternateAccessionNumbers,
      acquisitionMethod: args.acquisitionMethod,
      legalRestrictions: args.legalRestrictions,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    if (args.collectionGroupId) {
      const group = await ctx.db.get(args.collectionGroupId);
      if (group) {
        await ctx.db.patch(args.collectionGroupId, {
          itemsCount: (group.itemsCount || 0) + 1,
        });
      }
    }

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
      collectionGroupId: v.optional(v.id("collectionGroups")),
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
      creator: v.optional(v.string()),
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
      donated_by: v.optional(v.array(v.string())),
      donated_date: v.optional(v.string()),
      donation_info: v.optional(v.string()),
      previous_owners: v.optional(v.array(v.string())),
      links: v.optional(
        v.array(
          v.object({
            url: v.string(),
            label: v.optional(v.string()),
          }),
        ),
      ),
      parentObjectId: v.optional(v.id("collections")),
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
    collectionGroupId: v.optional(v.id("collectionGroups")),
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
        collectionGroupId: v.optional(v.id("collectionGroups")),
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
      collectionGroupId?: Id<"collectionGroups">;
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

      let searchResults = await searchQuery.collect();
      
      // Filter out deaccessioned items if no status filter is provided
      if (!args.status) {
        searchResults = searchResults.filter((c) => c.status !== "deaccessioned");
      }

      // Also search other fields that aren't in the searchIndex
      const regularQuery = ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );

      let filteredQuery = regularQuery;
      if (args.status) {
        filteredQuery = filteredQuery.filter((q) =>
          q.eq(q.field("status"), args.status),
        );
      }

      const allCollections = await filteredQuery.collect();
      const searchLower = args.search.toLowerCase();
      const searchResultIds = new Set(searchResults.map((r) => r._id));

      // Find additional matches in fields not covered by searchIndex
      const additionalResults = allCollections.filter((c) => {
        if (searchResultIds.has(c._id)) return false;

        // Filter out deaccessioned items if no status filter is provided
        if (!args.status && c.status === "deaccessioned") return false;

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
      
      // Apply deaccession filter if no status specified (safety net for search results)
      if (!args.status) {
        allResults = allResults.filter((c) => c.status !== "deaccessioned");
      }
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
      } else {
        // When no status filter is provided, exclude deaccessioned items
        query = query.filter((q) => q.neq(q.field("status"), "deaccessioned"));
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

      if (args.collectionGroupId) {
        query = query.filter((q) =>
          q.eq(q.field("collectionGroupId"), args.collectionGroupId),
        );
      }

      // Date range filters
      if (args.catalogedFrom || args.catalogedTo) {
        query = query.filter((q) => {
          let condition = q.gte(
            q.field("catalogedAt"),
            args.catalogedFrom ?? 0,
          );
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
      
      // Apply deaccession filter if no status specified (safety net for non-search results)
      if (!args.status) {
        allResults = allResults.filter((c) => c.status !== "deaccessioned");
      }
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
      allResults = allResults.filter((c) => c.objectType === args.objectType);
    }

    if (args.collectionGroupId && args.search) {
      allResults = allResults.filter((c) => c.collectionGroupId === args.collectionGroupId);
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

    let results = await searchQuery.take(limit);
    
    // Filter out deaccessioned items if no status filter is provided
    if (!args.status) {
      results = results.filter((c) => c.status !== "deaccessioned");
    }

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

          // Filter out deaccessioned items if no status filter is provided
          if (!args.status && c.status === "deaccessioned") return false;

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
    collectionGroupId: v.optional(v.id("collectionGroups")),
    title: v.optional(v.string()),
    creator: v.optional(v.string()),
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
    donated_by: v.optional(v.array(v.string())),
    donated_date: v.optional(v.string()),
    donation_info: v.optional(v.string()),
    previous_owners: v.optional(v.array(v.string())),
    links: v.optional(
      v.array(
        v.object({
          url: v.string(),
          label: v.optional(v.string()),
        }),
      ),
    ),
    parentObjectId: v.optional(v.id("collections")),
    currentLocationId: v.optional(v.id("locations")),
    alternateAccessionNumbers: v.optional(v.array(v.string())),
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
      collectionGroupId?: Id<"collectionGroups">;
      creator?: string;
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
      donated_by?: Array<string>;
      donated_date?: string;
      donation_info?: string;
      previous_owners?: Array<string>;
      links?: Array<{ url: string; label?: string }>;
      parentObjectId?: Id<"collections">;
      currentLocationId?: Id<"locations">;
      alternateAccessionNumbers?: Array<string>;
      lastModifiedBy?: Id<"users">;
      lastModifiedAt?: number;
    } = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.collectionGroupId !== undefined) updates.collectionGroupId = args.collectionGroupId;
    if (args.creator !== undefined) updates.creator = args.creator;
    if (args.objectType !== undefined) updates.objectType = args.objectType;
    if (args.objectName !== undefined) updates.objectName = args.objectName;
    if (args.culture !== undefined) updates.culture = args.culture;
    if (args.period !== undefined) updates.period = args.period;
    if (args.dateCreated !== undefined) updates.dateCreated = args.dateCreated;
    if (args.materials !== undefined) updates.materials = args.materials;
    if (args.dimensions !== undefined) updates.dimensions = args.dimensions;
    if (args.description !== undefined) updates.description = args.description;
    if (args.condition !== undefined) updates.condition = args.condition;
    if (args.provenance !== undefined) updates.provenance = args.provenance;
    if (args.exhibitionHistory !== undefined)
      updates.exhibitionHistory = args.exhibitionHistory;
    if (args.donated_by !== undefined) updates.donated_by = args.donated_by;
    if (args.donated_date !== undefined) updates.donated_date = args.donated_date;
    if (args.donation_info !== undefined) updates.donation_info = args.donation_info;
    if (args.previous_owners !== undefined) updates.previous_owners = args.previous_owners;
    if (args.links !== undefined) updates.links = args.links;
    if (args.parentObjectId !== undefined) updates.parentObjectId = args.parentObjectId;
    if (args.currentLocationId !== undefined)
      updates.currentLocationId = args.currentLocationId;
    if (args.alternateAccessionNumbers !== undefined)
      updates.alternateAccessionNumbers = args.alternateAccessionNumbers;

    updates.lastModifiedBy = userId;
    updates.lastModifiedAt = Date.now();

    await ctx.db.patch(args.collectionId, updates);

    // Handle moving between groups (update counts)
    if (args.collectionGroupId !== undefined && args.collectionGroupId !== collection.collectionGroupId) {
      // Decrement old group
      if (collection.collectionGroupId) {
        const oldGroup = await ctx.db.get(collection.collectionGroupId);
        if (oldGroup) {
          await ctx.db.patch(collection.collectionGroupId, {
            itemsCount: Math.max(0, (oldGroup.itemsCount || 0) - 1),
          });
        }
      }
      
      // Increment new group
      if (args.collectionGroupId) {
        const newGroup = await ctx.db.get(args.collectionGroupId);
        if (newGroup) {
          await ctx.db.patch(args.collectionGroupId, {
            itemsCount: (newGroup.itemsCount || 0) + 1,
          });
        }
      }
    }

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

    collection =
      allCollections.find((c) =>
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

    const alternateNumbers = collection.alternateAccessionNumbers ?? [];
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

    const alternateNumbers = collection.alternateAccessionNumbers ?? [];
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
    await requirePermission(ctx, collection.organizationId, "collections.read");

    return collection.accessionNumberHistory ?? [];
  },
});

/**
 * Get parent object for a collection
 */
export const getParentObject = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || !collection.parentObjectId) {
      return null;
    }

    const parent = await ctx.db.get(collection.parentObjectId);
    if (!parent) {
      return null;
    }

    return {
      _id: parent._id,
      title: parent.title,
      accessionNumber: parent.accessionNumber,
    };
  },
});

/**
 * Get child objects (objects that have this collection as parent)
 */
export const getChildObjects = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const children = await ctx.db
      .query("collections")
      .withIndex("by_parentObject", (q) =>
        q.eq("parentObjectId", args.collectionId),
      )
      .collect();

    return children.map((child) => ({
      _id: child._id,
      title: child.title,
      accessionNumber: child.accessionNumber,
      status: child.status,
    }));
  },
});
