import type { PaginationResult } from "convex/server";
import { type Infer, v } from "convex/values";
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
    asOf: v.number(),
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
      asOf: args.asOf,
    };
    if (continuation.organizationId !== args.organizationId) {
      throw new Error("Dashboard continuation belongs to another organization");
    }
    if (continuation.asOf !== args.asOf) {
      throw new Error("Dashboard continuation asOf does not match query asOf");
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
