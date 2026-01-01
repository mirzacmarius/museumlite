import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

const circulationStatusValidator = v.union(
  v.literal("active"),
  v.literal("returned"),
  v.literal("overdue"),
  v.literal("lost"),
  v.literal("claimed_returned"),
);

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

    if (circulation.status === "returned") {
      throw new Error("Item has already been returned");
    }

    const now = Date.now();
    const copy = await ctx.db.get(circulation.copyId);
    const item = await ctx.db.get(circulation.itemId);
    const account = await ctx.db.get(circulation.accountId);

    let fineAmount = 0;
    let fineCreated = false;

    if (now > circulation.dueDate) {
      const settings = await ctx.db
        .query("librarySettings")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", circulation.organizationId),
        )
        .first();

      const gracePeriodMs =
        (settings?.gracePeriodDays || 0) * 24 * 60 * 60 * 1000;
      const overdueTime = now - circulation.dueDate - gracePeriodMs;

      if (overdueTime > 0) {
        const overdueDays = Math.ceil(overdueTime / (24 * 60 * 60 * 1000));

        let finePerDay = settings?.finePerDayDefault || 0.25;
        if (account?.membershipTypeId) {
          const membershipType = await ctx.db.get(account.membershipTypeId);
          if (membershipType) {
            finePerDay = membershipType.finePerDay;
          }
        }

        fineAmount = overdueDays * finePerDay;

        if (settings?.maxFinePerItem && fineAmount > settings.maxFinePerItem) {
          fineAmount = settings.maxFinePerItem;
        }

        if (fineAmount > 0) {
          await ctx.db.insert("libraryFines", {
            organizationId: circulation.organizationId,
            accountId: circulation.accountId,
            circulationId: args.circulationId,
            copyId: circulation.copyId,
            fineType: "overdue",
            description: `Overdue fine for "${item?.title || "Unknown item"}" (${overdueDays} days)`,
            amount: fineAmount,
            amountPaid: 0,
            balance: fineAmount,
            status: "outstanding",
            createdAt: now,
          });

          if (account) {
            await ctx.db.patch(circulation.accountId, {
              fineBalance: (account.fineBalance || 0) + fineAmount,
            });
          }

          fineCreated = true;
        }
      }
    }

    if (args.condition === "damaged" || args.condition === "lost") {
      const replacementCost = copy?.replacementCost || 25;

      await ctx.db.insert("libraryFines", {
        organizationId: circulation.organizationId,
        accountId: circulation.accountId,
        circulationId: args.circulationId,
        copyId: circulation.copyId,
        fineType: args.condition === "lost" ? "lost_item" : "damaged_item",
        description: `${args.condition === "lost" ? "Lost" : "Damaged"} item: "${item?.title || "Unknown item"}"`,
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
        await ctx.db.patch(circulation.copyId, {
          status: args.condition === "lost" ? "lost" : "damaged",
          conditionNotes: args.notes,
        });
      }
    } else {
      if (copy) {
        await ctx.db.patch(circulation.copyId, { status: "available" });
      }

      if (item) {
        await ctx.db.patch(circulation.itemId, {
          availableCopies: item.availableCopies + 1,
        });
      }
    }

    await ctx.db.patch(args.circulationId, {
      status: "returned",
      returnDate: now,
      checkedInBy: userId,
      notes: args.notes,
      fineAmount: fineAmount > 0 ? fineAmount : undefined,
      fineStatus: fineAmount > 0 ? "billed" : "none",
    });

    const pendingHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_item_and_status", (q) =>
        q.eq("itemId", circulation.itemId).eq("status", "pending"),
      )
      .collect();

    if (pendingHolds.length > 0) {
      pendingHolds.sort((a, b) => a.queuePosition - b.queuePosition);
      const nextHold = pendingHolds[0];

      if (nextHold) {
        const settings = await ctx.db
          .query("librarySettings")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", circulation.organizationId),
          )
          .first();

        const holdExpirationDays = settings?.holdExpirationDays || 7;
        const expirationDate = now + holdExpirationDays * 24 * 60 * 60 * 1000;

        await ctx.db.patch(nextHold._id, {
          status: "available",
          copyId: copy?._id,
          availableDate: now,
          expirationDate,
        });

        if (copy && args.condition !== "damaged" && args.condition !== "lost") {
          await ctx.db.patch(circulation.copyId, { status: "on_hold" });
          if (item) {
            await ctx.db.patch(circulation.itemId, {
              availableCopies: Math.max(0, item.availableCopies),
            });
          }
        }
      }
    }

    return {
      success: true,
      fineCreated,
      fineAmount: fineAmount > 0 ? fineAmount : undefined,
    };
  },
});

export const renew = mutation({
  args: {
    circulationId: v.id("circulations"),
  },
  returns: v.object({
    success: v.boolean(),
    newDueDate: v.number(),
    renewalCount: v.number(),
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

    if (circulation.status !== "active" && circulation.status !== "overdue") {
      throw new Error("Cannot renew: Item is not currently checked out");
    }

    const account = await ctx.db.get(circulation.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const item = await ctx.db.get(circulation.itemId);

    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", circulation.organizationId),
      )
      .first();

    let maxRenewals = item?.maxRenewals;
    if (maxRenewals === undefined && account.membershipTypeId) {
      const membershipType = await ctx.db.get(account.membershipTypeId);
      if (membershipType) {
        maxRenewals = membershipType.renewalLimit;
      }
    }
    if (maxRenewals === undefined) {
      maxRenewals = settings?.maxRenewalsAllowed || 2;
    }

    if (circulation.renewalCount >= maxRenewals) {
      throw new Error(
        `Maximum renewals (${maxRenewals}) reached for this item`,
      );
    }

    const holdCount = await ctx.db
      .query("libraryHolds")
      .withIndex("by_item_and_status", (q) =>
        q.eq("itemId", circulation.itemId).eq("status", "pending"),
      )
      .collect();

    if (holdCount.length > 0) {
      throw new Error("Cannot renew: Item has pending holds");
    }

    const now = Date.now();
    let renewalPeriodDays = settings?.renewalPeriodDays;
    if (!renewalPeriodDays && account.membershipTypeId) {
      const membershipType = await ctx.db.get(account.membershipTypeId);
      if (membershipType) {
        renewalPeriodDays = membershipType.loanPeriodDays;
      }
    }
    if (!renewalPeriodDays) {
      renewalPeriodDays = settings?.defaultLoanPeriodDays || 14;
    }

    const baseDate = Math.max(circulation.dueDate, now);
    const newDueDate = baseDate + renewalPeriodDays * 24 * 60 * 60 * 1000;

    const newRenewalCount = circulation.renewalCount + 1;

    await ctx.db.patch(args.circulationId, {
      dueDate: newDueDate,
      renewalCount: newRenewalCount,
      lastRenewalDate: now,
      status: "active",
    });

    return {
      success: true,
      newDueDate,
      renewalCount: newRenewalCount,
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
