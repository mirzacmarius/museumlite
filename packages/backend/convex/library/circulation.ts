import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireModuleEnabled } from "../utils/featureGates";

export const checkout = mutation({
  args: {
    accountId: v.id("accounts"),
    copyId: v.id("itemCopies"),
    dueDate: v.optional(v.number()),
  },
  returns: v.id("circulations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    if (account.accountType !== "patron") {
      throw new Error("Only patron accounts can checkout library items");
    }

    if (account.status !== "active") {
      throw new Error(`Cannot checkout: Account status is ${account.status}`);
    }

    await requireModuleEnabled(ctx, account.organizationId, "library");

    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", account.organizationId),
      )
      .first();

    if (
      settings?.fineThresholdForBlock &&
      account.fineBalance &&
      account.fineBalance >= settings.fineThresholdForBlock
    ) {
      throw new Error(
        `Cannot checkout: Account has outstanding fines of $${account.fineBalance.toFixed(2)}`,
      );
    }

    const activeCheckouts = await ctx.db
      .query("circulations")
      .withIndex("by_account_and_status", (q) =>
        q.eq("accountId", args.accountId).eq("status", "active"),
      )
      .collect();

    const borrowingLimit = account.borrowingLimit ?? 10;
    if (activeCheckouts.length >= borrowingLimit) {
      throw new Error(
        `Account has reached borrowing limit of ${borrowingLimit}`,
      );
    }

    const copy = await ctx.db.get(args.copyId);
    if (!copy) {
      throw new Error("Copy not found");
    }

    if (copy.status !== "available") {
      throw new Error(`Copy is not available (status: ${copy.status})`);
    }

    const item = await ctx.db.get(copy.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    if (!item.isCirculating) {
      throw new Error(
        "This item is for reference only and cannot be checked out",
      );
    }

    const now = Date.now();
    let dueDate = args.dueDate;

    if (!dueDate) {
      let loanPeriodDays = item.loanPeriodDays;

      if (!loanPeriodDays && account.membershipTypeId) {
        const membershipType = await ctx.db.get(account.membershipTypeId);
        if (membershipType) {
          loanPeriodDays = membershipType.loanPeriodDays;
        }
      }

      if (!loanPeriodDays) {
        loanPeriodDays = settings?.defaultLoanPeriodDays || 14;
      }

      dueDate = now + loanPeriodDays * 24 * 60 * 60 * 1000;
    }

    const circulationId = await ctx.db.insert("circulations", {
      organizationId: account.organizationId,
      accountId: args.accountId,
      copyId: args.copyId,
      itemId: copy.itemId,
      checkoutDate: now,
      dueDate,
      renewalCount: 0,
      status: "active",
      fineStatus: "none",
      checkedOutBy: userId,
    });

    await ctx.db.patch(args.copyId, { status: "checked_out" });

    await ctx.db.patch(copy.itemId, {
      availableCopies: Math.max(0, item.availableCopies - 1),
    });

    await ctx.db.patch(args.accountId, {
      totalCheckouts: (account.totalCheckouts || 0) + 1,
    });

    return circulationId;
  },
});

export const checkin = mutation({
  args: {
    circulationId: v.id("circulations"),
    condition: v.optional(
      v.union(v.literal("good"), v.literal("damaged"), v.literal("lost")),
    ),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    fineCreated: v.boolean(),
    fineAmount: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const circulation = await ctx.db.get(args.circulationId);
    if (!circulation) {
      throw new Error("Circulation record not found");
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    if (circulation.status === "returned") {
      throw new Error("Item is already checked in");
    }

    const account = await ctx.db.get(circulation.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const item = await ctx.db.get(circulation.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    const copy = await ctx.db.get(circulation.copyId);
    if (!copy) {
      throw new Error("Copy not found");
    }

    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", circulation.organizationId),
      )
      .first();

    const membershipType = account.membershipTypeId
      ? await ctx.db.get(account.membershipTypeId)
      : null;

    const finePerDay =
      membershipType?.finePerDay ?? settings?.finePerDayDefault ?? 0;
    const gracePeriodDays =
      membershipType?.gracePeriodDays ?? settings?.gracePeriodDays ?? 0;

    const now = Date.now();
    let fineAmount: number | undefined;

    if (now > circulation.dueDate && finePerDay > 0) {
      const overdueDays = Math.ceil(
        (now - circulation.dueDate) / (24 * 60 * 60 * 1000),
      );
      const billableDays = Math.max(0, overdueDays - gracePeriodDays);
      if (billableDays > 0) {
        fineAmount = billableDays * finePerDay;
      }
    }

    await ctx.db.patch(args.circulationId, {
      status: "returned",
      returnDate: now,
      checkedInBy: userId,
      notes: args.notes,
      fineAmount: fineAmount ?? circulation.fineAmount,
      fineStatus: fineAmount ? "billed" : "none",
    });

    await ctx.db.patch(copy._id, { status: "available" });
    await ctx.db.patch(item._id, {
      availableCopies: item.availableCopies + 1,
    });

    let fineCreated = false;
    if (fineAmount && fineAmount > 0) {
      fineCreated = true;
      await ctx.db.insert("libraryFines", {
        organizationId: circulation.organizationId,
        accountId: circulation.accountId,
        circulationId: circulation._id,
        copyId: circulation.copyId,
        fineType: "overdue",
        description: `Overdue fine for ${item.title}`,
        amount: fineAmount,
        amountPaid: 0,
        balance: fineAmount,
        status: "outstanding",
        createdAt: now,
      });

      await ctx.db.patch(account._id, {
        fineBalance: (account.fineBalance || 0) + fineAmount,
      });
    }

    return {
      success: true,
      fineCreated,
      fineAmount,
    };
  },
});

export const markLost = mutation({
  args: {
    circulationId: v.id("circulations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const circulation = await ctx.db.get(args.circulationId);
    if (!circulation) {
      throw new Error("Circulation record not found");
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    if (circulation.status === "returned" || circulation.status === "lost") {
      throw new Error("Invalid status for marking as lost");
    }

    const copy = await ctx.db.get(circulation.copyId);
    const item = await ctx.db.get(circulation.itemId);
    const account = await ctx.db.get(circulation.accountId);

    const now = Date.now();
    const replacementCost = copy?.replacementCost || 25;

    await ctx.db.insert("libraryFines", {
      organizationId: circulation.organizationId,
      accountId: circulation.accountId,
      circulationId: args.circulationId,
      copyId: circulation.copyId,
      fineType: "lost_item",
      description: `Lost item: "${item?.title || "Unknown item"}"`,
      amount: replacementCost,
      amountPaid: 0,
      balance: replacementCost,
      status: "outstanding",
      createdAt: now,
    });

    if (account) {
      await ctx.db.patch(circulation.accountId, {
        fineBalance: (account.fineBalance || 0) + replacementCost,
      });
    }

    if (copy) {
      await ctx.db.patch(circulation.copyId, { status: "lost" });
    }

    await ctx.db.patch(args.circulationId, {
      status: "lost",
      fineAmount: replacementCost,
      fineStatus: "billed",
    });

    return null;
  },
});

export const markClaimedReturned = mutation({
  args: {
    circulationId: v.id("circulations"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const circulation = await ctx.db.get(args.circulationId);
    if (!circulation) {
      throw new Error("Circulation record not found");
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    await ctx.db.patch(args.circulationId, {
      status: "claimed_returned",
      notes: args.notes,
    });

    return null;
  },
});

export const get = query({
  args: {
    circulationId: v.id("circulations"),
  },
  handler: async (ctx, args) => {
    const circulation = await ctx.db.get(args.circulationId);
    if (!circulation) {
      return null;
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    const account = await ctx.db.get(circulation.accountId);
    const copy = await ctx.db.get(circulation.copyId);
    const item = await ctx.db.get(circulation.itemId);

    return {
      ...circulation,
      account,
      copy,
      item,
    };
  },
});

export const getByBarcode = query({
  args: {
    organizationId: v.id("organizations"),
    barcode: v.string(),
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const copy = await ctx.db
      .query("itemCopies")
      .withIndex("by_organization_and_barcode", (q) =>
        q.eq("organizationId", args.organizationId).eq("barcode", args.barcode),
      )
      .first();

    if (!copy) {
      return null;
    }

    const circulation = await ctx.db
      .query("circulations")
      .withIndex("by_copy", (q) => q.eq("copyId", copy._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "overdue"),
        ),
      )
      .first();

    if (!circulation) {
      return { copy, circulation: null };
    }

    const account = await ctx.db.get(circulation.accountId);
    const item = await ctx.db.get(circulation.itemId);

    return {
      copy,
      circulation: {
        ...circulation,
        account,
        item,
      },
    };
  },
});

export const listActive = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .paginate(args.paginationOpts);

    const enrichedPage = await Promise.all(
      circulations.page.map(async (circulation) => {
        const account = await ctx.db.get(circulation.accountId);
        const copy = await ctx.db.get(circulation.copyId);
        const item = await ctx.db.get(circulation.itemId);
        return {
          ...circulation,
          account,
          copy,
          item,
        };
      }),
    );

    return {
      ...circulations,
      page: enrichedPage,
    };
  },
});

export const listOverdue = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const now = Date.now();

    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .filter((q) => q.lt(q.field("dueDate"), now))
      .paginate(args.paginationOpts);

    const enrichedPage = await Promise.all(
      circulations.page.map(async (circulation) => {
        const account = await ctx.db.get(circulation.accountId);
        const copy = await ctx.db.get(circulation.copyId);
        const item = await ctx.db.get(circulation.itemId);
        const daysOverdue = Math.ceil(
          (now - circulation.dueDate) / (24 * 60 * 60 * 1000),
        );
        return {
          ...circulation,
          account,
          copy,
          item,
          daysOverdue,
        };
      }),
    );

    return {
      ...circulations,
      page: enrichedPage,
    };
  },
});

export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    activeCheckouts: v.number(),
    overdueItems: v.number(),
    lostItems: v.number(),
    checkoutsToday: v.number(),
    returnsToday: v.number(),
    dueSoon: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const now = Date.now();

    const allCirculations = await ctx.db
      .query("circulations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeCount = allCirculations.filter(
      (c) => c.status === "active",
    ).length;
    const overdueCount = allCirculations.filter(
      (c) => c.status === "active" && c.dueDate < now,
    ).length;
    const lostCount = allCirculations.filter((c) => c.status === "lost").length;

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const checkoutsToday = allCirculations.filter(
      (c) => c.checkoutDate >= todayStart,
    ).length;

    const returnsToday = allCirculations.filter(
      (c) => c.returnDate && c.returnDate >= todayStart,
    ).length;

    const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;
    const dueSoonCount = allCirculations.filter(
      (c) =>
        c.status === "active" &&
        c.dueDate > now &&
        c.dueDate <= threeDaysFromNow,
    ).length;

    return {
      activeCheckouts: activeCount,
      overdueItems: overdueCount,
      lostItems: lostCount,
      checkoutsToday,
      returnsToday,
      dueSoon: dueSoonCount,
    };
  },
});

export const searchForCheckout = query({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const searchQuery = args.query.trim();
    if (!searchQuery) {
      return [];
    }

    const copyByBarcode = await ctx.db
      .query("itemCopies")
      .withIndex("by_organization_and_barcode", (q) =>
        q.eq("organizationId", args.organizationId).eq("barcode", searchQuery),
      )
      .first();

    if (copyByBarcode) {
      const item = await ctx.db.get(copyByBarcode.itemId);
      return [
        {
          copy: copyByBarcode,
          item,
        },
      ];
    }

    const items = await ctx.db
      .query("libraryItems")
      .withSearchIndex("search_library_items", (q) =>
        q
          .search("title", searchQuery)
          .eq("organizationId", args.organizationId)
          .eq("catalogStatus", "published"),
      )
      .take(10);

    const results = await Promise.all(
      items.map(async (item) => {
        const copies = await ctx.db
          .query("itemCopies")
          .withIndex("by_item", (q) => q.eq("itemId", item._id))
          .filter((q) => q.eq(q.field("status"), "available"))
          .collect();

        return copies.map((copy) => ({
          copy,
          item,
        }));
      }),
    );

    return results.flat();
  },
});
