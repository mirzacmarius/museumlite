import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx, query } from "./_generated/server";
import { searchIdentifierPrefix } from "./utils/identifiers";
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

type ObjectSearchField =
  | "title"
  | "alternativeTitle"
  | "creator"
  | "objectName";

const OBJECT_SEARCH_INDEXES = [
  { field: "title", index: "search_index" },
  { field: "alternativeTitle", index: "search_alternativeTitle" },
  { field: "creator", index: "search_creator" },
  { field: "objectName", index: "search_objectName" },
] as const satisfies ReadonlyArray<{ field: ObjectSearchField; index: string }>;

/**
 * Object search with an explicit scope: identifier prefix matches first, then
 * indexed word matches on title, alternative title, creator and object name.
 * Deleted legacy records are excluded; archived and deaccessioned records stay
 * findable with their status.
 */
async function searchObjects(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  searchQuery: string,
  limit: number,
) {
  const [identifierMatches, ...textMatches] = await Promise.all([
    searchIdentifierPrefix(ctx, organizationId, "catalog", searchQuery, limit),
    ...OBJECT_SEARCH_INDEXES.map(({ field, index }) =>
      ctx.db
        .query("collections")
        .withSearchIndex(index, (q) =>
          q.search(field, searchQuery).eq("organizationId", organizationId),
        )
        .take(limit),
    ),
  ]);
  const seen = new Set<Id<"collections">>();
  const rows: Doc<"collections">[] = [];
  for (const row of [...identifierMatches.rows, ...textMatches.flat()]) {
    if (row.status === "deleted" || seen.has(row._id)) continue;
    seen.add(row._id);
    rows.push(row);
  }
  return {
    rows: rows.slice(0, limit),
    identifierIndexIncomplete: identifierMatches.incomplete,
  };
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
    /** Unindexed historical identifiers may hold further matches. */
    identifierIndexIncomplete: v.boolean(),
  }),
  handler: async (ctx, args) => {
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
      identifierIndexIncomplete: false,
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
      const objectResults = await searchObjects(
        ctx,
        args.organizationId,
        searchQuery,
        searchLimit,
      );
      results.identifierIndexIncomplete =
        objectResults.identifierIndexIncomplete;

      results.objects = objectResults.rows.map((obj) => ({
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
      const accessionResults = await searchIdentifierPrefix(
        ctx,
        args.organizationId,
        "accession",
        searchQuery,
        searchLimit,
      );
      results.identifierIndexIncomplete ||= accessionResults.incomplete;

      results.accessions = accessionResults.rows.map((acc) => ({
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

    // Field values come from the same indexed word search as object search,
    // so every suggestion leads to at least one matching record.
    const matches = await Promise.all(
      OBJECT_SEARCH_INDEXES.map(async ({ field, index }) => {
        const rows = await ctx.db
          .query("collections")
          .withSearchIndex(index, (q) =>
            q
              .search(field, queryPrefix)
              .eq("organizationId", args.organizationId),
          )
          .take(limit);
        return rows.flatMap((row) =>
          row.status === "deleted" || !row[field] ? [] : [row[field]],
        );
      }),
    );
    for (const value of matches.flat()) {
      if (value.toLowerCase().includes(queryPrefix)) suggestions.add(value);
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
