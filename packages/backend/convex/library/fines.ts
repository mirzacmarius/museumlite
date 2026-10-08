import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { mutation } from "../utils/mutationBuilders";
import { requireLibraryPermission } from "./utils/permissions";
import { assertSameOrganization } from "./utils/tenantIntegrity";

const fineTypeValidator = v.union(
  v.literal("overdue"),
  v.literal("lost_item"),
  v.literal("damaged_item"),
  v.literal("processing_fee"),
  v.literal("replacement_cost"),
  v.literal("membership_fee"),
  v.literal("other"),
);

const fineStatusValidator = v.union(
  v.literal("outstanding"),
  v.literal("paid"),
  v.literal("waived"),
  v.literal("forgiven"),
  v.literal("refunded"),
);

const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("check"),
  v.literal("online"),
  v.literal("other"),
);

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    fineType: fineTypeValidator,
    description: v.string(),
    amount: v.number(),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryFines"),
  handler: async (ctx, args) => {
    const [userId, account] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accountId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!account) {
      throw new Error("Account not found");
    }

    await requireLibraryPermission(
      ctx,
      account.organizationId,
      "accounts.write",
    );

    const now = Date.now();

    const fineId = await ctx.db.insert("libraryFines", {
      organizationId: account.organizationId,
      accountId: args.accountId,
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

    await ctx.db.patch(args.accountId, {
      fineBalance: (account.fineBalance || 0) + args.amount,
    });

    return fineId;
  },
});

export const recordPayment = mutation({
  args: {
    accountId: v.id("accounts"),
    amount: v.number(),
    paymentMethod: paymentMethodValidator,
    fineIds: v.optional(v.array(v.id("libraryFines"))),
    receiptNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryPayments"),
  handler: async (ctx, args) => {
    const [userId, account] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accountId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!account) {
      throw new Error("Account not found");
    }

    if (args.amount <= 0) {
      throw new Error("Payment amount must be positive");
    }

    await requireLibraryPermission(
      ctx,
      account.organizationId,
      "accounts.write",
    );

    const now = Date.now();
    let remainingPayment = args.amount;
    let appliedPayment = 0;
    const paidFineIds: Id<"libraryFines">[] = [];

    if (args.fineIds && args.fineIds.length > 0) {
      const fines = await Promise.all(
        args.fineIds.map((fineId) => ctx.db.get(fineId)),
      );
      const payableFines: Array<{
        fineId: Id<"libraryFines">;
        fine: NonNullable<(typeof fines)[number]>;
      }> = [];

      for (let i = 0; i < args.fineIds.length; i++) {
        const fineId = args.fineIds[i];
        const fine = fines[i];
        if (!fineId || !fine) {
          throw new Error("Fine not found");
        }
        assertSameOrganization(
          fine.organizationId,
          account.organizationId,
          "Fine",
        );
        if (fine.accountId !== args.accountId) {
          throw new Error("Fine does not belong to the specified account");
        }
        if (fine.status !== "outstanding") {
          throw new Error("Can only pay outstanding fines");
        }

        payableFines.push({ fineId, fine });
      }

      const patchPromises: Array<Promise<void>> = [];

      for (const { fineId, fine } of payableFines) {
        if (remainingPayment <= 0) break;

        const paymentForFine = Math.min(remainingPayment, fine.balance);
        const newAmountPaid = fine.amountPaid + paymentForFine;
        const newBalance = fine.amount - newAmountPaid;

        patchPromises.push(
          ctx.db
            .patch(fineId, {
              amountPaid: newAmountPaid,
              balance: newBalance,
              status: newBalance <= 0 ? "paid" : "outstanding",
              paidAt: newBalance <= 0 ? now : undefined,
            })
            .then(() => undefined),
        );

        remainingPayment -= paymentForFine;
        appliedPayment += paymentForFine;
        paidFineIds.push(fineId);
      }

      await Promise.all(patchPromises);
    } else {
      const outstandingFines = await ctx.db
        .query("libraryFines")
        .withIndex("by_account_and_status", (q) =>
          q.eq("accountId", args.accountId).eq("status", "outstanding"),
        )
        .collect();

      outstandingFines.sort((a, b) => a.createdAt - b.createdAt);

      const patchPromises: Array<Promise<void>> = [];
      for (const fine of outstandingFines) {
        if (remainingPayment <= 0) break;

        const paymentForFine = Math.min(remainingPayment, fine.balance);
        const newAmountPaid = fine.amountPaid + paymentForFine;
        const newBalance = fine.amount - newAmountPaid;

        patchPromises.push(
          ctx.db
            .patch(fine._id, {
              amountPaid: newAmountPaid,
              balance: newBalance,
              status: newBalance <= 0 ? "paid" : "outstanding",
              paidAt: newBalance <= 0 ? now : undefined,
            })
            .then(() => undefined),
        );

        remainingPayment -= paymentForFine;
        appliedPayment += paymentForFine;
        paidFineIds.push(fine._id);
      }

      await Promise.all(patchPromises);
    }

    const paymentId = await ctx.db.insert("libraryPayments", {
      organizationId: account.organizationId,
      accountId: args.accountId,
      amount: args.amount,
      paymentMethod: args.paymentMethod,
      fineIds: paidFineIds,
      receiptNumber: args.receiptNumber,
      receivedBy: userId,
      receivedAt: now,
      notes: args.notes,
    });

    const newBalance = Math.max(0, (account.fineBalance || 0) - appliedPayment);
    await ctx.db.patch(args.accountId, { fineBalance: newBalance });

    return paymentId;
  },
});

export const waive = mutation({
  args: {
    fineId: v.id("libraryFines"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, fine] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.fineId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!fine) {
      throw new Error("Fine not found");
    }

    if (fine.status !== "outstanding") {
      throw new Error("Can only waive outstanding fines");
    }

    await requireLibraryPermission(ctx, fine.organizationId, "accounts.write");

    const [, account] = await Promise.all([
      ctx.db.patch(args.fineId, {
        status: "waived",
        waivedBy: userId,
        waivedReason: args.reason,
      }),
      ctx.db.get(fine.accountId),
    ] as const);

    if (account) {
      await ctx.db.patch(fine.accountId, {
        fineBalance: Math.max(0, (account.fineBalance || 0) - fine.balance),
      });
    }

    return null;
  },
});

export const forgive = mutation({
  args: {
    fineId: v.id("libraryFines"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, fine] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.fineId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!fine) {
      throw new Error("Fine not found");
    }

    if (fine.status !== "outstanding") {
      throw new Error("Can only forgive outstanding fines");
    }

    await requireLibraryPermission(ctx, fine.organizationId, "accounts.write");

    const [, account] = await Promise.all([
      ctx.db.patch(args.fineId, {
        status: "forgiven",
        waivedBy: userId,
        waivedReason: args.reason,
      }),
      ctx.db.get(fine.accountId),
    ] as const);

    if (account) {
      await ctx.db.patch(fine.accountId, {
        fineBalance: Math.max(0, (account.fineBalance || 0) - fine.balance),
      });
    }

    return null;
  },
});

export const get = query({
  args: {
    fineId: v.id("libraryFines"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const fine = await ctx.db.get(args.fineId);
    if (!fine) {
      return null;
    }

    await requireLibraryPermission(ctx, fine.organizationId, "accounts.read");

    const account = await ctx.db.get(fine.accountId);
    const circulation = fine.circulationId
      ? await ctx.db.get(fine.circulationId)
      : null;
    const item = circulation ? await ctx.db.get(circulation.itemId) : null;
    const copy = fine.copyId ? await ctx.db.get(fine.copyId) : null;

    return {
      ...fine,
      account,
      circulation,
      copy,
      item,
    };
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(fineStatusValidator),
    fineType: v.optional(fineTypeValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "accounts.read");

    const query = args.status
      ? ctx.db
          .query("libraryFines")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("libraryFines")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const fines = await query.paginate(args.paginationOpts);

    let filteredPage = fines.page;
    if (args.fineType) {
      filteredPage = fines.page.filter((f) => f.fineType === args.fineType);
    }

    const enrichedPage = await Promise.all(
      filteredPage.map(async (fine) => {
        const account = await ctx.db.get(fine.accountId);
        return {
          ...fine,
          account,
        };
      }),
    );

    return {
      ...fines,
      page: enrichedPage,
    };
  },
});

export const getPaymentHistory = query({
  args: {
    accountId: v.id("accounts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireLibraryPermission(
      ctx,
      account.organizationId,
      "accounts.read",
    );

    const payments = await ctx.db
      .query("libraryPayments")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .order("desc")
      .paginate(args.paginationOpts);

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

export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalFines: v.number(),
    outstandingCount: v.number(),
    paidCount: v.number(),
    waivedCount: v.number(),
    totalOutstanding: v.number(),
    totalCollected: v.number(),
    totalWaived: v.number(),
    byType: v.object({
      overdue: v.number(),
      lost_item: v.number(),
      damaged_item: v.number(),
      other: v.number(),
    }),
    createdToday: v.number(),
    collectedToday: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "accounts.read");

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

    const byType = {
      overdue: fines.filter((f) => f.fineType === "overdue").length,
      lost_item: fines.filter((f) => f.fineType === "lost_item").length,
      damaged_item: fines.filter((f) => f.fineType === "damaged_item").length,
      other: fines.filter((f) =>
        [
          "processing_fee",
          "replacement_cost",
          "membership_fee",
          "other",
        ].includes(f.fineType),
      ).length,
    };

    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const createdToday = fines.filter((f) => f.createdAt >= todayStart).length;

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

export const getReceipt = query({
  args: {
    paymentId: v.id("libraryPayments"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      return null;
    }

    await requireLibraryPermission(
      ctx,
      payment.organizationId,
      "accounts.read",
    );

    const [account, receivedBy, fines, settings] = await Promise.all([
      ctx.db.get(payment.accountId),
      ctx.db.get(payment.receivedBy),
      Promise.all(
        payment.fineIds.map(async (fineId) => {
          const fine = await ctx.db.get(fineId);
          return fine;
        }),
      ),
      ctx.db
        .query("librarySettings")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", payment.organizationId),
        )
        .first(),
    ]);
    return {
      payment,
      account,
      receivedBy,
      fines: fines.filter(Boolean),
      receiptHeader: settings?.receiptHeader,
      receiptFooter: settings?.receiptFooter,
    };
  },
});
