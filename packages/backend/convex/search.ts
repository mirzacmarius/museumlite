import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx, query } from "./_generated/server";
import { hasPermission } from "./utils/permissions";

/**
 * Internal: Log search query performance metrics
 */
export const logSearchPerformance = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    queryType: v.string(),
    searchQuery: v.string(),
    durationMs: v.number(),
    resultCounts: v.object({
      objects: v.optional(v.number()),
      collectionGroups: v.optional(v.number()),
      loans: v.optional(v.number()),
      accounts: v.optional(v.number()),
      accessions: v.optional(v.number()),
      locations: v.optional(v.number()),
      total: v.optional(v.number()),
    }),
    isWithinThreshold: v.boolean(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    // Log to Convex logs for monitoring
    // In production, this could be sent to an external monitoring service
    const logData = {
      timestamp: new Date().toISOString(),
      organizationId: args.organizationId,
      queryType: args.queryType,
      searchQuery: args.searchQuery,
      durationMs: args.durationMs,
      resultCounts: args.resultCounts,
      isWithinThreshold: args.isWithinThreshold,
      performanceStatus: args.isWithinThreshold ? "OK" : "SLOW",
    };

    // Log performance data
    if (!args.isWithinThreshold) {
      // Log slow queries with warning
      console.log("[SEARCH_PERFORMANCE_WARNING]", JSON.stringify(logData));
    } else {
      // Log normal performance
      console.log("[SEARCH_PERFORMANCE]", JSON.stringify(logData));
    }

    return null;
  },
});

/**
 * Multi-field search helper for collections
 * Searches across title, accessionNumber, creator, alternativeTitle, and objectName fields
 * Combines results from multiple search strategies and deduplicates
 */
async function multiFieldSearch(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  searchQuery: string,
  limit: number,
): Promise<Array<Doc<"collections">>> {
  const lowerQuery = searchQuery.toLowerCase();

  // Search using the search index on title (primary search)
  const [titleResults, accessionResults, metadataResults] = await Promise.all([
    ctx.db
      .query("collections")
      .withSearchIndex("search_index", (q) =>
        q.search("title", searchQuery).eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q.eq("organizationId", organizationId),
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("accessionNumber"), searchQuery),
          q.gte(q.field("accessionNumber"), searchQuery),
        ),
      )
      .take(limit),
    ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .filter((q) =>
        q.or(
          // Search in creator field (case-insensitive prefix match)
          q.and(
            q.neq(q.field("creator"), undefined),
            q.or(
              q.gte(q.field("creator"), searchQuery),
              q.gte(q.field("creator"), lowerQuery),
              q.gte(
                q.field("creator"),
                searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1),
              ),
            ),
          ),
          // Search in alternative title
          q.and(
            q.neq(q.field("alternativeTitle"), undefined),
            q.or(
              q.gte(q.field("alternativeTitle"), searchQuery),
              q.gte(q.field("alternativeTitle"), lowerQuery),
            ),
          ),
          // Search in object name
          q.and(
            q.neq(q.field("objectName"), undefined),
            q.or(
              q.gte(q.field("objectName"), searchQuery),
              q.gte(q.field("objectName"), lowerQuery),
            ),
          ),
          // Search in object type
          q.and(
            q.neq(q.field("objectType"), undefined),
            q.or(
              q.gte(q.field("objectType"), searchQuery),
              q.gte(q.field("objectType"), lowerQuery),
            ),
          ),
          // Search in culture
          q.and(
            q.neq(q.field("culture"), undefined),
            q.or(
              q.gte(q.field("culture"), searchQuery),
              q.gte(q.field("culture"), lowerQuery),
            ),
          ),
        ),
      )
      .take(limit),
  ]);

  // Search accessionNumber using index - exact match and prefix match
  // Search other metadata fields using organization index with filters
  // This searches: creator, alternativeTitle, objectName, objectType, culture
  // Combine and deduplicate results using the same pattern as accounts search
  const seen = new Set<string>();
  const allResults = [
    ...titleResults,
    ...accessionResults,
    ...metadataResults,
  ].filter((obj) => {
    if (seen.has(obj._id)) return false;
    seen.add(obj._id);
    return true;
  });

  return allResults.slice(0, limit);
}

export const globalSearch = query({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    objects: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        status: v.string(),
      }),
    ),
    collectionGroups: v.array(
      v.object({
        _id: v.id("collectionGroups"),
        name: v.string(),
        itemsCount: v.optional(v.number()),
      }),
    ),
    loans: v.array(
      v.object({
        _id: v.id("loans"),
        loanNumber: v.string(),
        lenderBorrowerName: v.string(),
        type: v.string(),
        status: v.string(),
      }),
    ),
    accounts: v.array(
      v.object({
        _id: v.id("accounts"),
        accountNumber: v.string(),
        displayName: v.string(),
        accountType: v.optional(v.string()),
      }),
    ),
    accessions: v.array(
      v.object({
        _id: v.id("accessions"),
        accessionNumber: v.string(),
        method: v.string(),
        status: v.string(),
      }),
    ),
    locations: v.array(
      v.object({
        _id: v.id("locations"),
        name: v.string(),
        type: v.optional(v.string()),
      }),
    ),
    exhibitions: v.array(
      v.object({
        _id: v.id("exhibitions"),
        title: v.string(),
        status: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const _startTime = Date.now();
    const searchLimit = args.limit ?? 5;
    const searchQuery = args.query.trim();

    const emptyResults = {
      objects: [] as Array<{
        _id: Id<"collections">;
        title: string;
        accessionNumber: string;
        status: string;
      }>,
      collectionGroups: [] as Array<{
        _id: Id<"collectionGroups">;
        name: string;
        itemsCount?: number;
      }>,
      loans: [] as Array<{
        _id: Id<"loans">;
        loanNumber: string;
        lenderBorrowerName: string;
        type: string;
        status: string;
      }>,
      accounts: [] as Array<{
        _id: Id<"accounts">;
        accountNumber: string;
        displayName: string;
        accountType?: string;
      }>,
      accessions: [] as Array<{
        _id: Id<"accessions">;
        accessionNumber: string;
        method: string;
        status: string;
      }>,
      locations: [] as Array<{
        _id: Id<"locations">;
        name: string;
        type?: string;
      }>,
      exhibitions: [] as Array<{
        _id: Id<"exhibitions">;
        title: string;
        status?: string;
      }>,
    };

    if (searchQuery.length < 2) {
      return emptyResults;
    }

    const results = { ...emptyResults };

    const [
      canReadCollections,
      canReadLoans,
      canReadAccounts,
      canReadAccessions,
      canReadLocations,
    ] = await Promise.all([
      hasPermission(ctx, args.organizationId, "collections.read"),
      hasPermission(ctx, args.organizationId, "loans.read"),
      hasPermission(ctx, args.organizationId, "accounts.read"),
      hasPermission(ctx, args.organizationId, "collections.read"),
      hasPermission(ctx, args.organizationId, "locations.read"),
    ]);

    if (canReadCollections) {
      // Use multi-field search for collections to search across all metadata fields
      const objectResults = await multiFieldSearch(
        ctx,
        args.organizationId,
        searchQuery,
        searchLimit,
      );

      results.objects = objectResults.map((obj) => ({
        _id: obj._id,
        title: obj.title,
        accessionNumber: obj.accessionNumber,
        status: obj.status,
      }));

      const groupResults = await ctx.db
        .query("collectionGroups")
        .withSearchIndex("search_index", (q) =>
          q
            .search("name", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

      results.collectionGroups = groupResults.map((g) => ({
        _id: g._id,
        name: g.name,
        itemsCount: g.itemsCount,
      }));
    }

    if (canReadLoans) {
      const loanResults = await ctx.db
        .query("loans")
        .withSearchIndex("search_loans", (q) =>
          q
            .search("lenderBorrowerName", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

      results.loans = loanResults.map((loan) => ({
        _id: loan._id,
        loanNumber: loan.loanNumber,
        lenderBorrowerName: loan.lenderBorrowerName,
        type: loan.type,
        status: loan.status,
      }));
    }

    if (canReadAccounts) {
      const businessResults = await ctx.db
        .query("accounts")
        .withSearchIndex("search_accounts", (q) =>
          q
            .search("businessName", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

      const nameResults = await ctx.db
        .query("accounts")
        .withSearchIndex("search_accounts_by_name", (q) =>
          q
            .search("lastName", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

      const seen = new Set<string>();
      const allAccounts = [...businessResults, ...nameResults].filter((acc) => {
        if (seen.has(acc._id)) return false;
        seen.add(acc._id);
        return true;
      });

      results.accounts = allAccounts.slice(0, searchLimit).map((acc) => ({
        _id: acc._id,
        accountNumber: acc.accountNumber,
        displayName:
          acc.businessName ??
          `${acc.firstName ?? ""} ${acc.lastName ?? ""}`.trim(),
        accountType: acc.accountType,
      }));
    }

    if (canReadAccessions) {
      const accessionResults = await ctx.db
        .query("accessions")
        .withSearchIndex("search_accessions", (q) =>
          q
            .search("accessionNumber", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

      results.accessions = accessionResults.map((acc) => ({
        _id: acc._id,
        accessionNumber: acc.accessionNumber,
        method: acc.method,
        status: acc.status,
      }));
    }

    if (canReadLocations) {
      const locationResults = await ctx.db
        .query("locations")
        .withSearchIndex("search_locations", (q) =>
          q
            .search("name", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

      results.locations = locationResults.map((loc) => ({
        _id: loc._id,
        name: loc.name,
        type: loc.type,
      }));
    }

    return results;
  },
});

/**
 * Paginated search for collections with large result sets
 * Uses cursor-based pagination to efficiently handle many results
 */
export const paginatedSearchCollections = query({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        status: v.string(),
        creator: v.optional(v.string()),
        objectType: v.optional(v.string()),
        objectName: v.optional(v.string()),
        culture: v.optional(v.string()),
        _creationTime: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const _startTime = Date.now();
    const searchQuery = args.query.trim();

    if (searchQuery.length < 2) {
      return {
        page: [],
        isDone: true,
        continueCursor: "0",
      };
    }

    // Check permission
    const canReadCollections = await hasPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );

    if (!canReadCollections) {
      return {
        page: [],
        isDone: true,
        continueCursor: "0",
      };
    }

    // Use multi-field search to get all matching collections
    // We request more than needed to ensure we have enough for pagination
    const searchResults = await multiFieldSearch(
      ctx,
      args.organizationId,
      searchQuery,
      1000, // Fetch larger batch for pagination
    );

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      searchResults.length,
    );
    const page = searchResults.slice(startIndex, endIndex);

    return {
      page: page.map((obj) => ({
        _id: obj._id,
        title: obj.title,
        accessionNumber: obj.accessionNumber,
        status: obj.status,
        creator: obj.creator,
        objectType: obj.objectType,
        objectName: obj.objectName,
        culture: obj.culture,
        _creationTime: obj._creationTime,
      })),
      isDone: endIndex >= searchResults.length,
      continueCursor: String(endIndex),
    };
  },
});

/**
 * Search suggestions for auto-complete
 * Returns common search terms based on existing data
 * Pulls from titles, creators, object names, object types, cultures, and other searchable fields
 */
export const searchSuggestions = query({
  args: {
    organizationId: v.id("organizations"),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const _startTime = Date.now();
    const limit = args.limit ?? 10;
    const queryPrefix = args.query?.trim().toLowerCase() ?? "";
    const suggestions = new Set<string>();

    // Check if user has permission to read collections
    const canReadCollections = await hasPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );

    if (!canReadCollections) {
      return [];
    }

    // If no query prefix, return empty suggestions (require at least some input)
    if (queryPrefix.length < 1) {
      return [];
    }

    // Get collections to extract suggestions from various fields
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100); // Sample from recent items

    for (const item of collections) {
      // Add title suggestions
      if (item.title?.toLowerCase().includes(queryPrefix)) {
        suggestions.add(item.title);
      }

      // Add creator suggestions
      if (item.creator?.toLowerCase().includes(queryPrefix)) {
        suggestions.add(item.creator);
      }

      // Add object name suggestions
      if (item.objectName?.toLowerCase().includes(queryPrefix)) {
        suggestions.add(item.objectName);
      }

      // Add object type suggestions
      if (item.objectType?.toLowerCase().includes(queryPrefix)) {
        suggestions.add(item.objectType);
      }

      // Add culture suggestions
      if (item.culture?.toLowerCase().includes(queryPrefix)) {
        suggestions.add(item.culture);
      }

      // Add alternative title suggestions
      if (item.alternativeTitle?.toLowerCase().includes(queryPrefix)) {
        suggestions.add(item.alternativeTitle);
      }

      // Stop if we have enough suggestions
      if (suggestions.size >= limit * 2) {
        break;
      }
    }

    // Convert to array, sort by relevance (prefix matches first), and limit
    const sortedSuggestions = Array.from(suggestions)
      .sort((a, b) => {
        const aStartsWith = a.toLowerCase().startsWith(queryPrefix);
        const bStartsWith = b.toLowerCase().startsWith(queryPrefix);

        // Prefix matches come first
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Then sort alphabetically
        return a.localeCompare(b);
      })
      .slice(0, limit);

    return sortedSuggestions;
  },
});
