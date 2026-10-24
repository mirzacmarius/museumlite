import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { mutation } from "../utils/mutationBuilders";
import { requireInOrganization } from "../utils/organizationScope";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
} from "../utils/uploadOwnership";
import { requireLibraryPermission } from "./utils/permissions";

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

    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.create",
    );
    if (args.collectionId) {
      await requireInOrganization(
        ctx,
        args.collectionId,
        args.organizationId,
        "Object",
      );
    }

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
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return null;
    }

    await requireLibraryPermission(
      ctx,
      item.organizationId,
      "collections.read",
    );

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
const BOUNDED_LIBRARY_ITEM_SEARCH_SCAN_LIMIT = 500;

function libraryItemMatchesAdditionalSearch(
  item: Doc<"libraryItems">,
  searchLower: string,
): boolean {
  return (
    item.isbn?.toLowerCase().includes(searchLower) ||
    item.isbn13?.toLowerCase().includes(searchLower) ||
    item.barcode?.toLowerCase().includes(searchLower) ||
    item.callNumber?.toLowerCase().includes(searchLower) ||
    item.authors.some((author) => author.toLowerCase().includes(searchLower)) ||
    item.publisher?.toLowerCase().includes(searchLower) ||
    item.series?.toLowerCase().includes(searchLower) ||
    false
  );
}

function applyLibraryItemJsFilters(
  items: Doc<"libraryItems">[],
  args: {
    category?: string;
    genre?: string;
    author?: string;
    publisherFilter?: string;
    yearFrom?: number;
    yearTo?: number;
  },
) {
  let results = items;

  if (args.category) {
    const categoryLower = args.category.toLowerCase();
    results = results.filter((item) =>
      item.categories?.some((category) =>
        category.toLowerCase().includes(categoryLower),
      ),
    );
  }

  if (args.genre) {
    const genreLower = args.genre.toLowerCase();
    results = results.filter((item) =>
      item.genres?.some((genre) => genre.toLowerCase().includes(genreLower)),
    );
  }

  if (args.author) {
    const authorLower = args.author.toLowerCase();
    results = results.filter((item) =>
      item.authors.some((author) => author.toLowerCase().includes(authorLower)),
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
        item.publicationYear !== undefined &&
        item.publicationYear >= args.yearFrom!,
    );
  }

  if (args.yearTo) {
    results = results.filter(
      (item) =>
        item.publicationYear !== undefined &&
        item.publicationYear <= args.yearTo!,
    );
  }

  return results;
}

function mapLibraryItemListEntry(item: Doc<"libraryItems">) {
  return {
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
  };
}

function paginateBoundedLibraryItems(
  items: Doc<"libraryItems">[],
  paginationOpts: { numItems: number; cursor: string | null },
) {
  items.sort((a, b) => b.createdAt - a.createdAt);

  const cursor = paginationOpts.cursor
    ? Number.parseInt(paginationOpts.cursor, 10)
    : 0;
  const startIndex = Number.isNaN(cursor) ? 0 : cursor;
  const endIndex = Math.min(startIndex + paginationOpts.numItems, items.length);

  return {
    page: items.slice(startIndex, endIndex).map(mapLibraryItemListEntry),
    isDone: endIndex >= items.length,
    continueCursor: endIndex.toString(),
  };
}

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
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );

    const search = args.search?.trim();
    const hasJsFilters = Boolean(
      args.category ||
        args.genre ||
        args.author ||
        args.publisherFilter ||
        args.yearFrom ||
        args.yearTo,
    );

    if (search && search.length > 0) {
      const searchLower = search.toLowerCase();
      const searchIndexResults = await ctx.db
        .query("libraryItems")
        .withSearchIndex("search_library_items", (q) => {
          let filter = q
            .search("title", search)
            .eq("organizationId", args.organizationId);

          if (args.itemType) {
            filter = filter.eq("itemType", args.itemType);
          }
          if (args.catalogStatus) {
            filter = filter.eq("catalogStatus", args.catalogStatus);
          }

          return filter;
        })
        .take(BOUNDED_LIBRARY_ITEM_SEARCH_SCAN_LIMIT);

      const recentItems = await ctx.db
        .query("libraryItems")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(BOUNDED_LIBRARY_ITEM_SEARCH_SCAN_LIMIT);

      const resultIds = new Set(searchIndexResults.map((item) => item._id));
      const mergedResults = [
        ...searchIndexResults,
        ...recentItems.filter((item) => {
          if (resultIds.has(item._id)) {
            return false;
          }
          if (args.itemType && item.itemType !== args.itemType) {
            return false;
          }
          if (args.catalogStatus && item.catalogStatus !== args.catalogStatus) {
            return false;
          }
          if (args.isCirculating !== undefined) {
            return item.isCirculating === args.isCirculating;
          }
          return libraryItemMatchesAdditionalSearch(item, searchLower);
        }),
      ];

      const filteredResults = applyLibraryItemJsFilters(mergedResults, args);
      return paginateBoundedLibraryItems(filteredResults, args.paginationOpts);
    }

    if (hasJsFilters || args.isCirculating !== undefined) {
      let indexedQuery = ctx.db
        .query("libraryItems")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc");

      if (args.itemType) {
        indexedQuery = indexedQuery.filter((q) =>
          q.eq(q.field("itemType"), args.itemType),
        );
      }
      if (args.catalogStatus) {
        indexedQuery = indexedQuery.filter((q) =>
          q.eq(q.field("catalogStatus"), args.catalogStatus),
        );
      }
      if (args.isCirculating !== undefined) {
        indexedQuery = indexedQuery.filter((q) =>
          q.eq(q.field("isCirculating"), args.isCirculating),
        );
      }

      const candidateItems = await indexedQuery.take(
        BOUNDED_LIBRARY_ITEM_SEARCH_SCAN_LIMIT,
      );
      const filteredResults = applyLibraryItemJsFilters(candidateItems, args);
      return paginateBoundedLibraryItems(filteredResults, args.paginationOpts);
    }

    const paginationResult =
      args.itemType && args.catalogStatus
        ? await ctx.db
            .query("libraryItems")
            .withIndex("by_organization_and_type", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("itemType", args.itemType!),
            )
            .filter((q) => q.eq(q.field("catalogStatus"), args.catalogStatus))
            .order("desc")
            .paginate(args.paginationOpts)
        : args.itemType
          ? await ctx.db
              .query("libraryItems")
              .withIndex("by_organization_and_type", (q) =>
                q
                  .eq("organizationId", args.organizationId)
                  .eq("itemType", args.itemType!),
              )
              .order("desc")
              .paginate(args.paginationOpts)
          : args.catalogStatus
            ? await ctx.db
                .query("libraryItems")
                .withIndex("by_organization_and_status", (q) =>
                  q
                    .eq("organizationId", args.organizationId)
                    .eq("catalogStatus", args.catalogStatus!),
                )
                .order("desc")
                .paginate(args.paginationOpts)
            : await ctx.db
                .query("libraryItems")
                .withIndex("by_organization", (q) =>
                  q.eq("organizationId", args.organizationId),
                )
                .order("desc")
                .paginate(args.paginationOpts);

    return {
      page: paginationResult.page.map(mapLibraryItemListEntry),
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.continueCursor,
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
    const [userId, item] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.itemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireLibraryPermission(
      ctx,
      item.organizationId,
      "collections.update",
    );

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
    if (args.collectionId !== undefined) {
      await requireInOrganization(
        ctx,
        args.collectionId,
        item.organizationId,
        "Object",
      );
      updates.collectionId = args.collectionId;
    }

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
    const [userId, item] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.itemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireLibraryPermission(
      ctx,
      item.organizationId,
      "collections.delete",
    );

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
    const [userId, item] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.itemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!item) {
      throw new Error("Library item not found");
    }

    if (item.catalogStatus === "published") {
      return null;
    }

    await requireLibraryPermission(
      ctx,
      item.organizationId,
      "collections.update",
    );

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
    const [userId, item] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.itemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireLibraryPermission(
      ctx,
      item.organizationId,
      "collections.update",
    );

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
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
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
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
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

    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.create",
    );

    return await createAuthorizedUploadUrl(ctx, userId, args.organizationId);
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
    const [userId, item] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.itemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireLibraryPermission(
      ctx,
      item.organizationId,
      "collections.update",
    );

    await claimStorageOwnership(ctx, {
      storageId: args.storageId,
      organizationId: item.organizationId,
      uploadedBy: userId,
      ownerType: "libraryCover",
      ownerId: item._id,
    });
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
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
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
