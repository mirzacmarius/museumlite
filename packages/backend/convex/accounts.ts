import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
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

/**
 * List all accounts for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: v.optional(paginationOptsValidator),
    search: v.optional(v.string()),
  },
  returns: v.object({
    accounts: v.array(
      v.object({
        _id: v.id("accounts"),
        _creationTime: v.number(),
        organizationId: v.id("organizations"),
        accountNumber: v.string(),
        businessName: v.string(),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        address: v.optional(v.string()),
        address2: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        city: v.optional(v.string()),
        country: v.optional(v.string()),
        contactPerson: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        notes: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number(),
        lastModifiedBy: v.optional(v.id("users")),
        lastModifiedAt: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "loans.read");

    let results = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      results = results.filter(
        (account) =>
          account.businessName.toLowerCase().includes(searchLower) ||
          account.accountNumber.toLowerCase().includes(searchLower) ||
          account.email?.toLowerCase().includes(searchLower) ||
          account.contactPerson?.toLowerCase().includes(searchLower),
      );
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
  returns: v.union(
    v.object({
      _id: v.id("accounts"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountNumber: v.string(),
      businessName: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      address: v.optional(v.string()),
      address2: v.optional(v.string()),
      zipCode: v.optional(v.string()),
      city: v.optional(v.string()),
      country: v.optional(v.string()),
      contactPerson: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      lastModifiedBy: v.optional(v.id("users")),
      lastModifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return null;
    }

    await requirePermission(ctx, account.organizationId, "loans.read");

    return account;
  },
});

/**
 * Create a new account
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    businessName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "loans.create");

    if (!args.businessName.trim()) {
      throw new Error("Business name is required");
    }

    const accountNumber = await generateAccountNumber(ctx, args.organizationId);

    const accountId = await ctx.db.insert("accounts", {
      organizationId: args.organizationId,
      accountNumber,
      businessName: args.businessName.trim(),
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      address: args.address?.trim() || undefined,
      address2: args.address2?.trim() || undefined,
      zipCode: args.zipCode?.trim() || undefined,
      city: args.city?.trim() || undefined,
      country: args.country?.trim() || undefined,
      contactPerson: args.contactPerson?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdBy: userId,
      createdAt: Date.now(),
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
    businessName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
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

    await requirePermission(ctx, account.organizationId, "loans.update");

    const updates: {
      businessName?: string;
      phone?: string;
      email?: string;
      address?: string;
      address2?: string;
      zipCode?: string;
      city?: string;
      country?: string;
      contactPerson?: string;
      contactPhone?: string;
      contactEmail?: string;
      notes?: string;
      lastModifiedBy: Id<"users">;
      lastModifiedAt: number;
    } = {
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    if (args.businessName !== undefined) {
      if (!args.businessName.trim()) {
        throw new Error("Business name cannot be empty");
      }
      updates.businessName = args.businessName.trim();
    }
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
    if (args.contactPerson !== undefined)
      updates.contactPerson = args.contactPerson.trim() || undefined;
    if (args.contactPhone !== undefined)
      updates.contactPhone = args.contactPhone.trim() || undefined;
    if (args.contactEmail !== undefined)
      updates.contactEmail = args.contactEmail.trim() || undefined;
    if (args.notes !== undefined)
      updates.notes = args.notes.trim() || undefined;

    await ctx.db.patch(args.accountId, updates);

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

    await requirePermission(ctx, account.organizationId, "loans.update");

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

    await ctx.db.delete(args.accountId);

    return null;
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
