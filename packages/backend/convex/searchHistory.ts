import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const moduleValidator = v.union(
  v.literal("objects"),
  v.literal("loans"),
  v.literal("accounts"),
  v.literal("locations"),
  v.literal("accessions"),
);

const searchHistoryValidator = v.object({
  _id: v.id("searchHistory"),
  _creationTime: v.number(),
  organizationId: v.id("organizations"),
  userId: v.id("users"),
  module: moduleValidator,
  query: v.string(),
  filters: v.optional(v.string()),
  resultCount: v.optional(v.number()),
  searchedAt: v.number(),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    module: v.optional(moduleValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(searchHistoryValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit ?? 10;

    const searches = await ctx.db
      .query("searchHistory")
      .withIndex("by_user_and_searched_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit * 2);

    let filtered = searches.filter(
      (s) => s.organizationId === args.organizationId,
    );

    if (args.module) {
      filtered = filtered.filter((s) => s.module === args.module);
    }

    return filtered.slice(0, limit);
  },
});

export const save = mutation({
  args: {
    organizationId: v.id("organizations"),
    module: moduleValidator,
    query: v.string(),
    filters: v.optional(v.string()),
    resultCount: v.optional(v.number()),
  },
  returns: v.id("searchHistory"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trimmedQuery = args.query.trim();
    if (trimmedQuery.length < 2) {
      throw new Error("Query too short");
    }

    const existingSearches = await ctx.db
      .query("searchHistory")
      .withIndex("by_user_and_module", (q) =>
        q.eq("userId", userId).eq("module", args.module),
      )
      .collect();

    const duplicate = existingSearches.find(
      (s) =>
        s.organizationId === args.organizationId &&
        s.query === trimmedQuery &&
        s.filters === args.filters,
    );

    if (duplicate) {
      await ctx.db.patch(duplicate._id, {
        searchedAt: Date.now(),
        resultCount: args.resultCount,
      });
      return duplicate._id;
    }

    return await ctx.db
      .insert("searchHistory", {
        organizationId: args.organizationId,
        userId,
        module: args.module,
        query: trimmedQuery,
        filters: args.filters,
        resultCount: args.resultCount,
        searchedAt: Date.now(),
      })
      .then(async (searchId) => {
        const allUserSearches = await ctx.db
          .query("searchHistory")
          .withIndex("by_user_and_searched_at", (q) => q.eq("userId", userId))
          .order("desc")
          .take(101);

        if (allUserSearches.length > 100) {
          await Promise.all(
            allUserSearches
              .slice(100)
              .map((search) => ctx.db.delete(search._id)),
          );
        }

        return searchId;
      });
  },
});

export const clear = mutation({
  args: {
    organizationId: v.id("organizations"),
    module: v.optional(moduleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const searches = await ctx.db
      .query("searchHistory")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .collect();

    let toDelete = searches;

    if (args.module) {
      toDelete = searches.filter((s) => s.module === args.module);
    }

    await Promise.all(toDelete.map((search) => ctx.db.delete(search._id)));

    return null;
  },
});
