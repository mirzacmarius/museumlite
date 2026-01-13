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
    const searchQuery = args.query.toLowerCase().trim();

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

    const canReadCollections = await hasPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
    const canReadLoans = await hasPermission(
      ctx,
      args.organizationId,
      "loans.read",
    );
    const canReadAccessions = await hasPermission(
      ctx,
      args.organizationId,
      "accessions.read",
    );
    const canReadLocations = await hasPermission(
      ctx,
      args.organizationId,
      "locations.read",
    );

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
      const allLoans = await ctx.db
        .query("loans")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      const filteredLoans = allLoans
        .filter(
          (loan) =>
            loan.loanNumber.toLowerCase().includes(searchQuery) ||
            loan.lenderBorrowerName.toLowerCase().includes(searchQuery),
        )
        .slice(0, searchLimit);

      results.loans = filteredLoans.map((loan) => ({
        _id: loan._id,
        loanNumber: loan.loanNumber,
        lenderBorrowerName: loan.lenderBorrowerName,
        type: loan.type,
        status: loan.status,
      }));
    }

    if (canReadAccessions) {
      const allAccessions = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      const filteredAccessions = allAccessions
        .filter((acc) =>
          acc.accessionNumber.toLowerCase().includes(searchQuery),
        )
        .slice(0, searchLimit);

      results.accessions = filteredAccessions.map((acc) => ({
        _id: acc._id,
        accessionNumber: acc.accessionNumber,
        method: acc.method,
        status: acc.status,
      }));
    }

    if (canReadLocations) {
      const allLocations = await ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      const filteredLocations = allLocations
        .filter((loc) => loc.name.toLowerCase().includes(searchQuery))
        .slice(0, searchLimit);

      results.locations = filteredLocations.map((loc) => ({
        _id: loc._id,
        name: loc.name,
        type: loc.type,
      }));
    }

    return results;
  },
});
