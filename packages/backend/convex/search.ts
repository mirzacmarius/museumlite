import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { hasPermission } from "./utils/permissions";

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
      hasPermission(ctx, args.organizationId, "accessions.read"),
      hasPermission(ctx, args.organizationId, "locations.read"),
    ]);

    if (canReadCollections) {
      const objectResults = await ctx.db
        .query("collections")
        .withSearchIndex("search_index", (q) =>
          q
            .search("title", searchQuery)
            .eq("organizationId", args.organizationId),
        )
        .take(searchLimit);

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
