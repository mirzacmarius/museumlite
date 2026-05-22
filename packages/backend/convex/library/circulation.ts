import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import { requireModuleEnabled } from "../utils/featureGates";
import {
  assertBorrowingLimitAllowsCheckout,
  assertCopyAvailable,
  assertFineThresholdAllowsCheckout,
  assertItemCanCirculate,
  assertPatronAccountCanCheckout,
  calculateOverdueFine,
  resolveCheckoutDueDate,
} from "./utils/circulationRules";

export const checkout = mutation({
  args: {
    accountId: v.id("accounts"),
    copyId: v.id("itemCopies"),
    dueDate: v.optional(v.number()),
  },
  returns: v.id("circulations"),
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

    assertPatronAccountCanCheckout(account);

    await requireModuleEnabled(ctx, account.organizationId, "library");

    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", account.organizationId),
      )
      .first();

    assertFineThresholdAllowsCheckout({ account, settings });

    const activeCheckouts = await ctx.db
      .query("circulations")
      .withIndex("by_account_and_status", (q) =>
        q.eq("accountId", args.accountId).eq("status", "active"),
      )
      .collect();

    assertBorrowingLimitAllowsCheckout({
      account,
      activeCheckoutCount: activeCheckouts.length,
    });

    const copy = await ctx.db.get(args.copyId);
    if (!copy) {
      throw new Error("Copy not found");
    }

    assertCopyAvailable(copy);

    const item = await ctx.db.get(copy.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    assertItemCanCirculate(item);

    const membershipType = account.membershipTypeId
      ? await ctx.db.get(account.membershipTypeId)
      : null;

    const now = Date.now();
    const dueDate = resolveCheckoutDueDate({
      requestedDueDate: args.dueDate,
      now,
      item,
      membershipType,
      settings,
    });
    await Promise.all([
      ctx.db.patch(args.copyId, { status: "checked_out" }),
      ctx.db.patch(copy.itemId, {
        availableCopies: Math.max(0, item.availableCopies - 1),
      }),
    ]);
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
    const [userId, circulation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.circulationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!circulation) {
      throw new Error("Circulation record not found");
    }

    if (circulation.status === "returned") {
      throw new Error("Item is already checked in");
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

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
    const fineAmount = calculateOverdueFine({
      now,
      dueDate: circulation.dueDate,
      finePerDay,
      gracePeriodDays,
    });
    await Promise.all([
      ctx.db.patch(args.circulationId, {
        status: "returned",
        returnDate: now,
        checkedInBy: userId,
        notes: args.notes,
        fineAmount: fineAmount ?? circulation.fineAmount,
        fineStatus: fineAmount ? "billed" : "none",
      }),
      ctx.db.patch(copy._id, { status: "available" }),
      ctx.db.patch(item._id, {
        availableCopies: item.availableCopies + 1,
      }),
    ] as const);

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
    const [userId, circulation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.circulationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!circulation) {
      throw new Error("Circulation record not found");
    }

    if (circulation.status === "returned" || circulation.status === "lost") {
      throw new Error("Invalid status for marking as lost");
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    const [copy, item, account] = await Promise.all([
      ctx.db.get(circulation.copyId),
      ctx.db.get(circulation.itemId),
      ctx.db.get(circulation.accountId),
    ] as const);
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
    const [userId, circulation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.circulationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const circulation = await ctx.db.get(args.circulationId);
    if (!circulation) {
      return null;
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    const [account, copy, item] = await Promise.all([
      ctx.db.get(circulation.accountId),
      ctx.db.get(circulation.copyId),
      ctx.db.get(circulation.itemId),
    ] as const);
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
  returns: v.union(v.any(), v.null()),
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

    const [account, item] = await Promise.all([
      ctx.db.get(circulation.accountId),
      ctx.db.get(circulation.itemId),
    ] as const);
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
  returns: v.any(),
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
        const [account, copy, item] = await Promise.all([
          ctx.db.get(circulation.accountId),
          ctx.db.get(circulation.copyId),
          ctx.db.get(circulation.itemId),
        ] as const);
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
  returns: v.any(),
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
        const [account, copy, item] = await Promise.all([
          ctx.db.get(circulation.accountId),
          ctx.db.get(circulation.copyId),
          ctx.db.get(circulation.itemId),
        ] as const);
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
  returns: v.array(v.any()),
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

// ============================================================================
// Renewal Functions
// ============================================================================

/**
 * Renew a circulation (extend due date)
 */
export const renew = mutation({
  args: {
    circulationId: v.id("circulations"),
  },
  returns: v.object({
    success: v.boolean(),
    newDueDate: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const [userId, circulation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.circulationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!circulation) {
      return { success: false, error: "Circulation not found" };
    }

    if (circulation.status !== "active") {
      return { success: false, error: "Item is not currently checked out" };
    }

    if (circulation.isRecalled) {
      return {
        success: false,
        error: "Item has been recalled and cannot be renewed",
      };
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    const account = await ctx.db.get(circulation.accountId);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const item = await ctx.db.get(circulation.itemId);
    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Check if there are holds on this item
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_item_and_status", (q) =>
        q.eq("itemId", circulation.itemId).eq("status", "pending"),
      )
      .first();

    if (holds) {
      return {
        success: false,
        error: "Item has pending holds and cannot be renewed",
      };
    }

    // Get settings for renewal limits
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", circulation.organizationId),
      )
      .first();

    const membershipType = account.membershipTypeId
      ? await ctx.db.get(account.membershipTypeId)
      : null;

    const maxRenewals =
      item.maxRenewals ??
      membershipType?.renewalLimit ??
      settings?.maxRenewalsAllowed ??
      3;

    if (circulation.renewalCount >= maxRenewals) {
      return {
        success: false,
        error: `Maximum renewals (${maxRenewals}) reached`,
      };
    }

    // Calculate new due date
    const renewalPeriodDays =
      item.loanPeriodDays ??
      membershipType?.loanPeriodDays ??
      settings?.renewalPeriodDays ??
      settings?.defaultLoanPeriodDays ??
      14;

    const now = Date.now();
    const newDueDate = now + renewalPeriodDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.circulationId, {
      dueDate: newDueDate,
      renewalCount: circulation.renewalCount + 1,
      lastRenewalDate: now,
    });

    return { success: true, newDueDate };
  },
});

/**
 * Auto-renew eligible items (for cron job)
 */
export const autoRenewEligibleItems = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    renewedCount: v.number(),
    failedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");

    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!settings?.autoRenewalEnabled) {
      return { renewedCount: 0, failedCount: 0, skippedCount: 0 };
    }

    const daysBeforeDue = settings.autoRenewalDaysBeforeDue ?? 1;
    const now = Date.now();
    const targetDate = now + daysBeforeDue * 24 * 60 * 60 * 1000;

    // Find circulations due within the target window
    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .filter((q) =>
        q.and(
          q.lte(q.field("dueDate"), targetDate),
          q.gt(q.field("dueDate"), now),
        ),
      )
      .collect();

    const renewalOutcomes = await Promise.all(
      circulations.map(async (circulation) => {
        const account = await ctx.db.get(circulation.accountId);
        if (!account?.autoRenewalEnabled) {
          return "skipped" as const;
        }

        if (circulation.isRecalled) {
          await ctx.db.patch(circulation._id, {
            lastAutoRenewalAttempt: now,
            autoRenewalFailureReason: "Item recalled",
          });
          return "failed" as const;
        }

        const holds = await ctx.db
          .query("libraryHolds")
          .withIndex("by_item_and_status", (q) =>
            q.eq("itemId", circulation.itemId).eq("status", "pending"),
          )
          .first();

        if (holds) {
          await ctx.db.patch(circulation._id, {
            lastAutoRenewalAttempt: now,
            autoRenewalFailureReason: "Pending holds on item",
          });
          return "failed" as const;
        }

        const item = await ctx.db.get(circulation.itemId);
        const membershipType = account.membershipTypeId
          ? await ctx.db.get(account.membershipTypeId)
          : null;

        const maxRenewals =
          item?.maxRenewals ??
          membershipType?.renewalLimit ??
          settings.maxRenewalsAllowed ??
          3;

        if (circulation.renewalCount >= maxRenewals) {
          await ctx.db.patch(circulation._id, {
            lastAutoRenewalAttempt: now,
            autoRenewalFailureReason: `Maximum renewals (${maxRenewals}) reached`,
          });
          return "failed" as const;
        }

        const renewalPeriodDays =
          item?.loanPeriodDays ??
          membershipType?.loanPeriodDays ??
          settings.renewalPeriodDays ??
          settings.defaultLoanPeriodDays;

        const newDueDate = now + renewalPeriodDays * 24 * 60 * 60 * 1000;

        await ctx.db.patch(circulation._id, {
          dueDate: newDueDate,
          renewalCount: circulation.renewalCount + 1,
          lastRenewalDate: now,
          autoRenewed: true,
          lastAutoRenewalAttempt: now,
          autoRenewalFailureReason: undefined,
        });

        if (account.userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: args.organizationId,
            userId: account.userId,
            type: "library_auto_renewal",
            title: "Item Auto-Renewed",
            message: `Your checkout of "${item?.title}" has been automatically renewed. New due date: ${new Date(newDueDate).toLocaleDateString()}`,
            relatedEntityType: "circulation",
            relatedEntityId: circulation._id,
          });
        }

        return "renewed" as const;
      }),
    );

    let renewedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    for (const outcome of renewalOutcomes) {
      if (outcome === "renewed") {
        renewedCount++;
      } else if (outcome === "failed") {
        failedCount++;
      } else {
        skippedCount++;
      }
    }

    return { renewedCount, failedCount, skippedCount };
  },
});

// ============================================================================
// Patron Block Functions
// ============================================================================

/**
 * Check if a patron has blocks preventing checkout
 */
export const checkPatronBlocks = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.object({
    isBlocked: v.boolean(),
    blocks: v.array(
      v.object({
        type: v.string(),
        reason: v.string(),
        threshold: v.optional(v.number()),
        current: v.optional(v.number()),
      }),
    ),
    canOverride: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return {
        isBlocked: true,
        blocks: [{ type: "error", reason: "Account not found" }],
        canOverride: false,
      };
    }

    await requireModuleEnabled(ctx, account.organizationId, "library");

    const blocks: Array<{
      type: string;
      reason: string;
      threshold?: number;
      current?: number;
    }> = [];

    // Check account status
    if (account.status === "blocked") {
      blocks.push({
        type: "account_blocked",
        reason: account.blockReason || "Account is blocked",
      });
    }

    if (account.status === "suspended") {
      blocks.push({
        type: "account_suspended",
        reason: "Account is suspended",
      });
    }

    if (account.status === "expired") {
      blocks.push({
        type: "account_expired",
        reason: "Account membership has expired",
      });
    }

    // Get settings
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", account.organizationId),
      )
      .first();

    // Check fine threshold
    if (
      settings?.fineThresholdForBlock &&
      account.fineBalance &&
      account.fineBalance >= settings.fineThresholdForBlock
    ) {
      blocks.push({
        type: "fine_threshold",
        reason: "Outstanding fines exceed limit",
        threshold: settings.fineThresholdForBlock,
        current: account.fineBalance,
      });
    }

    // Check overdue items threshold
    if (settings?.overdueItemsThresholdForBlock) {
      const now = Date.now();
      const overdueItems = await ctx.db
        .query("circulations")
        .withIndex("by_account_and_status", (q) =>
          q.eq("accountId", args.accountId).eq("status", "active"),
        )
        .filter((q) => q.lt(q.field("dueDate"), now))
        .collect();

      if (overdueItems.length >= settings.overdueItemsThresholdForBlock) {
        blocks.push({
          type: "overdue_threshold",
          reason: "Too many overdue items",
          threshold: settings.overdueItemsThresholdForBlock,
          current: overdueItems.length,
        });
      }
    }

    return {
      isBlocked: blocks.length > 0,
      blocks,
      canOverride: blocks.every(
        (b) => b.type !== "account_blocked" && b.type !== "account_suspended",
      ),
    };
  },
});

/**
 * Override checkout block (requires permission)
 */
export const checkoutWithOverride = mutation({
  args: {
    accountId: v.id("accounts"),
    copyId: v.id("itemCopies"),
    dueDate: v.optional(v.number()),
    overrideReason: v.string(),
  },
  returns: v.id("circulations"),
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

    if (account.status === "blocked" || account.status === "suspended") {
      throw new Error("Cannot override hard blocks (blocked/suspended status)");
    }

    await requireModuleEnabled(ctx, account.organizationId, "library");

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
      throw new Error("This item is for reference only");
    }

    const now = Date.now();
    let dueDate = args.dueDate;

    if (!dueDate) {
      const settings = await ctx.db
        .query("librarySettings")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", account.organizationId),
        )
        .first();

      const loanPeriodDays =
        item.loanPeriodDays || settings?.defaultLoanPeriodDays || 14;
      dueDate = now + loanPeriodDays * 24 * 60 * 60 * 1000;
    }
    await Promise.all([
      ctx.db.patch(args.copyId, { status: "checked_out" }),
      ctx.db.patch(copy.itemId, {
        availableCopies: Math.max(0, item.availableCopies - 1),
      }),
    ]);
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
      notes: `Block override: ${args.overrideReason}`,
    });

    return circulationId;
  },
});

// ============================================================================
// Recall Functions
// ============================================================================

/**
 * Create a recall for a checked-out item
 */
export const createRecall = mutation({
  args: {
    circulationId: v.id("circulations"),
    reason: v.string(),
    requestingAccountId: v.optional(v.id("accounts")),
    requestingHoldId: v.optional(v.id("libraryHolds")),
  },
  returns: v.id("libraryRecalls"),
  handler: async (ctx, args) => {
    const [userId, circulation] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.circulationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!circulation) {
      throw new Error("Circulation not found");
    }

    if (circulation.status !== "active") {
      throw new Error("Item is not currently checked out");
    }

    if (circulation.isRecalled) {
      throw new Error("Item is already recalled");
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    // Get settings for recall shortened due date
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", circulation.organizationId),
      )
      .first();

    const now = Date.now();
    const shortenedDays = settings?.recallShortenedDueDays ?? 7;
    const newDueDate = now + shortenedDays * 24 * 60 * 60 * 1000;

    // Only shorten if new due date is earlier than current
    const finalDueDate =
      newDueDate < circulation.dueDate ? newDueDate : circulation.dueDate;

    const [recallId] = await Promise.all([
      ctx.db.insert("libraryRecalls", {
        organizationId: circulation.organizationId,
        circulationId: args.circulationId,
        itemId: circulation.itemId,
        copyId: circulation.copyId,
        accountId: circulation.accountId,
        reason: args.reason,
        recalledByAccountId: args.requestingAccountId,
        recalledByHoldId: args.requestingHoldId,
        status: "pending",
        recallDate: now,
        originalDueDate: circulation.dueDate,
        newDueDate: finalDueDate,
        createdBy: userId,
      }),
      ctx.db.patch(args.circulationId, {
        isRecalled: true,
        recalledAt: now,
        recalledBy: userId,
        recallReason: args.reason,
        originalDueDate: circulation.dueDate,
        dueDate: finalDueDate,
      }),
    ] as const);

    // Send notification to borrower
    const [account, item] = await Promise.all([
      ctx.db.get(circulation.accountId),
      ctx.db.get(circulation.itemId),
    ] as const);
    await Promise.all([
      account?.userId
        ? ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: circulation.organizationId,
            userId: account.userId,
            type: "library_recall",
            title: "Item Recalled",
            message: `"${item?.title}" has been recalled. Please return by ${new Date(finalDueDate).toLocaleDateString()}. Reason: ${args.reason}`,
            relatedEntityType: "circulation",
            relatedEntityId: args.circulationId,
          })
        : Promise.resolve(),
      ctx.db.patch(recallId, {
        status: "notified",
        notifiedAt: now,
      }),
    ]);

    return recallId;
  },
});

/**
 * Cancel a recall
 */
export const cancelRecall = mutation({
  args: {
    recallId: v.id("libraryRecalls"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, recall] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.recallId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!recall) {
      throw new Error("Recall not found");
    }

    if (recall.status === "returned" || recall.status === "cancelled") {
      throw new Error("Recall cannot be cancelled");
    }

    await requireModuleEnabled(ctx, recall.organizationId, "library");

    // Restore original due date
    const circulation = await ctx.db.get(recall.circulationId);
    if (circulation && circulation.status === "active") {
      await ctx.db.patch(recall.circulationId, {
        isRecalled: false,
        recalledAt: undefined,
        recalledBy: undefined,
        recallReason: undefined,
        dueDate: recall.originalDueDate,
        originalDueDate: undefined,
      });
    }

    await ctx.db.patch(args.recallId, {
      status: "cancelled",
      notes: args.reason
        ? `${recall.notes || ""} Cancelled: ${args.reason}`
        : recall.notes,
    });

    return null;
  },
});

/**
 * List recalls for an organization
 */
export const listRecalls = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("notified"),
        v.literal("returned"),
        v.literal("expired"),
        v.literal("cancelled"),
      ),
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");

    const query = args.status
      ? ctx.db
          .query("libraryRecalls")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("libraryRecalls")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const recalls = await query.paginate(args.paginationOpts);

    const enrichedPage = await Promise.all(
      recalls.page.map(async (recall) => {
        const [account, item] = await Promise.all([
          ctx.db.get(recall.accountId),
          ctx.db.get(recall.itemId),
        ] as const);
        const requestingAccount = recall.recalledByAccountId
          ? await ctx.db.get(recall.recalledByAccountId)
          : null;

        return {
          ...recall,
          account,
          item,
          requestingAccount,
        };
      }),
    );

    return {
      ...recalls,
      page: enrichedPage,
    };
  },
});

/**
 * Get recall by circulation
 */
export const getRecallByCirculation = query({
  args: {
    circulationId: v.id("circulations"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const circulation = await ctx.db.get(args.circulationId);
    if (!circulation) {
      return null;
    }

    await requireModuleEnabled(ctx, circulation.organizationId, "library");

    const recall = await ctx.db
      .query("libraryRecalls")
      .withIndex("by_circulation", (q) =>
        q.eq("circulationId", args.circulationId),
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "notified"),
        ),
      )
      .first();

    return recall;
  },
});

/**
 * Update patron auto-renewal preference
 */
export const updateAutoRenewalPreference = mutation({
  args: {
    accountId: v.id("accounts"),
    enabled: v.boolean(),
  },
  returns: v.null(),
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

    await requireModuleEnabled(ctx, account.organizationId, "library");

    await ctx.db.patch(args.accountId, {
      autoRenewalEnabled: args.enabled,
    });

    return null;
  },
});

/**
 * List patron's active checkouts with recall status
 */
export const listPatronCheckouts = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return [];
    }

    await requireModuleEnabled(ctx, account.organizationId, "library");

    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_account_and_status", (q) =>
        q.eq("accountId", args.accountId).eq("status", "active"),
      )
      .collect();

    const now = Date.now();

    const enriched = await Promise.all(
      circulations.map(async (circ) => {
        const [item, copy] = await Promise.all([
          ctx.db.get(circ.itemId),
          ctx.db.get(circ.copyId),
        ] as const);
        return {
          ...circ,
          item,
          copy,
          isOverdue: circ.dueDate < now,
          daysUntilDue: Math.ceil((circ.dueDate - now) / (24 * 60 * 60 * 1000)),
        };
      }),
    );

    return enriched.sort((a, b) => a.dueDate - b.dueDate);
  },
});
