import type { PaginationResult } from "convex/server";
import { type Infer, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireLibraryPermission } from "./utils/permissions";

const dashboardSection = v.union(
  v.literal("collection"),
  v.literal("patrons"),
  v.literal("circulation"),
  v.literal("holds"),
  v.literal("fines"),
);
const dashboardContinuation = v.object({
  organizationId: v.id("organizations"),
  section: dashboardSection,
  cursor: v.union(v.string(), v.null()),
  asOf: v.number(),
});
const dashboardStats = v.object({
  collection: v.object({
    totalItems: v.number(),
    publishedItems: v.number(),
    totalCopies: v.number(),
    availableCopies: v.number(),
    checkedOutCopies: v.number(),
  }),
  patrons: v.object({
    total: v.number(),
    active: v.number(),
    newThisMonth: v.number(),
  }),
  circulation: v.object({
    activeCheckouts: v.number(),
    overdueItems: v.number(),
    checkoutsToday: v.number(),
    returnsToday: v.number(),
    checkoutsThisMonth: v.number(),
  }),
  holds: v.object({
    pending: v.number(),
    available: v.number(),
    total: v.number(),
  }),
  fines: v.object({
    outstandingTotal: v.number(),
    collectedThisMonth: v.number(),
  }),
});
const nextDashboardSection: Record<
  Infer<typeof dashboardSection>,
  Infer<typeof dashboardSection> | null
> = {
  collection: "patrons",
  patrons: "circulation",
  circulation: "holds",
  holds: "fines",
  fines: null,
};

function dashboardPage(
  continuation: Infer<typeof dashboardContinuation>,
  page: Pick<PaginationResult<unknown>, "isDone" | "continueCursor">,
  partialStats: Infer<typeof dashboardStats>,
) {
  const section = page.isDone
    ? nextDashboardSection[continuation.section]
    : continuation.section;
  return {
    partialStats,
    asOf: continuation.asOf,
    next:
      section === null
        ? null
        : {
            ...continuation,
            section,
            cursor: page.isDone ? null : page.continueCursor,
          },
  };
}

/**
 * Read one bounded page of dashboard contributions, never a truncated total.
 * Sum every numeric field in partialStats across pages, passing next unchanged
 * as continuation, until next is null. Only then are the totals complete.
 * asOf freezes day/month/overdue boundaries; it is not a database snapshot.
 * Restart accumulation to refresh data after concurrent writes or time changes.
 */
export const getDashboardStats = query({
  args: {
    organizationId: v.id("organizations"),
    continuation: v.optional(dashboardContinuation),
    pageSize: v.optional(v.number()),
  },
  returns: v.object({
    partialStats: dashboardStats,
    asOf: v.number(),
    next: v.union(dashboardContinuation, v.null()),
  }),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
    const pageSize = args.pageSize ?? 100;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250) {
      throw new Error(
        "Dashboard page size must be an integer between 1 and 250",
      );
    }
    const continuation = args.continuation ?? {
      organizationId: args.organizationId,
      section: "collection",
      cursor: null,
      asOf: Date.now(),
    };
    if (continuation.organizationId !== args.organizationId) {
      throw new Error("Dashboard continuation belongs to another organization");
    }
    const now = continuation.asOf;
    if (!Number.isFinite(now) || Math.abs(now) > 8.64e15) {
      throw new Error("Invalid dashboard asOf timestamp");
    }
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const thisMonth = new Date(now);
    thisMonth.setUTCDate(1);
    thisMonth.setUTCHours(0, 0, 0, 0);
    const thisMonthStart = thisMonth.getTime();
    const paginationOpts = {
      numItems: pageSize,
      cursor: continuation.cursor,
      maximumRowsRead: 250,
      maximumBytesRead: 1024 * 1024,
    };
    const stats: Infer<typeof dashboardStats> = {
      collection: {
        totalItems: 0,
        publishedItems: 0,
        totalCopies: 0,
        availableCopies: 0,
        checkedOutCopies: 0,
      },
      patrons: { total: 0, active: 0, newThisMonth: 0 },
      circulation: {
        activeCheckouts: 0,
        overdueItems: 0,
        checkoutsToday: 0,
        returnsToday: 0,
        checkoutsThisMonth: 0,
      },
      holds: { pending: 0, available: 0, total: 0 },
      fines: { outstandingTotal: 0, collectedThisMonth: 0 },
    };
    switch (continuation.section) {
      case "collection": {
        const page = await ctx.db
          .query("libraryItems")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .paginate(paginationOpts);
        for (const item of page.page) {
          stats.collection.totalItems++;
          if (item.catalogStatus === "published")
            stats.collection.publishedItems++;
          stats.collection.totalCopies += item.totalCopies;
          stats.collection.availableCopies += item.availableCopies;
        }
        stats.collection.checkedOutCopies =
          stats.collection.totalCopies - stats.collection.availableCopies;
        return dashboardPage(continuation, page, stats);
      }
      case "patrons": {
        const page = await ctx.db
          .query("accounts")
          .withIndex("by_organization_and_accountType", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("accountType", "patron"),
          )
          .paginate(paginationOpts);
        for (const patron of page.page) {
          stats.patrons.total++;
          if (patron.status === "active") stats.patrons.active++;
          if (
            patron.registrationDate &&
            patron.registrationDate >= thisMonthStart
          )
            stats.patrons.newThisMonth++;
        }
        return dashboardPage(continuation, page, stats);
      }
      case "circulation": {
        const page = await ctx.db
          .query("circulations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .paginate(paginationOpts);
        for (const circulation of page.page) {
          if (circulation.status === "active") {
            stats.circulation.activeCheckouts++;
            if (circulation.dueDate < now) stats.circulation.overdueItems++;
          }
          if (circulation.checkoutDate >= todayStart)
            stats.circulation.checkoutsToday++;
          if (circulation.returnDate && circulation.returnDate >= todayStart)
            stats.circulation.returnsToday++;
          if (circulation.checkoutDate >= thisMonthStart)
            stats.circulation.checkoutsThisMonth++;
        }
        return dashboardPage(continuation, page, stats);
      }
      case "holds": {
        const page = await ctx.db
          .query("libraryHolds")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .paginate(paginationOpts);
        for (const hold of page.page) {
          if (hold.status === "pending") stats.holds.pending++;
          if (hold.status === "available") stats.holds.available++;
        }
        stats.holds.total = stats.holds.pending + stats.holds.available;
        return dashboardPage(continuation, page, stats);
      }
      case "fines": {
        const page = await ctx.db
          .query("libraryFines")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .paginate(paginationOpts);
        for (const fine of page.page) {
          if (fine.status === "outstanding")
            stats.fines.outstandingTotal += fine.balance;
          if (
            fine.status === "paid" &&
            fine.paidAt &&
            fine.paidAt >= thisMonthStart
          )
            stats.fines.collectedThisMonth += fine.amount;
        }
        return dashboardPage(continuation, page, stats);
      }
    }
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
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
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
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
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
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
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
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
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
