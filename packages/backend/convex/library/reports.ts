import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireLibraryPermission } from "./utils/permissions";

/**
 * Get comprehensive library dashboard statistics
 */
export const getDashboardStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    // This month
    const thisMonth = new Date(now);
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthStart = thisMonth.getTime();

    // Collection stats
    const items = await ctx.db
      .query("libraryItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const totalItems = items.length;
    const publishedItems = items.filter(
      (i) => i.catalogStatus === "published",
    ).length;
    const totalCopies = items.reduce((sum, i) => sum + i.totalCopies, 0);
    const availableCopies = items.reduce(
      (sum, i) => sum + i.availableCopies,
      0,
    );

    const patronAccounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization_and_accountType", (q) =>
        q.eq("organizationId", args.organizationId).eq("accountType", "patron"),
      )
      .collect();

    const totalPatrons = patronAccounts.length;
    const activePatrons = patronAccounts.filter(
      (p) => p.status === "active",
    ).length;
    const newPatronsThisMonth = patronAccounts.filter(
      (p) => p.registrationDate && p.registrationDate >= thisMonthStart,
    ).length;

    // Circulation stats
    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeCheckouts = circulations.filter(
      (c) => c.status === "active",
    ).length;
    const overdueItems = circulations.filter(
      (c) => c.status === "active" && c.dueDate < now,
    ).length;
    const checkoutsToday = circulations.filter(
      (c) => c.checkoutDate >= todayStart,
    ).length;
    const returnsToday = circulations.filter(
      (c) => c.returnDate && c.returnDate >= todayStart,
    ).length;
    const checkoutsThisMonth = circulations.filter(
      (c) => c.checkoutDate >= thisMonthStart,
    ).length;

    // Hold stats
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const pendingHolds = holds.filter((h) => h.status === "pending").length;
    const availableHolds = holds.filter((h) => h.status === "available").length;

    // Fine stats
    const fines = await ctx.db
      .query("libraryFines")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const outstandingFines = fines
      .filter((f) => f.status === "outstanding")
      .reduce((sum, f) => sum + f.balance, 0);
    const collectedThisMonth = fines
      .filter(
        (f) => f.status === "paid" && f.paidAt && f.paidAt >= thisMonthStart,
      )
      .reduce((sum, f) => sum + f.amount, 0);

    return {
      collection: {
        totalItems,
        publishedItems,
        totalCopies,
        availableCopies,
        checkedOutCopies: totalCopies - availableCopies,
      },
      patrons: {
        total: totalPatrons,
        active: activePatrons,
        newThisMonth: newPatronsThisMonth,
      },
      circulation: {
        activeCheckouts,
        overdueItems,
        checkoutsToday,
        returnsToday,
        checkoutsThisMonth,
      },
      holds: {
        pending: pendingHolds,
        available: availableHolds,
        total: pendingHolds + availableHolds,
      },
      fines: {
        outstandingTotal: outstandingFines,
        collectedThisMonth,
      },
    };
  },
});

/**
 * Get circulation report for a date range
 */
export const getCirculationReport = query({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("checkoutDate"), args.startDate),
          q.lte(q.field("checkoutDate"), args.endDate),
        ),
      )
      .collect();

    const checkouts = circulations.length;
    const returns = circulations.filter((c) => c.returnDate).length;
    const renewals = circulations.reduce((sum, c) => sum + c.renewalCount, 0);

    // Group by day
    const byDay = new Map<string, { checkouts: number; returns: number }>();
    for (const circ of circulations) {
      const day = new Date(circ.checkoutDate).toISOString().split("T")[0] ?? "";
      const existing = byDay.get(day) || { checkouts: 0, returns: 0 };
      existing.checkouts++;
      if (circ.returnDate) {
        existing.returns++;
      }
      byDay.set(day, existing);
    }

    // Top borrowed items
    const itemCounts = new Map<string, number>();
    for (const circ of circulations) {
      const count = itemCounts.get(circ.itemId) || 0;
      itemCounts.set(circ.itemId, count + 1);
    }

    const topItemIds = Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topItems = await Promise.all(
      topItemIds.map(async ([itemId, count]) => {
        const item = await ctx.db.get(itemId as Id<"libraryItems">);
        return {
          item,
          checkoutCount: count,
        };
      }),
    );

    return {
      summary: {
        totalCheckouts: checkouts,
        totalReturns: returns,
        totalRenewals: renewals,
      },
      byDay: Array.from(byDay.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topItems: topItems.filter((t) => t.item !== null),
    };
  },
});

/**
 * Get patron activity report
 */
export const getPatronReport = query({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    const allPatronAccounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization_and_accountType", (q) =>
        q.eq("organizationId", args.organizationId).eq("accountType", "patron"),
      )
      .collect();

    const newRegistrations = allPatronAccounts.filter(
      (p) =>
        p.registrationDate &&
        p.registrationDate >= args.startDate &&
        p.registrationDate <= args.endDate,
    );

    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("checkoutDate"), args.startDate),
          q.lte(q.field("checkoutDate"), args.endDate),
        ),
      )
      .collect();

    const activeAccountIds = new Set(circulations.map((c) => c.accountId));

    const accountCheckouts = new Map<string, number>();
    for (const circ of circulations) {
      const count = accountCheckouts.get(circ.accountId) || 0;
      accountCheckouts.set(circ.accountId, count + 1);
    }

    const topBorrowerIds = Array.from(accountCheckouts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topBorrowers = await Promise.all(
      topBorrowerIds.map(async ([accountId, count]) => {
        const account = await ctx.db.get(accountId as Id<"accounts">);
        return {
          patron: account,
          checkoutCount: count,
        };
      }),
    );

    const statusBreakdown = {
      active: allPatronAccounts.filter((p) => p.status === "active").length,
      expired: allPatronAccounts.filter((p) => p.status === "expired").length,
      suspended: allPatronAccounts.filter((p) => p.status === "suspended")
        .length,
      blocked: allPatronAccounts.filter((p) => p.status === "blocked").length,
    };

    return {
      summary: {
        newRegistrations: newRegistrations.length,
        activePatrons: activeAccountIds.size,
        totalPatrons: allPatronAccounts.length,
      },
      statusBreakdown,
      topBorrowers: topBorrowers.filter((t) => t.patron !== null),
    };
  },
});

/**
 * Get collection report
 */
export const getCollectionReport = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    const items = await ctx.db
      .query("libraryItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // By type
    const byType = new Map<string, number>();
    for (const item of items) {
      const count = byType.get(item.itemType) || 0;
      byType.set(item.itemType, count + 1);
    }

    // By status
    const byStatus = {
      draft: items.filter((i) => i.catalogStatus === "draft").length,
      published: items.filter((i) => i.catalogStatus === "published").length,
      archived: items.filter((i) => i.catalogStatus === "archived").length,
    };

    // By language (top 10)
    const byLanguage = new Map<string, number>();
    for (const item of items) {
      const count = byLanguage.get(item.language) || 0;
      byLanguage.set(item.language, count + 1);
    }

    const topLanguages = Array.from(byLanguage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([language, count]) => ({ language, count }));

    // Items without copies
    const itemsWithoutCopies = items.filter((i) => i.totalCopies === 0).length;

    // Total copies
    const totalCopies = items.reduce((sum, i) => sum + i.totalCopies, 0);
    const availableCopies = items.reduce(
      (sum, i) => sum + i.availableCopies,
      0,
    );

    // Recent additions (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentAdditions = items.filter(
      (i) => i.createdAt >= thirtyDaysAgo,
    ).length;

    return {
      summary: {
        totalTitles: items.length,
        totalCopies,
        availableCopies,
        checkedOutCopies: totalCopies - availableCopies,
        itemsWithoutCopies,
        recentAdditions,
      },
      byType: Array.from(byType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      byStatus,
      topLanguages,
    };
  },
});

/**
 * Get financial report
 */
export const getFinancialReport = query({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    // Fines created in period
    const fines = await ctx.db
      .query("libraryFines")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), args.startDate),
          q.lte(q.field("createdAt"), args.endDate),
        ),
      )
      .collect();

    const totalFinesCreated = fines.reduce((sum, f) => sum + f.amount, 0);
    const totalCollected = fines
      .filter((f) => f.status === "paid")
      .reduce((sum, f) => sum + f.amount, 0);
    const totalWaived = fines
      .filter((f) => f.status === "waived")
      .reduce((sum, f) => sum + f.amount, 0);
    const outstandingBalance = fines
      .filter((f) => f.status === "outstanding")
      .reduce((sum, f) => sum + f.balance, 0);

    // By type
    const byType = {
      overdue: fines
        .filter((f) => f.fineType === "overdue")
        .reduce((sum, f) => sum + f.amount, 0),
      lostItem: fines
        .filter((f) => f.fineType === "lost_item")
        .reduce((sum, f) => sum + f.amount, 0),
      damagedItem: fines
        .filter((f) => f.fineType === "damaged_item")
        .reduce((sum, f) => sum + f.amount, 0),
      other: fines
        .filter((f) =>
          [
            "processing_fee",
            "replacement_cost",
            "membership_fee",
            "other",
          ].includes(f.fineType),
        )
        .reduce((sum, f) => sum + f.amount, 0),
    };

    // Payments in period
    const payments = await ctx.db
      .query("libraryPayments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("receivedAt"), args.startDate),
          q.lte(q.field("receivedAt"), args.endDate),
        ),
      )
      .collect();

    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    // By payment method
    const byPaymentMethod = new Map<string, number>();
    for (const payment of payments) {
      const current = byPaymentMethod.get(payment.paymentMethod) || 0;
      byPaymentMethod.set(payment.paymentMethod, current + payment.amount);
    }

    // Acquisitions spending
    const acquisitions = await ctx.db
      .query("libraryAcquisitionRequests")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("requestedAt"), args.startDate),
          q.lte(q.field("requestedAt"), args.endDate),
        ),
      )
      .collect();

    const acquisitionSpending = acquisitions
      .filter(
        (a) => a.actualPrice && ["received", "cataloged"].includes(a.status),
      )
      .reduce((sum, a) => sum + (a.actualPrice || 0) * a.quantity, 0);

    return {
      fines: {
        totalCreated: totalFinesCreated,
        totalCollected,
        totalWaived,
        outstandingBalance,
        byType,
        count: fines.length,
      },
      payments: {
        total: totalPayments,
        count: payments.length,
        byMethod: Array.from(byPaymentMethod.entries())
          .map(([method, amount]) => ({ method, amount }))
          .sort((a, b) => b.amount - a.amount),
      },
      acquisitions: {
        totalSpent: acquisitionSpending,
        count: acquisitions.length,
      },
    };
  },
});
