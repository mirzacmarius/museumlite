import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Fine type validator
const fineTypeValidator = v.union(
  v.literal("overdue"),
  v.literal("lost_item"),
  v.literal("damaged_item"),
  v.literal("processing_fee"),
  v.literal("replacement_cost"),
  v.literal("membership_fee"),
  v.literal("other"),
);

// Fine status validator
const fineStatusValidator = v.union(
  v.literal("outstanding"),
  v.literal("paid"),
  v.literal("waived"),
  v.literal("forgiven"),
  v.literal("refunded"),
);

// Payment method validator
const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("check"),
  v.literal("online"),
  v.literal("other"),
);

/**
 * Create a fine manually
 */
export const create = mutation({
  args: {
    patronId: v.id("patrons"),
    fineType: fineTypeValidator,
    description: v.string(),
    amount: v.number(),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryFines"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    const now = Date.now();

    const fineId = await ctx.db.insert("libraryFines", {
      organizationId: patron.organizationId,
      patronId: args.patronId,
      fineType: args.fineType,
      description: args.description,
      amount: args.amount,
      amountPaid: 0,
      balance: args.amount,
      status: "outstanding",
      createdAt: now,
      dueDate: args.dueDate,
      notes: args.notes,
    });

    // Update patron fine balance
    await ctx.db.patch(args.patronId, {
      fineBalance: patron.fineBalance + args.amount,
    });

    return fineId;
  },
});

/**
 * Record a payment
 */
export const recordPayment = mutation({
  args: {
    patronId: v.id("patrons"),
    amount: v.number(),
    paymentMethod: paymentMethodValidator,
    fineIds: v.optional(v.array(v.id("libraryFines"))),
    receiptNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryPayments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    if (args.amount <= 0) {
      throw new Error("Payment amount must be positive");
    }

    const now = Date.now();
    let remainingPayment = args.amount;
    const paidFineIds: Id<"libraryFines">[] = [];

    // If specific fines are specified, pay those
    if (args.fineIds && args.fineIds.length > 0) {
      for (const fineId of args.fineIds) {
        if (remainingPayment <= 0) break;

        const fine = await ctx.db.get(fineId);
        if (!fine || fine.patronId !== args.patronId) continue;
        if (fine.status !== "outstanding") continue;

        const paymentForFine = Math.min(remainingPayment, fine.balance);
        const newAmountPaid = fine.amountPaid + paymentForFine;
        const newBalance = fine.amount - newAmountPaid;

        await ctx.db.patch(fineId, {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newBalance <= 0 ? "paid" : "outstanding",
          paidAt: newBalance <= 0 ? now : undefined,
        });

        remainingPayment -= paymentForFine;
        paidFineIds.push(fineId);
      }
    } else {
      // Apply payment to oldest outstanding fines first
      const outstandingFines = await ctx.db
        .query("libraryFines")
        .withIndex("by_patron_and_status", (q) =>
          q.eq("patronId", args.patronId).eq("status", "outstanding"),
        )
        .collect();

      // Sort by creation date (oldest first)
      outstandingFines.sort((a, b) => a.createdAt - b.createdAt);

      for (const fine of outstandingFines) {
        if (remainingPayment <= 0) break;

        const paymentForFine = Math.min(remainingPayment, fine.balance);
        const newAmountPaid = fine.amountPaid + paymentForFine;
        const newBalance = fine.amount - newAmountPaid;

        await ctx.db.patch(fine._id, {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newBalance <= 0 ? "paid" : "outstanding",
          paidAt: newBalance <= 0 ? now : undefined,
        });

        remainingPayment -= paymentForFine;
        paidFineIds.push(fine._id);
      }
    }

    // Create payment record
    const paymentId = await ctx.db.insert("libraryPayments", {
      organizationId: patron.organizationId,
      patronId: args.patronId,
      amount: args.amount,
      paymentMethod: args.paymentMethod,
      fineIds: paidFineIds,
      receiptNumber: args.receiptNumber,
      receivedBy: userId,
      receivedAt: now,
      notes: args.notes,
    });

    // Update patron fine balance
    const newBalance = Math.max(0, patron.fineBalance - args.amount);
    await ctx.db.patch(args.patronId, { fineBalance: newBalance });

    return paymentId;
  },
});

/**
 * Waive a fine
 */
export const waive = mutation({
  args: {
    fineId: v.id("libraryFines"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const fine = await ctx.db.get(args.fineId);
    if (!fine) {
      throw new Error("Fine not found");
    }

    if (fine.status !== "outstanding") {
      throw new Error("Can only waive outstanding fines");
    }

    // Update fine
    await ctx.db.patch(args.fineId, {
      status: "waived",
      waivedBy: userId,
      waivedReason: args.reason,
    });

    // Update patron fine balance
    const patron = await ctx.db.get(fine.patronId);
    if (patron) {
      await ctx.db.patch(fine.patronId, {
        fineBalance: Math.max(0, patron.fineBalance - fine.balance),
      });
    }

    return null;
  },
});

/**
 * Forgive a fine
 */
export const forgive = mutation({
  args: {
    fineId: v.id("libraryFines"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const fine = await ctx.db.get(args.fineId);
    if (!fine) {
      throw new Error("Fine not found");
    }

    if (fine.status !== "outstanding") {
      throw new Error("Can only forgive outstanding fines");
    }

    // Update fine
    await ctx.db.patch(args.fineId, {
      status: "forgiven",
      waivedBy: userId,
      waivedReason: args.reason,
    });

    // Update patron fine balance
    const patron = await ctx.db.get(fine.patronId);
    if (patron) {
      await ctx.db.patch(fine.patronId, {
        fineBalance: Math.max(0, patron.fineBalance - fine.balance),
      });
    }

    return null;
  },
});

/**
 * Get a fine by ID
 */
export const get = query({
  args: {
    fineId: v.id("libraryFines"),
  },
  handler: async (ctx, args) => {
    const fine = await ctx.db.get(args.fineId);
    if (!fine) {
      return null;
    }

    const patron = await ctx.db.get(fine.patronId);
    const circulation = fine.circulationId
      ? await ctx.db.get(fine.circulationId)
      : null;
    const item = circulation
      ? await ctx.db.get(circulation.itemId)
      : null;
    const copy = fine.copyId
      ? await ctx.db.get(fine.copyId)
      : null;

    return {
      ...fine,
      patron,
      circulation,
      copy,
      item,
    };
  },
});

/**
 * List fines for organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(fineStatusValidator),
    fineType: v.optional(fineTypeValidator),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.status) {
      query = ctx.db
        .query("libraryFines")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", args.status!),
        );
    } else {
      query = ctx.db
        .query("libraryFines")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );
    }

    const fines = await query.paginate(args.paginationOpts);

    // Filter by type if specified
    let filteredPage = fines.page;
    if (args.fineType) {
      filteredPage = fines.page.filter((f) => f.fineType === args.fineType);
    }

    // Enrich with patron data
    const enrichedPage = await Promise.all(
      filteredPage.map(async (fine) => {
        const patron = await ctx.db.get(fine.patronId);
        return {
          ...fine,
          patron,
        };
      }),
    );

    return {
      ...fines,
      page: enrichedPage,
    };
  },
});

/**
 * Get payments for a patron
 */
export const getPaymentHistory = query({
  args: {
    patronId: v.id("patrons"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("libraryPayments")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with staff who received payment
    const enrichedPage = await Promise.all(
      payments.page.map(async (payment) => {
        const receivedBy = await ctx.db.get(payment.receivedBy);
        return {
          ...payment,
          receivedByUser: receivedBy,
        };
      }),
    );

    return {
      ...payments,
      page: enrichedPage,
    };
  },
});

/**
 * Get fine statistics
 */
export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const fines = await ctx.db
      .query("libraryFines")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const outstanding = fines.filter((f) => f.status === "outstanding");
    const paid = fines.filter((f) => f.status === "paid");
    const waived = fines.filter((f) => f.status === "waived");

    const totalOutstanding = outstanding.reduce((sum, f) => sum + f.balance, 0);
    const totalCollected = paid.reduce((sum, f) => sum + f.amount, 0);
    const totalWaived = waived.reduce((sum, f) => sum + f.amount, 0);

    // Count by type
    const byType = {
      overdue: fines.filter((f) => f.fineType === "overdue").length,
      lost_item: fines.filter((f) => f.fineType === "lost_item").length,
      damaged_item: fines.filter((f) => f.fineType === "damaged_item").length,
      other: fines.filter((f) =>
        ["processing_fee", "replacement_cost", "membership_fee", "other"].includes(
          f.fineType,
        ),
      ).length,
    };

    // Fines created today
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const createdToday = fines.filter((f) => f.createdAt >= todayStart).length;

    // Get payments today
    const payments = await ctx.db
      .query("libraryPayments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.gte(q.field("receivedAt"), todayStart))
      .collect();

    const collectedToday = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalFines: fines.length,
      outstandingCount: outstanding.length,
      paidCount: paid.length,
      waivedCount: waived.length,
      totalOutstanding,
      totalCollected,
      totalWaived,
      byType,
      createdToday,
      collectedToday,
    };
  },
});

/**
 * Generate receipt for a payment
 */
export const getReceipt = query({
  args: {
    paymentId: v.id("libraryPayments"),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      return null;
    }

    const patron = await ctx.db.get(payment.patronId);
    const receivedBy = await ctx.db.get(payment.receivedBy);

    // Get details of paid fines
    const fines = await Promise.all(
      payment.fineIds.map(async (fineId) => {
        const fine = await ctx.db.get(fineId);
        return fine;
      }),
    );

    // Get library settings for receipt header/footer
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", payment.organizationId),
      )
      .first();

    return {
      payment,
      patron,
      receivedBy,
      fines: fines.filter(Boolean),
      receiptHeader: settings?.receiptHeader,
      receiptFooter: settings?.receiptFooter,
    };
  },
});
