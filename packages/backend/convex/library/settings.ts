import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { mutation } from "../utils/mutationBuilders";
import { requireLibraryPermission } from "./utils/permissions";

/**
 * Get library settings for an organization
 */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("librarySettings"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      defaultLoanPeriodDays: v.number(),
      defaultRenewalLimit: v.number(),
      renewalPeriodDays: v.number(),
      maxRenewalsAllowed: v.number(),
      finePerDayDefault: v.number(),
      maxFinePerItem: v.optional(v.number()),
      gracePeriodDays: v.number(),
      fineThresholdForBlock: v.optional(v.number()),
      holdExpirationDays: v.number(),
      maxHoldsPerPatron: v.number(),
      cardNumberPrefix: v.optional(v.string()),
      cardNumberLength: v.optional(v.number()),
      autoGenerateCardNumbers: v.boolean(),
      classificationSystem: v.union(
        v.literal("dewey"),
        v.literal("lc"),
        v.literal("custom"),
      ),
      dueDateReminderDays: v.optional(v.number()),
      overdueNoticeDays: v.optional(v.array(v.number())),
      receiptHeader: v.optional(v.string()),
      receiptFooter: v.optional(v.string()),
      createdAt: v.number(),
      lastModifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    return settings;
  },
});

/**
 * Update library settings
 */
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    defaultLoanPeriodDays: v.optional(v.number()),
    defaultRenewalLimit: v.optional(v.number()),
    renewalPeriodDays: v.optional(v.number()),
    maxRenewalsAllowed: v.optional(v.number()),
    finePerDayDefault: v.optional(v.number()),
    maxFinePerItem: v.optional(v.number()),
    gracePeriodDays: v.optional(v.number()),
    fineThresholdForBlock: v.optional(v.number()),
    holdExpirationDays: v.optional(v.number()),
    maxHoldsPerPatron: v.optional(v.number()),
    cardNumberPrefix: v.optional(v.string()),
    cardNumberLength: v.optional(v.number()),
    autoGenerateCardNumbers: v.optional(v.boolean()),
    classificationSystem: v.optional(
      v.union(v.literal("dewey"), v.literal("lc"), v.literal("custom")),
    ),
    dueDateReminderDays: v.optional(v.number()),
    overdueNoticeDays: v.optional(v.array(v.number())),
    receiptHeader: v.optional(v.string()),
    receiptFooter: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!settings) {
      throw new Error(
        "Library settings not found. Please enable the Library integration first.",
      );
    }

    const updates: Partial<Doc<"librarySettings">> = {
      lastModifiedAt: Date.now(),
    };

    if (args.defaultLoanPeriodDays !== undefined) {
      updates.defaultLoanPeriodDays = args.defaultLoanPeriodDays;
    }
    if (args.defaultRenewalLimit !== undefined) {
      updates.defaultRenewalLimit = args.defaultRenewalLimit;
    }
    if (args.renewalPeriodDays !== undefined) {
      updates.renewalPeriodDays = args.renewalPeriodDays;
    }
    if (args.maxRenewalsAllowed !== undefined) {
      updates.maxRenewalsAllowed = args.maxRenewalsAllowed;
    }
    if (args.finePerDayDefault !== undefined) {
      updates.finePerDayDefault = args.finePerDayDefault;
    }
    if (args.maxFinePerItem !== undefined) {
      updates.maxFinePerItem = args.maxFinePerItem;
    }
    if (args.gracePeriodDays !== undefined) {
      updates.gracePeriodDays = args.gracePeriodDays;
    }
    if (args.fineThresholdForBlock !== undefined) {
      updates.fineThresholdForBlock = args.fineThresholdForBlock;
    }
    if (args.holdExpirationDays !== undefined) {
      updates.holdExpirationDays = args.holdExpirationDays;
    }
    if (args.maxHoldsPerPatron !== undefined) {
      updates.maxHoldsPerPatron = args.maxHoldsPerPatron;
    }
    if (args.cardNumberPrefix !== undefined) {
      updates.cardNumberPrefix = args.cardNumberPrefix;
    }
    if (args.cardNumberLength !== undefined) {
      updates.cardNumberLength = args.cardNumberLength;
    }
    if (args.autoGenerateCardNumbers !== undefined) {
      updates.autoGenerateCardNumbers = args.autoGenerateCardNumbers;
    }
    if (args.classificationSystem !== undefined) {
      updates.classificationSystem = args.classificationSystem;
    }
    if (args.dueDateReminderDays !== undefined) {
      updates.dueDateReminderDays = args.dueDateReminderDays;
    }
    if (args.overdueNoticeDays !== undefined) {
      updates.overdueNoticeDays = args.overdueNoticeDays;
    }
    if (args.receiptHeader !== undefined) {
      updates.receiptHeader = args.receiptHeader;
    }
    if (args.receiptFooter !== undefined) {
      updates.receiptFooter = args.receiptFooter;
    }

    await ctx.db.patch(settings._id, updates);

    return null;
  },
});

/**
 * List membership types for an organization
 */
export const listMembershipTypes = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("membershipTypes"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      borrowingLimit: v.number(),
      holdLimit: v.number(),
      loanPeriodDays: v.number(),
      renewalLimit: v.number(),
      finePerDay: v.number(),
      gracePeriodDays: v.number(),
      fee: v.optional(v.number()),
      isDefault: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
    const types = await ctx.db
      .query("membershipTypes")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return types;
  },
});

/**
 * Create a new membership type
 */
export const createMembershipType = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    borrowingLimit: v.number(),
    holdLimit: v.number(),
    loanPeriodDays: v.number(),
    renewalLimit: v.number(),
    finePerDay: v.number(),
    gracePeriodDays: v.number(),
    fee: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.id("membershipTypes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    // If setting as default, unset other defaults
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("membershipTypes")
        .withIndex("by_organization_and_default", (q) =>
          q.eq("organizationId", args.organizationId).eq("isDefault", true),
        )
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { isDefault: false });
      }
    }

    const id = await ctx.db.insert("membershipTypes", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      borrowingLimit: args.borrowingLimit,
      holdLimit: args.holdLimit,
      loanPeriodDays: args.loanPeriodDays,
      renewalLimit: args.renewalLimit,
      finePerDay: args.finePerDay,
      gracePeriodDays: args.gracePeriodDays,
      fee: args.fee,
      isDefault: args.isDefault ?? false,
      createdAt: Date.now(),
    });

    return id;
  },
});

/**
 * Update a membership type
 */
export const updateMembershipType = mutation({
  args: {
    membershipTypeId: v.id("membershipTypes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    loanPeriodDays: v.optional(v.number()),
    renewalLimit: v.optional(v.number()),
    finePerDay: v.optional(v.number()),
    gracePeriodDays: v.optional(v.number()),
    fee: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, membershipType] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.membershipTypeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!membershipType) {
      throw new Error("Membership type not found");
    }

    await requireLibraryPermission(
      ctx,
      membershipType.organizationId,
      "organization.manage_settings",
    );

    // If setting as default, unset other defaults
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("membershipTypes")
        .withIndex("by_organization_and_default", (q) =>
          q
            .eq("organizationId", membershipType.organizationId)
            .eq("isDefault", true),
        )
        .first();

      if (existingDefault && existingDefault._id !== args.membershipTypeId) {
        await ctx.db.patch(existingDefault._id, { isDefault: false });
      }
    }

    const updates: Partial<Doc<"membershipTypes">> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.borrowingLimit !== undefined)
      updates.borrowingLimit = args.borrowingLimit;
    if (args.holdLimit !== undefined) updates.holdLimit = args.holdLimit;
    if (args.loanPeriodDays !== undefined)
      updates.loanPeriodDays = args.loanPeriodDays;
    if (args.renewalLimit !== undefined)
      updates.renewalLimit = args.renewalLimit;
    if (args.finePerDay !== undefined) updates.finePerDay = args.finePerDay;
    if (args.gracePeriodDays !== undefined)
      updates.gracePeriodDays = args.gracePeriodDays;
    if (args.fee !== undefined) updates.fee = args.fee;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

    await ctx.db.patch(args.membershipTypeId, updates);

    return null;
  },
});

/**
 * Delete a membership type
 */
export const deleteMembershipType = mutation({
  args: {
    membershipTypeId: v.id("membershipTypes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, membershipType] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.membershipTypeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!membershipType) {
      throw new Error("Membership type not found");
    }

    await requireLibraryPermission(
      ctx,
      membershipType.organizationId,
      "organization.manage_settings",
    );

    const accountsWithType = await ctx.db
      .query("accounts")
      .withIndex("by_organization_and_accountType", (q) =>
        q
          .eq("organizationId", membershipType.organizationId)
          .eq("accountType", "patron"),
      )
      .filter((q) => q.eq(q.field("membershipTypeId"), args.membershipTypeId))
      .first();

    if (accountsWithType) {
      throw new Error(
        "Cannot delete membership type that is assigned to patron accounts",
      );
    }

    await ctx.db.delete(args.membershipTypeId);

    return null;
  },
});

/**
 * Get combined library statistics for the dashboard
 */
export const getLibraryStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalItems: v.number(),
    activePatrons: v.number(),
    checkedOutItems: v.number(),
    outstandingFines: v.number(),
    overdueItems: v.number(),
    pendingHolds: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireLibraryPermission(
      ctx,
      args.organizationId,
      "collections.read",
    );
    const now = Date.now();

    const items = await ctx.db
      .query("libraryItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const totalItems = items.filter(
      (i) => i.catalogStatus === "published",
    ).length;

    const patronAccounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization_and_accountType", (q) =>
        q.eq("organizationId", args.organizationId).eq("accountType", "patron"),
      )
      .collect();

    const activePatrons = patronAccounts.filter(
      (p) => p.status === "active",
    ).length;

    const circulations = await ctx.db
      .query("circulations")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .collect();

    const checkedOutItems = circulations.length;
    const overdueItems = circulations.filter((c) => c.dueDate < now).length;

    const fines = await ctx.db
      .query("libraryFines")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "outstanding"),
      )
      .collect();

    const outstandingFines = fines.reduce((sum, f) => sum + f.balance, 0);

    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending"),
      )
      .collect();

    const pendingHolds = holds.length;

    return {
      totalItems,
      activePatrons,
      checkedOutItems,
      outstandingFines,
      overdueItems,
      pendingHolds,
    };
  },
});
