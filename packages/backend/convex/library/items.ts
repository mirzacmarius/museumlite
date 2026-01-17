import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireModuleEnabled } from "../utils/featureGates";

// Item type validator
const itemTypeValidator = v.union(
  v.literal("book"),
  v.literal("ebook"),
  v.literal("audiobook"),
  v.literal("periodical"),
  v.literal("newspaper"),
  v.literal("dvd"),
  v.literal("cd"),
  v.literal("map"),
  v.literal("manuscript"),
  v.literal("thesis"),
  v.literal("other"),
);

// Catalog status validator
const catalogStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

// Target audience validator
const targetAudienceValidator = v.union(
  v.literal("children"),
  v.literal("young_adult"),
  v.literal("adult"),
  v.literal("all_ages"),
);

/**
 * Create a new library item
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemType: itemTypeValidator,
    title: v.string(),
    subtitle: v.optional(v.string()),
    authors: v.array(v.string()),
    contributors: v.optional(
      v.array(
        v.object({
          name: v.string(),
          role: v.string(),
        }),
      ),
    ),
    // Identifiers
    isbn: v.optional(v.string()),
    isbn13: v.optional(v.string()),
    issn: v.optional(v.string()),
    barcode: v.optional(v.string()),
    callNumber: v.optional(v.string()),
    accessionNumber: v.optional(v.string()),
    // Publication
    publisher: v.optional(v.string()),
    publicationYear: v.optional(v.number()),
    publicationPlace: v.optional(v.string()),
    edition: v.optional(v.string()),
    volume: v.optional(v.string()),
    issue: v.optional(v.string()),
    // Language
    language: v.string(),
    originalLanguage: v.optional(v.string()),
    originalTitle: v.optional(v.string()),
    // Physical description
    pages: v.optional(v.number()),
    duration: v.optional(v.number()),
    format: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    // Classification
    deweyDecimal: v.optional(v.string()),
    lcClassification: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    subjects: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    targetAudience: v.optional(targetAudienceValidator),
    // Series
    series: v.optional(v.string()),
    seriesNumber: v.optional(v.number()),
    // Content
    description: v.optional(v.string()),
    tableOfContents: v.optional(v.string()),
    summary: v.optional(v.string()),
    // Media
    coverImageUrl: v.optional(v.string()),
    // Circulation rules
    isCirculating: v.optional(v.boolean()),
    loanPeriodDays: v.optional(v.number()),
    maxRenewals: v.optional(v.number()),
    // Notes
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    // Link to collection object (for rare items)
    collectionId: v.optional(v.id("collections")),
  },
  returns: v.id("libraryItems"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireModuleEnabled(ctx, args.organizationId, "library");

    const itemId = await ctx.db.insert("libraryItems", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      itemType: args.itemType,
      isbn: args.isbn,
      isbn13: args.isbn13,
      issn: args.issn,
      barcode: args.barcode,
      callNumber: args.callNumber,
      accessionNumber: args.accessionNumber,
      title: args.title,
      subtitle: args.subtitle,
      authors: args.authors,
      contributors: args.contributors,
      publisher: args.publisher,
      publicationYear: args.publicationYear,
      publicationPlace: args.publicationPlace,
      edition: args.edition,
      volume: args.volume,
      issue: args.issue,
      language: args.language,
      originalLanguage: args.originalLanguage,
      originalTitle: args.originalTitle,
      pages: args.pages,
      duration: args.duration,
      format: args.format,
      dimensions: args.dimensions,
      deweyDecimal: args.deweyDecimal,
      lcClassification: args.lcClassification,
      categories: args.categories,
      genres: args.genres,
      subjects: args.subjects,
      keywords: args.keywords,
      targetAudience: args.targetAudience,
      series: args.series,
      seriesNumber: args.seriesNumber,
      description: args.description,
      tableOfContents: args.tableOfContents,
      summary: args.summary,
      coverImageUrl: args.coverImageUrl,
      totalCopies: 0,
      availableCopies: 0,
      catalogStatus: "draft",
      isCirculating: args.isCirculating ?? true,
      loanPeriodDays: args.loanPeriodDays,
      maxRenewals: args.maxRenewals,
      notes: args.notes,
      internalNotes: args.internalNotes,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return itemId;
  },
});

/**
 * Get a library item by ID
 */
export const get = query({
  args: {
    itemId: v.id("libraryItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return null;
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

    // Get cover image URL if stored locally
    let coverImageUrl = item.coverImageUrl;
    if (item.coverImageId) {
      coverImageUrl =
        (await ctx.storage.getUrl(item.coverImageId)) ?? item.coverImageUrl;
    }

    return {
      ...item,
      coverImageUrl,
    };
  },
});

/**
 * List library items with pagination and filters
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    itemType: v.optional(itemTypeValidator),
    catalogStatus: v.optional(catalogStatusValidator),
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    genre: v.optional(v.string()),
    author: v.optional(v.string()),
    publisherFilter: v.optional(v.string()),
    yearFrom: v.optional(v.number()),
    yearTo: v.optional(v.number()),
    isCirculating: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    let results: Doc<"libraryItems">[] = [];

    // Use search index when search term is provided
    if (args.search && args.search.trim().length > 0) {
      const searchQuery = ctx.db
        .query("libraryItems")
        .withSearchIndex("search_library_items", (q) => {
          let filter = q
            .search("title", args.search!)
            .eq("organizationId", args.organizationId);

          if (args.itemType) {
            filter = filter.eq("itemType", args.itemType);
          }
          if (args.catalogStatus) {
            filter = filter.eq("catalogStatus", args.catalogStatus);
          }

          return filter;
        });

      results = await searchQuery.collect();

      // Also search in other fields not covered by searchIndex
      const allItems = await ctx.db
        .query("libraryItems")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      const searchLower = args.search.toLowerCase();
      const resultIds = new Set(results.map((r) => r._id));

      const additionalResults = allItems.filter((item) => {
        if (resultIds.has(item._id)) return false;

        // Filter by type and status if specified
        if (args.itemType && item.itemType !== args.itemType) return false;
        if (args.catalogStatus && item.catalogStatus !== args.catalogStatus)
          return false;

        // Search in additional fields
        return (
          item.isbn?.toLowerCase().includes(searchLower) ||
          item.isbn13?.toLowerCase().includes(searchLower) ||
          item.barcode?.toLowerCase().includes(searchLower) ||
          item.callNumber?.toLowerCase().includes(searchLower) ||
          item.authors.some((a) => a.toLowerCase().includes(searchLower)) ||
          item.publisher?.toLowerCase().includes(searchLower) ||
          item.series?.toLowerCase().includes(searchLower) ||
          false
        );
      });

      results = [...results, ...additionalResults];
    } else {
      // No search - use regular index
      let query = ctx.db
        .query("libraryItems")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );

      if (args.itemType) {
        query = query.filter((q) => q.eq(q.field("itemType"), args.itemType));
      }
      if (args.catalogStatus) {
        query = query.filter((q) =>
          q.eq(q.field("catalogStatus"), args.catalogStatus),
        );
      }
      if (args.isCirculating !== undefined) {
        query = query.filter((q) =>
          q.eq(q.field("isCirculating"), args.isCirculating),
        );
      }

      results = await query.collect();
    }

    // Apply JavaScript-level filters
    if (args.category) {
      const categoryLower = args.category.toLowerCase();
      results = results.filter((item) =>
        item.categories?.some((c: string) =>
          c.toLowerCase().includes(categoryLower),
        ),
      );
    }

    if (args.genre) {
      const genreLower = args.genre.toLowerCase();
      results = results.filter((item) =>
        item.genres?.some((g: string) => g.toLowerCase().includes(genreLower)),
      );
    }

    if (args.author) {
      const authorLower = args.author.toLowerCase();
      results = results.filter((item) =>
        item.authors.some((a: string) => a.toLowerCase().includes(authorLower)),
      );
    }

    if (args.publisherFilter) {
      const publisherLower = args.publisherFilter.toLowerCase();
      results = results.filter((item) =>
        item.publisher?.toLowerCase().includes(publisherLower),
      );
    }

    if (args.yearFrom) {
      results = results.filter(
        (item) =>
          item.publicationYear && item.publicationYear >= args.yearFrom!,
      );
    }

    if (args.yearTo) {
      results = results.filter(
        (item) => item.publicationYear && item.publicationYear <= args.yearTo!,
      );
    }

    // Sort by creation time (newest first)
    results.sort((a, b) => b.createdAt - a.createdAt);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      results.length,
    );
    const page = results.slice(startIndex, endIndex);

    return {
      page: page.map((item) => ({
        _id: item._id,
        itemType: item.itemType,
        title: item.title,
        subtitle: item.subtitle,
        authors: item.authors,
        isbn: item.isbn,
        isbn13: item.isbn13,
        callNumber: item.callNumber,
        publisher: item.publisher,
        publicationYear: item.publicationYear,
        totalCopies: item.totalCopies,
        availableCopies: item.availableCopies,
        catalogStatus: item.catalogStatus,
        coverImageUrl: item.coverImageUrl,
        _creationTime: item._creationTime,
      })),
      isDone: endIndex >= results.length,
      continueCursor: endIndex.toString(),
    };
  },
});

/**
 * Update a library item
 */
export const update = mutation({
  args: {
    itemId: v.id("libraryItems"),
    itemType: v.optional(itemTypeValidator),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    authors: v.optional(v.array(v.string())),
    contributors: v.optional(
      v.array(
        v.object({
          name: v.string(),
          role: v.string(),
        }),
      ),
    ),
    isbn: v.optional(v.string()),
    isbn13: v.optional(v.string()),
    issn: v.optional(v.string()),
    barcode: v.optional(v.string()),
    callNumber: v.optional(v.string()),
    accessionNumber: v.optional(v.string()),
    publisher: v.optional(v.string()),
    publicationYear: v.optional(v.number()),
    publicationPlace: v.optional(v.string()),
    edition: v.optional(v.string()),
    volume: v.optional(v.string()),
    issue: v.optional(v.string()),
    language: v.optional(v.string()),
    originalLanguage: v.optional(v.string()),
    originalTitle: v.optional(v.string()),
    pages: v.optional(v.number()),
    duration: v.optional(v.number()),
    format: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    deweyDecimal: v.optional(v.string()),
    lcClassification: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    subjects: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    targetAudience: v.optional(targetAudienceValidator),
    series: v.optional(v.string()),
    seriesNumber: v.optional(v.number()),
    description: v.optional(v.string()),
    tableOfContents: v.optional(v.string()),
    summary: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    catalogStatus: v.optional(catalogStatusValidator),
    isCirculating: v.optional(v.boolean()),
    loanPeriodDays: v.optional(v.number()),
    maxRenewals: v.optional(v.number()),
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

    const updates: Partial<Doc<"libraryItems">> = {
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    if (args.itemType !== undefined) updates.itemType = args.itemType;
    if (args.title !== undefined) updates.title = args.title;
    if (args.subtitle !== undefined) updates.subtitle = args.subtitle;
    if (args.authors !== undefined) updates.authors = args.authors;
    if (args.contributors !== undefined)
      updates.contributors = args.contributors;
    if (args.isbn !== undefined) updates.isbn = args.isbn;
    if (args.isbn13 !== undefined) updates.isbn13 = args.isbn13;
    if (args.issn !== undefined) updates.issn = args.issn;
    if (args.barcode !== undefined) updates.barcode = args.barcode;
    if (args.callNumber !== undefined) updates.callNumber = args.callNumber;
    if (args.accessionNumber !== undefined)
      updates.accessionNumber = args.accessionNumber;
    if (args.publisher !== undefined) updates.publisher = args.publisher;
    if (args.publicationYear !== undefined)
      updates.publicationYear = args.publicationYear;
    if (args.publicationPlace !== undefined)
      updates.publicationPlace = args.publicationPlace;
    if (args.edition !== undefined) updates.edition = args.edition;
    if (args.volume !== undefined) updates.volume = args.volume;
    if (args.issue !== undefined) updates.issue = args.issue;
    if (args.language !== undefined) updates.language = args.language;
    if (args.originalLanguage !== undefined)
      updates.originalLanguage = args.originalLanguage;
    if (args.originalTitle !== undefined)
      updates.originalTitle = args.originalTitle;
    if (args.pages !== undefined) updates.pages = args.pages;
    if (args.duration !== undefined) updates.duration = args.duration;
    if (args.format !== undefined) updates.format = args.format;
    if (args.dimensions !== undefined) updates.dimensions = args.dimensions;
    if (args.deweyDecimal !== undefined)
      updates.deweyDecimal = args.deweyDecimal;
    if (args.lcClassification !== undefined)
      updates.lcClassification = args.lcClassification;
    if (args.categories !== undefined) updates.categories = args.categories;
    if (args.genres !== undefined) updates.genres = args.genres;
    if (args.subjects !== undefined) updates.subjects = args.subjects;
    if (args.keywords !== undefined) updates.keywords = args.keywords;
    if (args.targetAudience !== undefined)
      updates.targetAudience = args.targetAudience;
    if (args.series !== undefined) updates.series = args.series;
    if (args.seriesNumber !== undefined)
      updates.seriesNumber = args.seriesNumber;
    if (args.description !== undefined) updates.description = args.description;
    if (args.tableOfContents !== undefined)
      updates.tableOfContents = args.tableOfContents;
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.coverImageUrl !== undefined)
      updates.coverImageUrl = args.coverImageUrl;
    if (args.catalogStatus !== undefined)
      updates.catalogStatus = args.catalogStatus;
    if (args.isCirculating !== undefined)
      updates.isCirculating = args.isCirculating;
    if (args.loanPeriodDays !== undefined)
      updates.loanPeriodDays = args.loanPeriodDays;
    if (args.maxRenewals !== undefined) updates.maxRenewals = args.maxRenewals;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.internalNotes !== undefined)
      updates.internalNotes = args.internalNotes;
    if (args.collectionId !== undefined)
      updates.collectionId = args.collectionId;

    await ctx.db.patch(args.itemId, updates);

    return null;
  },
});

/**
 * Delete a library item
 */
export const remove = mutation({
  args: {
    itemId: v.id("libraryItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

    // Check if there are any copies
    const copies = await ctx.db
      .query("itemCopies")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .first();

    if (copies) {
      throw new Error(
        "Cannot delete item with existing copies. Remove all copies first.",
      );
    }

    // Check if there are active circulations
    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (circulations) {
      throw new Error("Cannot delete item with active circulations.");
    }

    await ctx.db.delete(args.itemId);

    return null;
  },
});

/**
 * Publish a library item (change status from draft to published)
 */
export const publish = mutation({
  args: {
    itemId: v.id("libraryItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

    if (item.catalogStatus === "published") {
      return null;
    }

    await ctx.db.patch(args.itemId, {
      catalogStatus: "published",
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Archive a library item
 */
export const archive = mutation({
  args: {
    itemId: v.id("libraryItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

    // Check for active circulations
    const activeCirculations = await ctx.db
      .query("circulations")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (activeCirculations) {
      throw new Error("Cannot archive item with active circulations.");
    }

    await ctx.db.patch(args.itemId, {
      catalogStatus: "archived",
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Get item by ISBN
 */
export const getByIsbn = query({
  args: {
    organizationId: v.id("organizations"),
    isbn: v.string(),
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    // Try ISBN-10
    let item = await ctx.db
      .query("libraryItems")
      .withIndex("by_isbn", (q) => q.eq("isbn", args.isbn))
      .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
      .first();

    if (item) {
      return item;
    }

    // Try ISBN-13
    item = await ctx.db
      .query("libraryItems")
      .withIndex("by_isbn13", (q) => q.eq("isbn13", args.isbn))
      .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
      .first();

    return item;
  },
});

/**
 * Get item by barcode
 */
export const getByBarcode = query({
  args: {
    organizationId: v.id("organizations"),
    barcode: v.string(),
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const item = await ctx.db
      .query("libraryItems")
      .withIndex("by_barcode", (q) => q.eq("barcode", args.barcode))
      .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
      .first();

    return item;
  },
});

/**
 * Upload cover image
 */
export const generateUploadUrl = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireModuleEnabled(ctx, args.organizationId, "library");

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Set cover image from uploaded file
 */
export const setCoverImage = mutation({
  args: {
    itemId: v.id("libraryItems"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

    await ctx.db.patch(args.itemId, {
      coverImageId: args.storageId,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Get catalog statistics
 */
export const getStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalItems: v.number(),
    publishedItems: v.number(),
    draftItems: v.number(),
    archivedItems: v.number(),
    totalCopies: v.number(),
    availableCopies: v.number(),
    checkedOutCopies: v.number(),
    byType: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const allItems = await ctx.db
      .query("libraryItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const totalItems = allItems.length;
    const publishedItems = allItems.filter(
      (i) => i.catalogStatus === "published",
    ).length;
    const draftItems = allItems.filter(
      (i) => i.catalogStatus === "draft",
    ).length;
    const archivedItems = allItems.filter(
      (i) => i.catalogStatus === "archived",
    ).length;

    const totalCopies = allItems.reduce((sum, i) => sum + i.totalCopies, 0);
    const availableCopies = allItems.reduce(
      (sum, i) => sum + i.availableCopies,
      0,
    );

    const byType: Record<string, number> = {};
    for (const item of allItems) {
      byType[item.itemType] = (byType[item.itemType] || 0) + 1;
    }

    return {
      totalItems,
      publishedItems,
      draftItems,
      archivedItems,
      totalCopies,
      availableCopies,
      checkedOutCopies: totalCopies - availableCopies,
      byType,
    };
  },
});
