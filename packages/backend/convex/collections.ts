import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
// Note: customFieldValue, provenanceChainEntry, shippingLogEntry are defined in schema
// but return validators use v.any() to allow for existing data that may not match strict types
import { getNextCounterValue } from "./utils/accessionCounter";
import { accessionParser } from "./utils/accessionNumberParser";
import {
  enforceObjectQuota,
  hasFeatureAccess,
  requireFeatureAccess,
  requireModuleEnabled,
} from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

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
    alternativeTitle: v.optional(v.string()),
    creator: v.optional(v.string()),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    technique: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    dimensionHeight: v.optional(v.number()),
    dimensionWidth: v.optional(v.number()),
    dimensionDepth: v.optional(v.number()),
    dimensionWeight: v.optional(v.number()),
    dimensionUnit: v.optional(v.string()),
    weightUnit: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    inscriptions: v.optional(v.string()),
    inscriptionMarks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          description: v.string(),
        }),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
    ownershipHistory: v.optional(
      v.array(
        v.object({
          owner: v.string(),
          startYear: v.optional(v.string()),
          endYear: v.optional(v.string()),
          description: v.optional(v.string()),
          verified: v.optional(v.boolean()),
          verificationSource: v.optional(v.string()),
        }),
      ),
    ),
    donated_by: v.optional(v.array(v.string())),
    donated_date: v.optional(v.string()),
    donation_info: v.optional(v.string()),
    creditLine: v.optional(v.string()),
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
    isPubliclyVisible: v.optional(v.boolean()),
    isHighResDownloadable: v.optional(v.boolean()),
    isSearchable: v.optional(v.boolean()),
    isValuationVisible: v.optional(v.boolean()),
    publicSlug: v.optional(v.string()),
    displayStatus: v.optional(v.string()),
    collectionType: v.optional(
      v.union(
        v.literal("fine_art"),
        v.literal("wine"),
        v.literal("automotive"),
        v.literal("natural_history"),
        v.literal("archive"),
        v.literal("general"),
      ),
    ),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.create");

    await enforceObjectQuota(ctx, args.organizationId);

    if (args.collectionType && args.collectionType !== "general") {
      await requireModuleEnabled(ctx, args.organizationId, args.collectionType);
    }

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
      alternativeTitle: args.alternativeTitle,
      creator: args.creator,
      objectType: args.objectType,
      objectName: args.objectName,
      culture: args.culture,
      period: args.period,
      dateCreated: args.dateCreated,
      materials: args.materials,
      technique: args.technique,
      dimensions: args.dimensions,
      dimensionHeight: args.dimensionHeight,
      dimensionWidth: args.dimensionWidth,
      dimensionDepth: args.dimensionDepth,
      dimensionWeight: args.dimensionWeight,
      dimensionUnit: args.dimensionUnit,
      weightUnit: args.weightUnit,
      description: args.description,
      condition: args.condition,
      inscriptions: args.inscriptions,
      inscriptionMarks: args.inscriptionMarks,
      tags: args.tags,
      provenance: args.provenance,
      exhibitionHistory: args.exhibitionHistory,
      ownershipHistory: args.ownershipHistory,
      donated_by: args.donated_by,
      donated_date: args.donated_date,
      donation_info: args.donation_info,
      creditLine: args.creditLine,
      previous_owners: args.previous_owners,
      links: args.links,
      parentObjectId: args.parentObjectId,
      currentLocationId: args.currentLocationId,
      alternateAccessionNumbers: args.alternateAccessionNumbers,
      acquisitionMethod: args.acquisitionMethod,
      legalRestrictions: args.legalRestrictions,
      isPubliclyVisible: args.isPubliclyVisible,
      isHighResDownloadable: args.isHighResDownloadable,
      isSearchable: args.isSearchable,
      isValuationVisible: args.isValuationVisible,
      publicSlug: args.publicSlug,
      displayStatus: args.displayStatus,
      collectionType: args.collectionType,
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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_collection",
      entityType: "collection",
      entityId: collectionId,
      changes: {
        accessionNumber,
        title: args.title,
        collectionType: args.collectionType,
      },
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
      alternativeTitle: v.optional(v.string()),
      creator: v.optional(v.string()),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      dimensionHeight: v.optional(v.number()),
      dimensionWidth: v.optional(v.number()),
      dimensionDepth: v.optional(v.number()),
      dimensionWeight: v.optional(v.number()),
      dimensionUnit: v.optional(v.string()),
      weightUnit: v.optional(v.string()),
      description: v.optional(v.string()),
      condition: v.optional(v.string()),
      inscriptions: v.optional(v.string()),
      inscriptionMarks: v.optional(
        v.array(
          v.object({
            label: v.string(),
            description: v.string(),
          }),
        ),
      ),
      tags: v.optional(v.array(v.string())),
      provenance: v.optional(v.string()),
      exhibitionHistory: v.optional(v.string()),
      ownershipHistory: v.optional(
        v.array(
          v.object({
            owner: v.string(),
            startYear: v.optional(v.string()),
            endYear: v.optional(v.string()),
            description: v.optional(v.string()),
            verified: v.optional(v.boolean()),
            verificationSource: v.optional(v.string()),
          }),
        ),
      ),
      donated_by: v.optional(v.array(v.string())),
      donated_date: v.optional(v.string()),
      donation_info: v.optional(v.string()),
      creditLine: v.optional(v.string()),
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
      acquisitionMethod: v.optional(v.string()),
      legalRestrictions: v.optional(v.boolean()),
      isPubliclyVisible: v.optional(v.boolean()),
      isHighResDownloadable: v.optional(v.boolean()),
      isSearchable: v.optional(v.boolean()),
      isValuationVisible: v.optional(v.boolean()),
      publicSlug: v.optional(v.string()),
      displayStatus: v.optional(v.string()),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
        v.literal("archived"),
        v.literal("deleted"),
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

export const getWithModuleDetails = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      collection: v.object({
        _id: v.id("collections"),
        organizationId: v.id("organizations"),
        accessionNumber: v.string(),
        title: v.string(),
        collectionType: v.optional(
          v.union(
            v.literal("fine_art"),
            v.literal("wine"),
            v.literal("automotive"),
            v.literal("natural_history"),
            v.literal("archive"),
            v.literal("general"),
          ),
        ),
        customFields: v.optional(v.record(v.string(), v.any())),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
        _creationTime: v.number(),
      }),
      moduleDetails: v.union(
        v.object({
          type: v.literal("fine_art"),
          data: v.object({
            _id: v.id("fineArtDetails"),
            appraisedValue: v.optional(v.number()),
            replacementValue: v.optional(v.number()),
            insurancePolicyNumber: v.optional(v.string()),
            reappraisalDate: v.optional(v.number()),
            displayStatus: v.optional(v.string()),
            provenanceChain: v.optional(v.any()),
            shippingLogs: v.optional(v.any()),
          }),
        }),
        v.object({
          type: v.literal("wine"),
          data: v.object({
            _id: v.id("wineDetails"),
            vintage: v.optional(v.number()),
            peakWindowStart: v.optional(v.number()),
            peakWindowEnd: v.optional(v.number()),
            binNumber: v.optional(v.string()),
            producer: v.optional(v.string()),
            fillLevel: v.optional(v.string()),
          }),
        }),
        v.object({
          type: v.literal("automotive"),
          data: v.object({
            _id: v.id("vehicleDetails"),
            vin: v.optional(v.string()),
            make: v.optional(v.string()),
            model: v.optional(v.string()),
            year: v.optional(v.number()),
            odometer: v.optional(v.number()),
          }),
        }),
        v.object({
          type: v.literal("natural_history"),
          data: v.object({
            _id: v.id("naturalHistoryDetails"),
            scientificName: v.optional(v.string()),
            commonName: v.optional(v.string()),
            kingdom: v.optional(v.string()),
            genus: v.optional(v.string()),
            species: v.optional(v.string()),
            latitude: v.optional(v.number()),
            longitude: v.optional(v.number()),
          }),
        }),
        v.object({
          type: v.literal("archive"),
          data: v.object({
            _id: v.id("archiveDetails"),
            documentType: v.optional(v.string()),
            retentionExpiresAt: v.optional(v.number()),
            flaggedForDestruction: v.optional(v.boolean()),
            legalHold: v.optional(v.boolean()),
            confidentialityLevel: v.optional(v.string()),
          }),
        }),
        v.null(),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    await requirePermission(ctx, collection.organizationId, "collections.view");

    const collectionType = collection.collectionType;
    type ModuleDetails =
      | {
          type: "fine_art";
          data: {
            _id: Id<"fineArtDetails">;
            displayStatus?: string;
            appraisedValue?: number;
            replacementValue?: number;
            insurancePolicyNumber?: string;
            reappraisalDate?: number;
            provenanceChain?: unknown;
            shippingLogs?: unknown;
          };
        }
      | {
          type: "wine";
          data: {
            _id: Id<"wineDetails">;
            vintage?: number;
            peakWindowStart?: number;
            peakWindowEnd?: number;
            binNumber?: string;
            producer?: string;
            fillLevel?: string;
          };
        }
      | {
          type: "automotive";
          data: {
            _id: Id<"vehicleDetails">;
            vin?: string;
            make?: string;
            model?: string;
            year?: number;
            odometer?: number;
          };
        }
      | {
          type: "natural_history";
          data: {
            _id: Id<"naturalHistoryDetails">;
            scientificName?: string;
            commonName?: string;
            kingdom?: string;
            genus?: string;
            species?: string;
            latitude?: number;
            longitude?: number;
          };
        }
      | {
          type: "archive";
          data: {
            _id: Id<"archiveDetails">;
            documentType?: string;
            retentionExpiresAt?: number;
            flaggedForDestruction?: boolean;
            legalHold?: boolean;
            confidentialityLevel?: string;
          };
        }
      | null;
    let moduleDetails: ModuleDetails = null;

    if (collectionType === "fine_art") {
      await requireModuleEnabled(ctx, collection.organizationId, "fine_art");
      const details = await ctx.db
        .query("fineArtDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "fine_art",
          data: {
            _id: details._id,
            appraisedValue: details.appraisedValue,
            replacementValue: details.replacementValue,
            insurancePolicyNumber: details.insurancePolicyNumber,
            reappraisalDate: details.reappraisalDate,
            displayStatus: details.displayStatus,
            provenanceChain: details.provenanceChain,
            shippingLogs: details.shippingLogs,
          },
        };
      }
    } else if (collectionType === "wine") {
      await requireModuleEnabled(ctx, collection.organizationId, "wine");
      const details = await ctx.db
        .query("wineDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "wine",
          data: {
            _id: details._id,
            vintage: details.vintage,
            peakWindowStart: details.peakWindowStart,
            peakWindowEnd: details.peakWindowEnd,
            binNumber: details.binNumber,
            producer: details.producer,
            fillLevel: details.fillLevel,
          },
        };
      }
    } else if (collectionType === "automotive") {
      await requireModuleEnabled(ctx, collection.organizationId, "automotive");
      const details = await ctx.db
        .query("vehicleDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "automotive",
          data: {
            _id: details._id,
            vin: details.vin,
            make: details.make,
            model: details.model,
            year: details.year,
            odometer: details.odometer,
          },
        };
      }
    } else if (collectionType === "natural_history") {
      await requireModuleEnabled(
        ctx,
        collection.organizationId,
        "natural_history",
      );
      const details = await ctx.db
        .query("naturalHistoryDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "natural_history",
          data: {
            _id: details._id,
            scientificName: details.scientificName,
            commonName: details.commonName,
            kingdom: details.kingdom,
            genus: details.genus,
            species: details.species,
            latitude: details.latitude,
            longitude: details.longitude,
          },
        };
      }
    } else if (collectionType === "archive") {
      await requireModuleEnabled(ctx, collection.organizationId, "archive");
      const details = await ctx.db
        .query("archiveDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "archive",
          data: {
            _id: details._id,
            documentType: details.documentType,
            retentionExpiresAt: details.retentionExpiresAt,
            flaggedForDestruction: details.flaggedForDestruction,
            legalHold: details.legalHold,
            confidentialityLevel: details.confidentialityLevel,
          },
        };
      }
    }

    return {
      collection: {
        _id: collection._id,
        organizationId: collection.organizationId,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        collectionType: collection.collectionType,
        customFields: collection.customFields,
        status: collection.status,
        _creationTime: collection._creationTime,
      },
      moduleDetails,
    };
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
        v.literal("archived"),
        v.literal("deleted"),
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
          v.literal("archived"),
          v.literal("deleted"),
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
      status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
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
      const searchQuery = ctx.db
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
        searchResults = searchResults.filter(
          (c) => c.status !== "deaccessioned",
        );
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
      allResults = allResults.filter(
        (c) => c.collectionGroupId === args.collectionGroupId,
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
      ? Number.parseInt(args.paginationOpts.cursor, 10)
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
        v.literal("archived"),
        v.literal("deleted"),
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
          v.literal("archived"),
          v.literal("deleted"),
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
    const searchQuery = ctx.db
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
    alternativeTitle: v.optional(v.string()),
    creator: v.optional(v.string()),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    technique: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    dimensionHeight: v.optional(v.number()),
    dimensionWidth: v.optional(v.number()),
    dimensionDepth: v.optional(v.number()),
    dimensionWeight: v.optional(v.number()),
    dimensionUnit: v.optional(v.string()),
    weightUnit: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    inscriptions: v.optional(v.string()),
    inscriptionMarks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          description: v.string(),
        }),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
    ownershipHistory: v.optional(
      v.array(
        v.object({
          owner: v.string(),
          startYear: v.optional(v.string()),
          endYear: v.optional(v.string()),
          description: v.optional(v.string()),
          verified: v.optional(v.boolean()),
          verificationSource: v.optional(v.string()),
        }),
      ),
    ),
    donated_by: v.optional(v.array(v.string())),
    donated_date: v.optional(v.string()),
    donation_info: v.optional(v.string()),
    creditLine: v.optional(v.string()),
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
    isPubliclyVisible: v.optional(v.boolean()),
    isHighResDownloadable: v.optional(v.boolean()),
    isSearchable: v.optional(v.boolean()),
    isValuationVisible: v.optional(v.boolean()),
    publicSlug: v.optional(v.string()),
    displayStatus: v.optional(v.string()),
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

    // Build update object - using any to avoid verbose type definition
    const updates: Record<string, unknown> = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.alternativeTitle !== undefined)
      updates.alternativeTitle = args.alternativeTitle;
    if (args.collectionGroupId !== undefined)
      updates.collectionGroupId = args.collectionGroupId;
    if (args.creator !== undefined) updates.creator = args.creator;
    if (args.objectType !== undefined) updates.objectType = args.objectType;
    if (args.objectName !== undefined) updates.objectName = args.objectName;
    if (args.culture !== undefined) updates.culture = args.culture;
    if (args.period !== undefined) updates.period = args.period;
    if (args.dateCreated !== undefined) updates.dateCreated = args.dateCreated;
    if (args.materials !== undefined) updates.materials = args.materials;
    if (args.technique !== undefined) updates.technique = args.technique;
    if (args.dimensions !== undefined) updates.dimensions = args.dimensions;
    if (args.dimensionHeight !== undefined)
      updates.dimensionHeight = args.dimensionHeight;
    if (args.dimensionWidth !== undefined)
      updates.dimensionWidth = args.dimensionWidth;
    if (args.dimensionDepth !== undefined)
      updates.dimensionDepth = args.dimensionDepth;
    if (args.dimensionWeight !== undefined)
      updates.dimensionWeight = args.dimensionWeight;
    if (args.dimensionUnit !== undefined)
      updates.dimensionUnit = args.dimensionUnit;
    if (args.weightUnit !== undefined) updates.weightUnit = args.weightUnit;
    if (args.description !== undefined) updates.description = args.description;
    if (args.condition !== undefined) updates.condition = args.condition;
    if (args.inscriptions !== undefined)
      updates.inscriptions = args.inscriptions;
    if (args.inscriptionMarks !== undefined)
      updates.inscriptionMarks = args.inscriptionMarks;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.provenance !== undefined) updates.provenance = args.provenance;
    if (args.exhibitionHistory !== undefined)
      updates.exhibitionHistory = args.exhibitionHistory;
    if (args.ownershipHistory !== undefined)
      updates.ownershipHistory = args.ownershipHistory;
    if (args.donated_by !== undefined) updates.donated_by = args.donated_by;
    if (args.donated_date !== undefined)
      updates.donated_date = args.donated_date;
    if (args.donation_info !== undefined)
      updates.donation_info = args.donation_info;
    if (args.creditLine !== undefined) updates.creditLine = args.creditLine;
    if (args.previous_owners !== undefined)
      updates.previous_owners = args.previous_owners;
    if (args.links !== undefined) updates.links = args.links;
    if (args.parentObjectId !== undefined)
      updates.parentObjectId = args.parentObjectId;
    if (args.currentLocationId !== undefined)
      updates.currentLocationId = args.currentLocationId;
    if (args.alternateAccessionNumbers !== undefined)
      updates.alternateAccessionNumbers = args.alternateAccessionNumbers;
    if (args.acquisitionMethod !== undefined)
      updates.acquisitionMethod = args.acquisitionMethod;
    if (args.legalRestrictions !== undefined)
      updates.legalRestrictions = args.legalRestrictions;
    if (args.isPubliclyVisible !== undefined)
      updates.isPubliclyVisible = args.isPubliclyVisible;
    if (args.isHighResDownloadable !== undefined)
      updates.isHighResDownloadable = args.isHighResDownloadable;
    if (args.isSearchable !== undefined)
      updates.isSearchable = args.isSearchable;
    if (args.isValuationVisible !== undefined)
      updates.isValuationVisible = args.isValuationVisible;
    if (args.publicSlug !== undefined) updates.publicSlug = args.publicSlug;
    if (args.displayStatus !== undefined)
      updates.displayStatus = args.displayStatus;

    updates.lastModifiedBy = userId;
    updates.lastModifiedAt = Date.now();

    await ctx.db.patch(args.collectionId, updates);

    // Handle moving between groups (update counts)
    if (
      args.collectionGroupId !== undefined &&
      args.collectionGroupId !== collection.collectionGroupId
    ) {
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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "updated_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: updates,
    });

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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "deaccessioned_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        previousStatus: collection.status,
      },
    });

    return null;
  },
});

/**
 * Archive collection - hides from normal views but preserves all data
 */
export const archiveCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    reason: v.string(),
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

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.delete",
    );

    if (collection.status === "loaned") {
      throw new Error("Cannot archive an object that is currently on loan");
    }

    await ctx.db.patch(args.collectionId, {
      status: "archived",
      archivedAt: Date.now(),
      archivedBy: userId,
      archivedReason: args.reason,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "archived_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        reason: args.reason,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
    });

    return null;
  },
});

/**
 * Soft delete collection - moves to trash, can be permanently deleted later
 */
export const softDeleteCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    reason: v.string(),
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

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.delete",
    );

    if (collection.status === "loaned") {
      throw new Error("Cannot delete an object that is currently on loan");
    }

    await ctx.db.patch(args.collectionId, {
      status: "deleted",
      deletedAt: Date.now(),
      deletedBy: userId,
      deletedReason: args.reason,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "deleted_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        reason: args.reason,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
    });

    return null;
  },
});

/**
 * Restore collection from archived or deleted status
 */
export const restoreCollection = mutation({
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

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.write",
    );

    if (collection.status !== "archived" && collection.status !== "deleted") {
      throw new Error("Can only restore archived or deleted objects");
    }

    await ctx.db.patch(args.collectionId, {
      status: "active",
      archivedAt: undefined,
      archivedBy: undefined,
      archivedReason: undefined,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "restored_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        previousStatus: collection.status,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
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
        v.literal("archived"),
        v.literal("deleted"),
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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "added_alternate_accession_number",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        addedNumber: args.accessionNumber,
        primaryAccessionNumber: collection.accessionNumber,
      },
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

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "removed_alternate_accession_number",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        removedNumber: args.accessionNumber,
        primaryAccessionNumber: collection.accessionNumber,
      },
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
        v.literal("archived"),
        v.literal("deleted"),
      ),
      thumbnailUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const children = await ctx.db
      .query("collections")
      .withIndex("by_parentObject", (q) =>
        q.eq("parentObjectId", args.collectionId),
      )
      .collect();

    const results = await Promise.all(
      children.map(async (child) => {
        // Get primary image for thumbnail
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", child._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | null = null;
        if (primaryMedia?.storageId) {
          thumbnailUrl = await ctx.storage.getUrl(primaryMedia.storageId);
        }

        return {
          _id: child._id,
          title: child.title,
          accessionNumber: child.accessionNumber,
          status: child.status,
          thumbnailUrl,
        };
      }),
    );

    return results;
  },
});

/**
 * Get sibling objects (objects that share the same parent)
 */
export const getSiblingObjects = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
      thumbnailUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || !collection.parentObjectId) {
      return [];
    }

    const siblings = await ctx.db
      .query("collections")
      .withIndex("by_parentObject", (q) =>
        q.eq("parentObjectId", collection.parentObjectId),
      )
      .collect();

    // Filter out the current collection and get thumbnails
    const results = await Promise.all(
      siblings
        .filter((s) => s._id !== args.collectionId)
        .slice(0, 5) // Limit to 5 siblings
        .map(async (sibling) => {
          // Get primary image for thumbnail
          const primaryMedia = await ctx.db
            .query("mediaFiles")
            .withIndex("by_collection", (q) =>
              q.eq("collectionId", sibling._id),
            )
            .filter((q) => q.eq(q.field("isPrimary"), true))
            .first();

          let thumbnailUrl: string | null = null;
          if (primaryMedia?.storageId) {
            thumbnailUrl = await ctx.storage.getUrl(primaryMedia.storageId);
          }

          return {
            _id: sibling._id,
            title: sibling.title,
            accessionNumber: sibling.accessionNumber,
            thumbnailUrl,
          };
        }),
    );

    return results;
  },
});

/**
 * Get parent object with thumbnail
 */
export const getParentObjectWithThumbnail = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
      thumbnailUrl: v.union(v.string(), v.null()),
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

    // Get primary image for thumbnail
    const primaryMedia = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) => q.eq("collectionId", parent._id))
      .filter((q) => q.eq(q.field("isPrimary"), true))
      .first();

    let thumbnailUrl: string | null = null;
    if (primaryMedia?.storageId) {
      thumbnailUrl = await ctx.storage.getUrl(primaryMedia.storageId);
    }

    return {
      _id: parent._id,
      title: parent.title,
      accessionNumber: parent.accessionNumber,
      thumbnailUrl,
    };
  },
});

export const bulkUpdateLocation = mutation({
  args: {
    collectionIds: v.array(v.id("collections")),
    locationId: v.id("locations"),
  },
  returns: v.object({
    updated: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let updated = 0;
    let failed = 0;

    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection) {
        failed++;
        continue;
      }

      try {
        await requirePermission(
          ctx,
          collection.organizationId,
          "collections.update",
        );

        await ctx.db.patch(collectionId, {
          currentLocationId: args.locationId,
          lastModifiedBy: userId,
          lastModifiedAt: Date.now(),
        });
        updated++;
      } catch {
        failed++;
      }
    }

    return { updated, failed };
  },
});

export const bulkDeaccession = mutation({
  args: {
    collectionIds: v.array(v.id("collections")),
    reason: v.string(),
  },
  returns: v.object({
    deaccessioned: v.number(),
    failed: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let deaccessioned = 0;
    let failed = 0;
    let skipped = 0;

    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection) {
        failed++;
        continue;
      }

      if (collection.status === "deaccessioned") {
        skipped++;
        continue;
      }

      if (collection.status === "loaned") {
        failed++;
        continue;
      }

      try {
        await requirePermission(
          ctx,
          collection.organizationId,
          "collections.delete",
        );

        await ctx.db.patch(collectionId, {
          status: "deaccessioned",
          lastModifiedBy: userId,
          lastModifiedAt: Date.now(),
        });

        await ctx.db.insert("auditLog", {
          organizationId: collection.organizationId,
          userId,
          action: "deaccessioned",
          entityType: "collection",
          entityId: collectionId,
          changes: { reason: args.reason, bulk: true },
          timestamp: Date.now(),
        });

        deaccessioned++;
      } catch {
        failed++;
      }
    }

    return { deaccessioned, failed, skipped };
  },
});

export const bulkExport = query({
  args: {
    collectionIds: v.array(v.id("collections")),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      alternativeTitle: v.optional(v.string()),
      creator: v.optional(v.string()),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      condition: v.optional(v.string()),
      provenance: v.optional(v.string()),
      status: v.string(),
      locationPath: v.optional(v.string()),
      collectionGroup: v.optional(v.string()),
      catalogedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results: Array<{
      _id: Id<"collections">;
      accessionNumber: string;
      title: string;
      alternativeTitle?: string;
      creator?: string;
      objectType?: string;
      objectName?: string;
      culture?: string;
      period?: string;
      dateCreated?: string;
      materials?: string;
      technique?: string;
      dimensions?: string;
      description?: string;
      condition?: string;
      provenance?: string;
      status: string;
      locationPath?: string;
      collectionGroup?: string;
      catalogedAt: number;
    }> = [];

    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection) continue;

      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.read",
      );

      let locationPath: string | undefined;
      if (collection.currentLocationId) {
        const locationNames: Array<string> = [];
        let currentId: Id<"locations"> | undefined =
          collection.currentLocationId;
        while (currentId) {
          const loc: Doc<"locations"> | null = await ctx.db.get(currentId);
          if (!loc) break;
          locationNames.unshift(loc.name);
          currentId = loc.parentLocationId;
        }
        locationPath = locationNames.join(" > ");
      }

      let collectionGroup: string | undefined;
      if (collection.collectionGroupId) {
        const group = await ctx.db.get(collection.collectionGroupId);
        collectionGroup = group?.name;
      }

      results.push({
        _id: collection._id,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        alternativeTitle: collection.alternativeTitle,
        creator: collection.creator,
        objectType: collection.objectType,
        objectName: collection.objectName,
        culture: collection.culture,
        period: collection.period,
        dateCreated: collection.dateCreated,
        materials: collection.materials,
        technique: collection.technique,
        dimensions: collection.dimensions,
        description: collection.description,
        condition: collection.condition,
        provenance: collection.provenance,
        status: collection.status,
        locationPath,
        collectionGroup,
        catalogedAt: collection.catalogedAt,
      });
    }

    return results;
  },
});

export const listPublic = query({
  args: {
    organizationSlug: v.string(),
    search: v.optional(v.string()),
    objectType: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        _id: v.id("collections"),
        accessionNumber: v.string(),
        title: v.string(),
        creator: v.optional(v.string()),
        objectType: v.optional(v.string()),
        culture: v.optional(v.string()),
        period: v.optional(v.string()),
        dateCreated: v.optional(v.string()),
        materials: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        description: v.optional(v.string()),
        creditLine: v.optional(v.string()),
        primaryImageUrl: v.optional(v.string()),
      }),
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.organizationSlug))
      .unique();

    if (!organization) {
      return { items: [], nextCursor: undefined, hasMore: false };
    }

    await requireFeatureAccess(ctx, organization._id, "public_portal");

    const pageSize = args.limit ?? 24;
    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", "active"),
      )
      .collect();

    let filtered = allCollections.filter((c) => c.isPubliclyVisible === true);

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.isSearchable !== false &&
          (c.title.toLowerCase().includes(searchLower) ||
            c.creator?.toLowerCase().includes(searchLower) ||
            c.accessionNumber.toLowerCase().includes(searchLower)),
      );
    }

    if (args.objectType) {
      filtered = filtered.filter((c) => c.objectType === args.objectType);
    }
    if (args.culture) {
      filtered = filtered.filter((c) => c.culture === args.culture);
    }
    if (args.period) {
      filtered = filtered.filter((c) => c.period === args.period);
    }

    const startIndex = args.cursor ? Number.parseInt(args.cursor, 10) : 0;
    const paged = filtered.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < filtered.length;

    const items = await Promise.all(
      paged.map(async (c) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let primaryImageUrl: string | undefined;
        if (primaryMedia?.storageId) {
          primaryImageUrl =
            (await ctx.storage.getUrl(primaryMedia.storageId)) ?? undefined;
        }

        return {
          _id: c._id,
          accessionNumber: c.accessionNumber,
          title: c.title,
          creator: c.creator,
          objectType: c.objectType,
          culture: c.culture,
          period: c.period,
          dateCreated: c.dateCreated,
          materials: c.materials,
          dimensions: c.dimensions,
          description: c.description,
          creditLine: c.creditLine,
          primaryImageUrl,
        };
      }),
    );

    return {
      items,
      nextCursor: hasMore ? String(startIndex + pageSize) : undefined,
      hasMore,
    };
  },
});

export const getPublic = query({
  args: {
    organizationSlug: v.string(),
    accessionNumber: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      alternativeTitle: v.optional(v.string()),
      creator: v.optional(v.string()),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      inscriptions: v.optional(v.string()),
      provenance: v.optional(v.string()),
      exhibitionHistory: v.optional(v.string()),
      creditLine: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      isHighResDownloadable: v.optional(v.boolean()),
      valuation: v.optional(
        v.object({
          appraisedValue: v.optional(v.number()),
          replacementValue: v.optional(v.number()),
          lastAppraisalDate: v.optional(v.number()),
          appraiser: v.optional(v.string()),
        }),
      ),
      images: v.array(
        v.object({
          _id: v.id("mediaFiles"),
          url: v.string(),
          isPrimary: v.boolean(),
          caption: v.optional(v.string()),
        }),
      ),
      organizationName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.organizationSlug))
      .unique();

    if (!organization) {
      return null;
    }

    await requireFeatureAccess(ctx, organization._id, "public_portal");

    let collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("accessionNumber", args.accessionNumber),
      )
      .unique();

    if (!collection) {
      collection = await ctx.db
        .query("collections")
        .withIndex("by_organization_and_publicSlug", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("publicSlug", args.accessionNumber),
        )
        .unique();
    }

    if (
      !collection ||
      !collection.isPubliclyVisible ||
      collection.status !== "active"
    ) {
      return null;
    }

    const mediaFiles = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
      .collect();

    const images = await Promise.all(
      mediaFiles.map(async (m) => {
        const url = m.storageId ? await ctx.storage.getUrl(m.storageId) : null;
        return url
          ? {
              _id: m._id,
              url,
              isPrimary: m.isPrimary ?? false,
              caption: m.caption,
            }
          : null;
      }),
    );

    let valuation:
      | {
          appraisedValue?: number;
          replacementValue?: number;
          lastAppraisalDate?: number;
          appraiser?: string;
        }
      | undefined;

    if (collection.isValuationVisible) {
      const fineArtDetails = await ctx.db
        .query("fineArtDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();

      if (fineArtDetails) {
        valuation = {
          appraisedValue: fineArtDetails.appraisedValue,
          replacementValue: fineArtDetails.replacementValue,
          lastAppraisalDate: fineArtDetails.lastAppraisalDate,
          appraiser: fineArtDetails.appraiser,
        };
      }
    }

    return {
      _id: collection._id,
      accessionNumber: collection.accessionNumber,
      title: collection.title,
      alternativeTitle: collection.alternativeTitle,
      creator: collection.creator,
      objectType: collection.objectType,
      objectName: collection.objectName,
      culture: collection.culture,
      period: collection.period,
      dateCreated: collection.dateCreated,
      materials: collection.materials,
      technique: collection.technique,
      dimensions: collection.dimensions,
      description: collection.description,
      inscriptions: collection.inscriptions,
      provenance: collection.provenance,
      exhibitionHistory: collection.exhibitionHistory,
      creditLine: collection.creditLine,
      tags: collection.tags,
      isHighResDownloadable: collection.isHighResDownloadable,
      valuation,
      images: images.filter((i): i is NonNullable<typeof i> => i !== null),
      organizationName: organization.name,
    };
  },
});

export const getPublicFilters = query({
  args: {
    organizationSlug: v.string(),
  },
  returns: v.object({
    objectTypes: v.array(v.string()),
    cultures: v.array(v.string()),
    periods: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.organizationSlug))
      .unique();

    if (!organization) {
      return { objectTypes: [], cultures: [], periods: [] };
    }

    await requireFeatureAccess(ctx, organization._id, "public_portal");

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .collect();

    const publicCollections = collections.filter(
      (c) => c.isPubliclyVisible === true && c.status === "active",
    );

    const objectTypes = [
      ...new Set(publicCollections.map((c) => c.objectType).filter(Boolean)),
    ] as string[];
    const cultures = [
      ...new Set(publicCollections.map((c) => c.culture).filter(Boolean)),
    ] as string[];
    const periods = [
      ...new Set(publicCollections.map((c) => c.period).filter(Boolean)),
    ] as string[];

    return {
      objectTypes: objectTypes.sort(),
      cultures: cultures.sort(),
      periods: periods.sort(),
    };
  },
});

export const listPublicForSitemap = query({
  args: {},
  returns: v.array(
    v.object({
      organizationSlug: v.string(),
      urlSlug: v.string(),
      title: v.string(),
      lastModifiedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    const results: {
      organizationSlug: string;
      urlSlug: string;
      title: string;
      lastModifiedAt?: number;
    }[] = [];

    for (const org of organizations) {
      const hasPortal = await hasFeatureAccess(ctx, org._id, "public_portal");
      if (!hasPortal) {
        continue;
      }

      const collections = await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();

      const publicCollections = collections.filter(
        (c) => c.isPubliclyVisible === true && c.status === "active",
      );

      for (const c of publicCollections) {
        results.push({
          organizationSlug: org.slug,
          urlSlug: c.publicSlug || c.accessionNumber,
          title: c.title,
          lastModifiedAt: c.lastModifiedAt,
        });
      }
    }

    return results;
  },
});
