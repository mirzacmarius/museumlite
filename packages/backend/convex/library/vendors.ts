import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Create a new vendor
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    discountPercent: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryVendors"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();

    const vendorId = await ctx.db.insert("libraryVendors", {
      organizationId: args.organizationId,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      website: args.website,
      address: args.address,
      accountNumber: args.accountNumber,
      paymentTerms: args.paymentTerms,
      discountPercent: args.discountPercent,
      notes: args.notes,
      isActive: true,
      createdAt: now,
    });

    return vendorId;
  },
});

/**
 * Get a vendor by ID
 */
export const get = query({
  args: {
    vendorId: v.id("libraryVendors"),
  },
  handler: async (ctx, args) => {
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      return null;
    }

    // Get acquisition requests for this vendor
    const requests = await ctx.db
      .query("libraryAcquisitionRequests")
      .filter((q) => q.eq(q.field("vendorId"), args.vendorId))
      .collect();

    const ordersCount = requests.length;
    const totalSpent = requests
      .filter((r) => r.actualPrice && ["received", "cataloged"].includes(r.status))
      .reduce((sum, r) => sum + (r.actualPrice || 0) * r.quantity, 0);

    return {
      ...vendor,
      ordersCount,
      totalSpent,
    };
  },
});

/**
 * List vendors
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.activeOnly) {
      query = ctx.db
        .query("libraryVendors")
        .withIndex("by_organization_and_active", (q) =>
          q.eq("organizationId", args.organizationId).eq("isActive", true),
        );
    } else {
      query = ctx.db
        .query("libraryVendors")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );
    }

    const vendors = await query.paginate(args.paginationOpts);

    return vendors;
  },
});

/**
 * List all active vendors (for dropdowns)
 */
export const listActive = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const vendors = await ctx.db
      .query("libraryVendors")
      .withIndex("by_organization_and_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("isActive", true),
      )
      .collect();

    return vendors;
  },
});

/**
 * Update a vendor
 */
export const update = mutation({
  args: {
    vendorId: v.id("libraryVendors"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    discountPercent: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const updates: Record<string, unknown> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.contactName !== undefined) updates.contactName = args.contactName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.website !== undefined) updates.website = args.website;
    if (args.address !== undefined) updates.address = args.address;
    if (args.accountNumber !== undefined)
      updates.accountNumber = args.accountNumber;
    if (args.paymentTerms !== undefined)
      updates.paymentTerms = args.paymentTerms;
    if (args.discountPercent !== undefined)
      updates.discountPercent = args.discountPercent;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.vendorId, updates);

    return null;
  },
});

/**
 * Deactivate a vendor
 */
export const deactivate = mutation({
  args: {
    vendorId: v.id("libraryVendors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(args.vendorId, { isActive: false });

    return null;
  },
});

/**
 * Reactivate a vendor
 */
export const reactivate = mutation({
  args: {
    vendorId: v.id("libraryVendors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(args.vendorId, { isActive: true });

    return null;
  },
});

/**
 * Delete a vendor
 */
export const remove = mutation({
  args: {
    vendorId: v.id("libraryVendors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    // Check if vendor has any acquisition requests
    const requests = await ctx.db
      .query("libraryAcquisitionRequests")
      .filter((q) => q.eq(q.field("vendorId"), args.vendorId))
      .first();

    if (requests) {
      throw new Error(
        "Cannot delete vendor with existing orders. Deactivate instead.",
      );
    }

    await ctx.db.delete(args.vendorId);

    return null;
  },
});

/**
 * Get vendor statistics
 */
export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const vendors = await ctx.db
      .query("libraryVendors")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeCount = vendors.filter((v) => v.isActive).length;
    const inactiveCount = vendors.filter((v) => !v.isActive).length;

    // Get all requests to calculate spending per vendor
    const requests = await ctx.db
      .query("libraryAcquisitionRequests")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const vendorSpending = new Map<string, number>();
    for (const request of requests) {
      if (
        request.vendorId &&
        request.actualPrice &&
        ["received", "cataloged"].includes(request.status)
      ) {
        const current = vendorSpending.get(request.vendorId) || 0;
        vendorSpending.set(
          request.vendorId,
          current + request.actualPrice * request.quantity,
        );
      }
    }

    // Find top vendors by spending
    const topVendors = await Promise.all(
      Array.from(vendorSpending.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([vendorId, totalSpent]) => {
          const vendor = await ctx.db.get(vendorId as Id<"libraryVendors">);
          return {
            vendor,
            totalSpent,
          };
        }),
    );

    return {
      total: vendors.length,
      active: activeCount,
      inactive: inactiveCount,
      topVendors: topVendors.filter((v) => v.vendor !== null),
    };
  },
});
