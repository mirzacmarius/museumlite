import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

/**
 * Generate account number
 * Format: ACC-XXXXX (5-digit sequential number)
 */
async function generateAccountNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const counter = await ctx.db
    .query("accountCounters")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  let nextValue: number;

  if (counter) {
    nextValue = counter.currentValue + 1;
    await ctx.db.patch(counter._id, {
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });
  } else {
    nextValue = 1;
    await ctx.db.insert("accountCounters", {
      organizationId,
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });
  }

  return `ACC-${String(nextValue).padStart(5, "0")}`;
}

const accountTypeValidator = v.union(
  v.literal("lender"),
  v.literal("borrower"),
  v.literal("both"),
  v.literal("institution"),
  v.literal("patron"),
);

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: v.optional(paginationOptsValidator),
    search: v.optional(v.string()),
    accountType: v.optional(accountTypeValidator),
  },
  returns: v.object({
    accounts: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "accounts");
    await requirePermission(ctx, args.organizationId, "accounts.read");

    let results = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    if (args.accountType) {
      results = results.filter(
        (account) => account.accountType === args.accountType,
      );
    }

    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      results = results.filter((account) => {
        const businessNameMatch = account.businessName
          ?.toLowerCase()
          .includes(searchLower);
        const nameMatch =
          account.firstName?.toLowerCase().includes(searchLower) ||
          account.lastName?.toLowerCase().includes(searchLower);
        const accountNumberMatch = account.accountNumber
          .toLowerCase()
          .includes(searchLower);
        const emailMatch = account.email?.toLowerCase().includes(searchLower);
        const contactMatch = account.contactPerson
          ?.toLowerCase()
          .includes(searchLower);
        const cardMatch = account.cardNumber
          ?.toLowerCase()
          .includes(searchLower);
        return (
          businessNameMatch ||
          nameMatch ||
          accountNumberMatch ||
          emailMatch ||
          contactMatch ||
          cardMatch
        );
      });
    }

    if (args.paginationOpts) {
      const cursor = args.paginationOpts.cursor
        ? Number.parseInt(args.paginationOpts.cursor, 10)
        : 0;
      const startIndex = cursor;
      const endIndex = Math.min(
        startIndex + args.paginationOpts.numItems,
        results.length,
      );
      const page = results.slice(startIndex, endIndex);

      return {
        accounts: page,
        isDone: endIndex >= results.length,
        continueCursor: endIndex.toString(),
      };
    }

    return {
      accounts: results,
      isDone: true,
      continueCursor: undefined,
    };
  },
});

/**
 * Get a single account by ID
 */
export const get = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return null;
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.read");

    // Get associated roles
    const accountRoles = await ctx.db
      .query("accountRoles")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    return {
      ...account,
      roleIds: accountRoles.map((ar) => ar.roleId),
    };
  },
});

const statusValidator = v.union(
  v.literal("active"),
  v.literal("expired"),
  v.literal("suspended"),
  v.literal("blocked"),
  v.literal("inactive"),
);

const notificationPreferencesValidator = v.object({
  email: v.boolean(),
  sms: v.boolean(),
  dueDateReminder: v.boolean(),
  holdReady: v.boolean(),
});

const structuredAddressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.optional(v.string()),
  postalCode: v.string(),
  country: v.optional(v.string()),
});

/**
 * Create a new account
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    accountType: accountTypeValidator,

    // Business/Organization info (for institutions)
    businessName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),

    // Personal info (for patrons)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),

    // Contact info (shared)
    phone: v.optional(v.string()),
    email: v.optional(v.string()),

    // Address fields
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    structuredAddress: v.optional(structuredAddressValidator),

    // Library-specific fields (for patrons)
    cardNumber: v.optional(v.string()),
    pin: v.optional(v.string()),
    membershipTypeId: v.optional(v.id("membershipTypes")),
    membershipType: v.optional(v.string()),
    registrationDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    status: v.optional(statusValidator),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    preferredBranch: v.optional(v.id("locations")),
    notificationPreferences: v.optional(notificationPreferencesValidator),

    notes: v.optional(v.string()),
    roleIds: v.optional(v.array(v.id("roles"))),
  },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireModuleEnabled(ctx, args.organizationId, "accounts");
    await requirePermission(ctx, args.organizationId, "accounts.write");

    // Validation based on account type
    if (args.accountType === "patron") {
      if (!args.firstName?.trim() || !args.lastName?.trim()) {
        throw new Error(
          "First name and last name are required for patron accounts",
        );
      }
    } else {
      if (!args.businessName?.trim()) {
        throw new Error("Business name is required for non-patron accounts");
      }
    }

    const accountNumber = await generateAccountNumber(ctx, args.organizationId);

    const accountId = await ctx.db.insert("accounts", {
      organizationId: args.organizationId,
      accountNumber,
      accountType: args.accountType,

      // Business/Organization info
      businessName: args.businessName?.trim() || undefined,
      contactPerson: args.contactPerson?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || undefined,

      // Personal info
      firstName: args.firstName?.trim() || undefined,
      lastName: args.lastName?.trim() || undefined,
      dateOfBirth: args.dateOfBirth,

      // Contact info
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,

      // Address fields
      address: args.address?.trim() || undefined,
      address2: args.address2?.trim() || undefined,
      zipCode: args.zipCode?.trim() || undefined,
      city: args.city?.trim() || undefined,
      country: args.country?.trim() || undefined,
      structuredAddress: args.structuredAddress,

      // Library-specific fields
      cardNumber: args.cardNumber?.trim() || undefined,
      pin: args.pin,
      membershipTypeId: args.membershipTypeId,
      membershipType: args.membershipType?.trim() || undefined,
      registrationDate: args.registrationDate,
      expirationDate: args.expirationDate,
      status: args.status,
      borrowingLimit: args.borrowingLimit,
      holdLimit: args.holdLimit,
      fineBalance: args.accountType === "patron" ? 0 : undefined,
      preferredBranch: args.preferredBranch,
      notificationPreferences: args.notificationPreferences,
      totalCheckouts: args.accountType === "patron" ? 0 : undefined,

      notes: args.notes?.trim() || undefined,
      createdBy: userId,
      createdAt: Date.now(),
    });

    // Associate roles with account if provided
    if (args.roleIds && args.roleIds.length > 0) {
      for (const roleId of args.roleIds) {
        await ctx.db.insert("accountRoles", {
          accountId,
          roleId,
          addedAt: Date.now(),
          addedBy: userId,
        });
      }
    }

    return accountId;
  },
});

/**
 * Update an existing account
 */
export const update = mutation({
  args: {
    accountId: v.id("accounts"),
    accountType: v.optional(accountTypeValidator),
    businessName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    structuredAddress: v.optional(structuredAddressValidator),
    cardNumber: v.optional(v.string()),
    pin: v.optional(v.string()),
    membershipTypeId: v.optional(v.id("membershipTypes")),
    membershipType: v.optional(v.string()),
    registrationDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    status: v.optional(statusValidator),
    blockReason: v.optional(v.string()),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    preferredBranch: v.optional(v.id("locations")),
    notificationPreferences: v.optional(notificationPreferencesValidator),
    notes: v.optional(v.string()),
    roleIds: v.optional(v.array(v.id("roles"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.write");

    const updates: Record<string, unknown> = {
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    if (args.accountType !== undefined) updates.accountType = args.accountType;
    if (args.businessName !== undefined)
      updates.businessName = args.businessName.trim() || undefined;
    if (args.contactPerson !== undefined)
      updates.contactPerson = args.contactPerson.trim() || undefined;
    if (args.contactPhone !== undefined)
      updates.contactPhone = args.contactPhone.trim() || undefined;
    if (args.contactEmail !== undefined)
      updates.contactEmail = args.contactEmail.trim() || undefined;
    if (args.firstName !== undefined)
      updates.firstName = args.firstName.trim() || undefined;
    if (args.lastName !== undefined)
      updates.lastName = args.lastName.trim() || undefined;
    if (args.dateOfBirth !== undefined) updates.dateOfBirth = args.dateOfBirth;
    if (args.phone !== undefined)
      updates.phone = args.phone.trim() || undefined;
    if (args.email !== undefined)
      updates.email = args.email.trim() || undefined;
    if (args.address !== undefined)
      updates.address = args.address.trim() || undefined;
    if (args.address2 !== undefined)
      updates.address2 = args.address2.trim() || undefined;
    if (args.zipCode !== undefined)
      updates.zipCode = args.zipCode.trim() || undefined;
    if (args.city !== undefined) updates.city = args.city.trim() || undefined;
    if (args.country !== undefined)
      updates.country = args.country.trim() || undefined;
    if (args.structuredAddress !== undefined)
      updates.structuredAddress = args.structuredAddress;
    if (args.cardNumber !== undefined)
      updates.cardNumber = args.cardNumber.trim() || undefined;
    if (args.pin !== undefined) updates.pin = args.pin;
    if (args.membershipTypeId !== undefined)
      updates.membershipTypeId = args.membershipTypeId;
    if (args.membershipType !== undefined)
      updates.membershipType = args.membershipType.trim() || undefined;
    if (args.registrationDate !== undefined)
      updates.registrationDate = args.registrationDate;
    if (args.expirationDate !== undefined)
      updates.expirationDate = args.expirationDate;
    if (args.status !== undefined) updates.status = args.status;
    if (args.blockReason !== undefined)
      updates.blockReason = args.blockReason.trim() || undefined;
    if (args.borrowingLimit !== undefined)
      updates.borrowingLimit = args.borrowingLimit;
    if (args.holdLimit !== undefined) updates.holdLimit = args.holdLimit;
    if (args.preferredBranch !== undefined)
      updates.preferredBranch = args.preferredBranch;
    if (args.notificationPreferences !== undefined)
      updates.notificationPreferences = args.notificationPreferences;
    if (args.notes !== undefined)
      updates.notes = args.notes.trim() || undefined;

    await ctx.db.patch(args.accountId, updates);

    if (args.roleIds !== undefined) {
      const existingAccountRoles = await ctx.db
        .query("accountRoles")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .collect();

      for (const accountRole of existingAccountRoles) {
        await ctx.db.delete(accountRole._id);
      }

      for (const roleId of args.roleIds) {
        await ctx.db.insert("accountRoles", {
          accountId: args.accountId,
          roleId,
          addedAt: Date.now(),
          addedBy: userId,
        });
      }
    }

    return null;
  },
});

/**
 * Delete an account
 */
export const remove = mutation({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.delete");

    // Check if account is used in any loans
    const loansUsingAccount = await ctx.db
      .query("loans")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .first();

    if (loansUsingAccount) {
      throw new Error(
        "Cannot delete account that is used in existing loans. Please remove the account from all loans first.",
      );
    }

    // Remove associated role relationships
    const accountRoles = await ctx.db
      .query("accountRoles")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const accountRole of accountRoles) {
      await ctx.db.delete(accountRole._id);
    }

    await ctx.db.delete(args.accountId);

    return null;
  },
});

/**
 * Get a patron account by card number (for library circulation)
 */
export const getByCardNumber = query({
  args: {
    organizationId: v.id("organizations"),
    cardNumber: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "accounts");
    await requirePermission(ctx, args.organizationId, "accounts.read");

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_organization_and_cardNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("cardNumber", args.cardNumber),
      )
      .first();

    if (!account || account.accountType !== "patron") {
      return null;
    }

    return account;
  },
});

/**
 * Check usage of an account in loans
 */
export const checkUsage = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.object({
    isUsed: v.boolean(),
    loanCount: v.number(),
    loanNumbers: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return { isUsed: false, loanCount: 0, loanNumbers: [] };
    }

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    return {
      isUsed: loans.length > 0,
      loanCount: loans.length,
      loanNumbers: loans.map((l) => l.loanNumber),
    };
  },
});

/**
 * Get account by name (businessName or lastName)
 */
export const getByName = query({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "accounts");
    await requirePermission(ctx, args.organizationId, "accounts.read");

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const nameLower = args.name.toLowerCase();
    const account = accounts.find(
      (a) =>
        a.businessName?.toLowerCase() === nameLower ||
        a.lastName?.toLowerCase() === nameLower,
    );

    return account ?? null;
  },
});

/**
 * Archive account (soft delete)
 */
export const archive = mutation({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.delete");

    await ctx.db.patch(args.accountId, {
      status: "archived",
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Restore archived account
 */
export const restore = mutation({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.manage");

    if (account.status !== "archived") {
      throw new Error("Can only restore archived accounts");
    }

    await ctx.db.patch(args.accountId, {
      status: "active",
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const updateStatus = mutation({
  args: {
    accountId: v.id("accounts"),
    status: statusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.manage");

    await ctx.db.patch(args.accountId, {
      status: args.status,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const updateNotes = mutation({
  args: {
    accountId: v.id("accounts"),
    notes: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireModuleEnabled(ctx, account.organizationId, "accounts");
    await requirePermission(ctx, account.organizationId, "accounts.write");

    await ctx.db.patch(args.accountId, {
      notes: args.notes.trim() || undefined,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});
