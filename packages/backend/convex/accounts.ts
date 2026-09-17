import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  buildAccountCreateDocument,
  buildAccountUpdatePatch,
  validateAccountProfileForCreate,
} from "./utils/accountProfile";
import { requireModuleEnabled } from "./utils/featureGates";
import { generateNextAccountNumber } from "./utils/numberGenerator";
import { requirePermission } from "./utils/permissions";

const accountTypeValidator = v.union(
  v.literal("lender"),
  v.literal("borrower"),
  v.literal("both"),
  v.literal("institution"),
  v.literal("patron"),
);

const holderTypeValidator = v.union(
  v.literal("organization"),
  v.literal("privatePerson"),
);

const BOUNDED_ACCOUNT_SEARCH_SCAN_LIMIT = 500;

function accountMatchesSearch(
  account: Doc<"accounts">,
  searchLower: string,
): boolean {
  return (
    account.businessName?.toLowerCase().includes(searchLower) ||
    account.firstName?.toLowerCase().includes(searchLower) ||
    account.lastName?.toLowerCase().includes(searchLower) ||
    account.accountNumber.toLowerCase().includes(searchLower) ||
    account.email?.toLowerCase().includes(searchLower) ||
    account.contactPerson?.toLowerCase().includes(searchLower) ||
    account.cardNumber?.toLowerCase().includes(searchLower) ||
    false
  );
}

function paginateBoundedResults<T>(
  items: T[],
  paginationOpts: { numItems: number; cursor: string | null },
) {
  const cursor = paginationOpts.cursor
    ? Number.parseInt(paginationOpts.cursor, 10)
    : 0;
  const startIndex = Number.isNaN(cursor) ? 0 : cursor;
  const endIndex = Math.min(startIndex + paginationOpts.numItems, items.length);

  return {
    page: items.slice(startIndex, endIndex),
    isDone: endIndex >= items.length,
    continueCursor: endIndex.toString(),
  };
}

function toAccountsListResult<T>(result: {
  page: T[];
  isDone: boolean;
  continueCursor: string;
}) {
  return {
    page: result.page,
    accounts: result.page,
    isDone: result.isDone,
    continueCursor: result.continueCursor,
  };
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: v.optional(paginationOptsValidator),
    search: v.optional(v.string()),
    accountType: v.optional(accountTypeValidator),
  },
  returns: v.object({
    page: v.array(v.any()),
    accounts: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireModuleEnabled(ctx, args.organizationId, "accounts"),
      requirePermission(ctx, args.organizationId, "accounts.read"),
    ]);

    const paginationOpts = args.paginationOpts ?? {
      numItems: 50,
      cursor: null,
    };
    const search = args.search?.trim();

    if (search && search.length > 0) {
      const searchLower = search.toLowerCase();
      const recentAccounts = await ctx.db
        .query("accounts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(BOUNDED_ACCOUNT_SEARCH_SCAN_LIMIT);

      const filteredAccounts = recentAccounts.filter((account) => {
        if (
          args.accountType &&
          account.accountType !== args.accountType
        ) {
          return false;
        }

        return accountMatchesSearch(account, searchLower);
      });

      return toAccountsListResult(
        paginateBoundedResults(filteredAccounts, paginationOpts),
      );
    }

    if (args.accountType) {
      const accountType = args.accountType;
      const paginationResult = await ctx.db
        .query("accounts")
        .withIndex("by_organization_and_accountType", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("accountType", accountType),
        )
        .order("desc")
        .paginate(paginationOpts);

      return toAccountsListResult(paginationResult);
    }

    const paginationResult = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .paginate(paginationOpts);

    return toAccountsListResult(paginationResult);
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
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.read"),
    ]);
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
    holderType: v.optional(holderTypeValidator),

    // Business/Organization info (for institutions)
    businessName: v.optional(v.string()),
    taxId: v.optional(v.string()),
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireModuleEnabled(ctx, args.organizationId, "accounts"),
      requirePermission(ctx, args.organizationId, "accounts.write"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    validateAccountProfileForCreate(args);

    const accountNumber = await generateNextAccountNumber(
      ctx,
      args.organizationId,
    );
    const holderType = args.holderType ?? "organization";
    const now = Date.now();

    const accountId = await ctx.db.insert(
      "accounts",
      buildAccountCreateDocument(args, {
        accountNumber,
        createdBy: userId,
        createdAt: now,
      }),
    );

    // Associate roles with account if provided
    if (args.roleIds && args.roleIds.length > 0) {
      await Promise.all(
        args.roleIds.map((roleId) =>
          ctx.db.insert("accountRoles", {
            accountId,
            roleId,
            addedAt: now,
            addedBy: userId,
          }),
        ),
      );
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_account",
      entityType: "account",
      entityId: accountId,
      changes: {
        accountType: args.accountType,
        holderType,
        accountNumber,
        businessName: args.businessName?.trim() || undefined,
        firstName: args.firstName?.trim() || undefined,
        lastName: args.lastName?.trim() || undefined,
      },
    });

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
    holderType: v.optional(holderTypeValidator),
    businessName: v.optional(v.string()),
    taxId: v.optional(v.string()),
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

    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.write"),
    ]);

    const now = Date.now();
    const updates = buildAccountUpdatePatch(args, {
      lastModifiedBy: userId,
      lastModifiedAt: now,
    });

    if (args.roleIds !== undefined) {
      const [, existingAccountRoles] = await Promise.all([
        ctx.db.patch(args.accountId, updates),
        ctx.db
          .query("accountRoles")
          .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
          .collect(),
      ] as const);

      await Promise.all(
        existingAccountRoles.map((accountRole) =>
          ctx.db.delete(accountRole._id),
        ),
      );

      await Promise.all([
        ...args.roleIds.map((roleId) =>
          ctx.db.insert("accountRoles", {
            accountId: args.accountId,
            roleId,
            addedAt: now,
            addedBy: userId,
          }),
        ),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: account.organizationId,
          userId,
          action: "updated_account",
          entityType: "account",
          entityId: args.accountId,
          changes: updates,
        }),
      ]);
    } else {
      await Promise.all([
        ctx.db.patch(args.accountId, updates),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: account.organizationId,
          userId,
          action: "updated_account",
          entityType: "account",
          entityId: args.accountId,
          changes: updates,
        }),
      ] as const);
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
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.delete"),
    ]);
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
    await Promise.all([
      Promise.all(
        accountRoles.map((accountRole) => ctx.db.delete(accountRole._id)),
      ),
      ctx.db.delete(args.accountId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "deleted_account",
        entityType: "account",
        entityId: args.accountId,
      }),
    ] as const);

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
    await Promise.all([
      requireModuleEnabled(ctx, args.organizationId, "accounts"),
      requirePermission(ctx, args.organizationId, "accounts.read"),
    ]);
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

const ACCOUNT_LOAN_USAGE_COUNT_PROBE = 1001;
const ACCOUNT_LOAN_USAGE_NUMBER_CAP = 20;

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
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const unused = {
      isUsed: false,
      loanCount: 0,
      loanNumbers: [] as string[],
      truncated: false,
    };

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return unused;
    }

    try {
      await requirePermission(ctx, account.organizationId, "accounts.read");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return unused;
      }
      throw error;
    }

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .take(ACCOUNT_LOAN_USAGE_COUNT_PROBE);

    return {
      isUsed: loans.length > 0,
      loanCount: loans.length,
      loanNumbers: loans
        .slice(0, ACCOUNT_LOAN_USAGE_NUMBER_CAP)
        .map((l) => l.loanNumber),
      truncated:
        loans.length > ACCOUNT_LOAN_USAGE_NUMBER_CAP ||
        loans.length >= ACCOUNT_LOAN_USAGE_COUNT_PROBE,
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
    await Promise.all([
      requireModuleEnabled(ctx, args.organizationId, "accounts"),
      requirePermission(ctx, args.organizationId, "accounts.read"),
    ]);
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
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.delete"),
      ctx.db.patch(args.accountId, {
        status: "archived",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "archived_account",
        entityType: "account",
        entityId: args.accountId,
        changes: { status: "archived" },
      }),
    ] as const);

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

    if (account.status !== "archived") {
      throw new Error("Can only restore archived accounts");
    }

    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.manage"),
    ]);

    await Promise.all([
      ctx.db.patch(args.accountId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "restored_account",
        entityType: "account",
        entityId: args.accountId,
        changes: { status: "active" },
      }),
    ] as const);

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
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.manage"),
      ctx.db.patch(args.accountId, {
        status: args.status,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "updated_account_status",
        entityType: "account",
        entityId: args.accountId,
        changes: { status: args.status },
      }),
    ] as const);

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
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.write"),
      ctx.db.patch(args.accountId, {
        notes: args.notes.trim() || undefined,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "updated_account_notes",
        entityType: "account",
        entityId: args.accountId,
        changes: { notes: args.notes.trim() || undefined },
      }),
    ] as const);

    return null;
  },
});

export const bulkExport = query({
  args: {
    accountIds: v.array(v.id("accounts")),
  },
  returns: v.array(
    v.object({
      _id: v.id("accounts"),
      accountNumber: v.string(),
      accountType: v.optional(v.string()),
      businessName: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      contactPerson: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      country: v.optional(v.string()),
      status: v.optional(v.string()),
      cardNumber: v.optional(v.string()),
      membershipType: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results = await Promise.all(
      args.accountIds.map(async (accountId) => {
        const account = await ctx.db.get(accountId);
        if (!account) {
          return null;
        }

        await Promise.all([
          requireModuleEnabled(ctx, account.organizationId, "accounts"),
          requirePermission(ctx, account.organizationId, "accounts.read"),
        ]);

        return {
          _id: account._id,
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          businessName: account.businessName,
          firstName: account.firstName,
          lastName: account.lastName,
          contactPerson: account.contactPerson,
          email: account.email ?? account.contactEmail,
          phone: account.phone ?? account.contactPhone,
          address: account.address,
          city: account.city,
          country: account.country,
          status: account.status,
          cardNumber: account.cardNumber,
          membershipType: account.membershipType,
          createdAt: account.createdAt,
        };
      }),
    );

    return results.filter(
      (account): account is Exclude<(typeof results)[number], null> =>
        account !== null,
    );
  },
});
