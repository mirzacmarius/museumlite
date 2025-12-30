import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Priority validator
const priorityValidator = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent"),
);

// Request status validator
const requestStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("ordered"),
  v.literal("received"),
  v.literal("cataloged"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

/**
 * Create a new acquisition request
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.string(),
    authors: v.optional(v.array(v.string())),
    isbn: v.optional(v.string()),
    publisher: v.optional(v.string()),
    itemType: v.optional(v.string()),
    reason: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    quantity: v.optional(v.number()),
    estimatedPrice: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    fundSource: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryAcquisitionRequests"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();

    const requestId = await ctx.db.insert("libraryAcquisitionRequests", {
      organizationId: args.organizationId,
      title: args.title,
      authors: args.authors,
      isbn: args.isbn,
      publisher: args.publisher,
      itemType: args.itemType,
      requestedBy: userId,
      requestedAt: now,
      reason: args.reason,
      priority: args.priority || "normal",
      quantity: args.quantity || 1,
      estimatedPrice: args.estimatedPrice,
      vendorId: args.vendorId,
      fundSource: args.fundSource,
      status: "submitted",
      notes: args.notes,
    });

    return requestId;
  },
});

/**
 * Get an acquisition request by ID
 */
export const get = query({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      return null;
    }

    const requestedBy = await ctx.db.get(request.requestedBy);
    const reviewedBy = request.reviewedBy
      ? await ctx.db.get(request.reviewedBy)
      : null;
    const vendor = request.vendorId ? await ctx.db.get(request.vendorId) : null;
    const libraryItem = request.libraryItemId
      ? await ctx.db.get(request.libraryItemId)
      : null;

    return {
      ...request,
      requestedByUser: requestedBy,
      reviewedByUser: reviewedBy,
      vendor,
      libraryItem,
    };
  },
});

/**
 * List acquisition requests
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(requestStatusValidator),
    priority: v.optional(priorityValidator),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.status) {
      query = ctx.db
        .query("libraryAcquisitionRequests")
        .withIndex("by_organization_and_status", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("status", args.status!),
        );
    } else {
      query = ctx.db
        .query("libraryAcquisitionRequests")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );
    }

    const requests = await query.paginate(args.paginationOpts);

    // Filter by priority if specified
    let filteredPage = requests.page;
    if (args.priority) {
      filteredPage = requests.page.filter((r) => r.priority === args.priority);
    }

    // Enrich with user data
    const enrichedPage = await Promise.all(
      filteredPage.map(async (request) => {
        const requestedBy = await ctx.db.get(request.requestedBy);
        const vendor = request.vendorId
          ? await ctx.db.get(request.vendorId)
          : null;
        return {
          ...request,
          requestedByUser: requestedBy,
          vendor,
        };
      }),
    );

    return {
      ...requests,
      page: enrichedPage,
    };
  },
});

/**
 * Update request status (workflow)
 */
export const updateStatus = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    status: requestStatusValidator,
    reviewNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
    };

    // Add review info for certain status changes
    if (
      args.status === "approved" ||
      args.status === "rejected" ||
      args.status === "under_review"
    ) {
      updates.reviewedBy = userId;
      updates.reviewedAt = now;
      if (args.reviewNotes) {
        updates.reviewNotes = args.reviewNotes;
      }
    }

    // Add received date
    if (args.status === "received") {
      updates.receivedDate = now;
    }

    await ctx.db.patch(args.requestId, updates);

    return null;
  },
});

/**
 * Update order information
 */
export const updateOrderInfo = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    orderNumber: v.optional(v.string()),
    orderDate: v.optional(v.number()),
    expectedDelivery: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    actualPrice: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const updates: Record<string, unknown> = {};

    if (args.orderNumber !== undefined) updates.orderNumber = args.orderNumber;
    if (args.orderDate !== undefined) updates.orderDate = args.orderDate;
    if (args.expectedDelivery !== undefined)
      updates.expectedDelivery = args.expectedDelivery;
    if (args.vendorId !== undefined) updates.vendorId = args.vendorId;
    if (args.actualPrice !== undefined) updates.actualPrice = args.actualPrice;

    // If order number is set, update status to ordered
    if (args.orderNumber && request.status === "approved") {
      updates.status = "ordered";
    }

    await ctx.db.patch(args.requestId, updates);

    return null;
  },
});

/**
 * Link to created library item
 */
export const linkToItem = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    libraryItemId: v.id("libraryItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(args.requestId, {
      libraryItemId: args.libraryItemId,
      status: "cataloged",
    });

    return null;
  },
});

/**
 * Update a request
 */
export const update = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    title: v.optional(v.string()),
    authors: v.optional(v.array(v.string())),
    isbn: v.optional(v.string()),
    publisher: v.optional(v.string()),
    itemType: v.optional(v.string()),
    reason: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    quantity: v.optional(v.number()),
    estimatedPrice: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    fundSource: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    // Only allow updates on submitted or under_review requests
    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Cannot update request in current status");
    }

    const updates: Record<string, unknown> = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.authors !== undefined) updates.authors = args.authors;
    if (args.isbn !== undefined) updates.isbn = args.isbn;
    if (args.publisher !== undefined) updates.publisher = args.publisher;
    if (args.itemType !== undefined) updates.itemType = args.itemType;
    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.estimatedPrice !== undefined)
      updates.estimatedPrice = args.estimatedPrice;
    if (args.vendorId !== undefined) updates.vendorId = args.vendorId;
    if (args.fundSource !== undefined) updates.fundSource = args.fundSource;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.requestId, updates);

    return null;
  },
});

/**
 * Cancel a request
 */
export const cancel = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    // Can't cancel already received or cataloged items
    if (["received", "cataloged"].includes(request.status)) {
      throw new Error("Cannot cancel request that has been received");
    }

    await ctx.db.patch(args.requestId, { status: "cancelled" });

    return null;
  },
});

/**
 * Delete a request
 */
export const remove = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    // Only allow deletion of submitted, rejected, or cancelled requests
    if (!["submitted", "rejected", "cancelled"].includes(request.status)) {
      throw new Error("Cannot delete request in current status");
    }

    await ctx.db.delete(args.requestId);

    return null;
  },
});

/**
 * Get acquisition statistics
 */
export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    total: v.number(),
    submitted: v.number(),
    underReview: v.number(),
    approved: v.number(),
    ordered: v.number(),
    received: v.number(),
    cataloged: v.number(),
    rejected: v.number(),
    totalSpent: v.number(),
    pendingBudget: v.number(),
    byPriority: v.object({
      urgent: v.number(),
      high: v.number(),
      normal: v.number(),
      low: v.number(),
    }),
    thisMonth: v.number(),
  }),
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("libraryAcquisitionRequests")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const submitted = requests.filter((r) => r.status === "submitted").length;
    const underReview = requests.filter(
      (r) => r.status === "under_review",
    ).length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const ordered = requests.filter((r) => r.status === "ordered").length;
    const received = requests.filter((r) => r.status === "received").length;
    const cataloged = requests.filter((r) => r.status === "cataloged").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;

    const totalSpent = requests
      .filter(
        (r) => r.actualPrice && ["received", "cataloged"].includes(r.status),
      )
      .reduce((sum, r) => sum + (r.actualPrice || 0) * r.quantity, 0);

    const pendingBudget = requests
      .filter((r) =>
        ["submitted", "under_review", "approved", "ordered"].includes(r.status),
      )
      .reduce((sum, r) => sum + (r.estimatedPrice || 0) * r.quantity, 0);

    const byPriority = {
      urgent: requests.filter((r) => r.priority === "urgent").length,
      high: requests.filter((r) => r.priority === "high").length,
      normal: requests.filter((r) => r.priority === "normal").length,
      low: requests.filter((r) => r.priority === "low").length,
    };

    const now = Date.now();
    const thisMonth = new Date(now);
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthStart = thisMonth.getTime();

    const thisMonthCount = requests.filter(
      (r) => r.requestedAt >= thisMonthStart,
    ).length;

    return {
      total: requests.length,
      submitted,
      underReview,
      approved,
      ordered,
      received,
      cataloged,
      rejected,
      totalSpent,
      pendingBudget,
      byPriority,
      thisMonth: thisMonthCount,
    };
  },
});
