import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Patron status validator
const patronStatusValidator = v.union(
  v.literal("active"),
  v.literal("expired"),
  v.literal("suspended"),
  v.literal("blocked"),
  v.literal("inactive"),
);

// Address validator
const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  state: v.optional(v.string()),
  postalCode: v.string(),
  country: v.optional(v.string()),
});

// Notification preferences validator
const notificationPreferencesValidator = v.object({
  email: v.boolean(),
  sms: v.boolean(),
  dueDateReminder: v.boolean(),
  holdReady: v.boolean(),
});

/**
 * Create a new patron
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(addressValidator),
    membershipTypeId: v.optional(v.id("membershipTypes")),
    expirationDate: v.optional(v.number()),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    preferredBranch: v.optional(v.id("locations")),
    notificationPreferences: v.optional(notificationPreferencesValidator),
    notes: v.optional(v.string()),
  },
  returns: v.id("patrons"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if email is already used
    if (args.email) {
      const existingByEmail = await ctx.db
        .query("patrons")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
        .first();

      if (existingByEmail) {
        throw new Error("A patron with this email already exists");
      }
    }

    // Get library settings for defaults
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    // Get membership type for limits
    let membershipType = "Standard";
    let borrowingLimit =
      args.borrowingLimit ?? settings?.maxHoldsPerPatron ?? 10;
    let holdLimit = args.holdLimit ?? settings?.maxHoldsPerPatron ?? 5;

    if (args.membershipTypeId) {
      const membership = await ctx.db.get(args.membershipTypeId);
      if (membership) {
        membershipType = membership.name;
        borrowingLimit = args.borrowingLimit ?? membership.borrowingLimit;
        holdLimit = args.holdLimit ?? membership.holdLimit;
      }
    } else {
      // Get default membership type
      const defaultMembership = await ctx.db
        .query("membershipTypes")
        .withIndex("by_organization_and_default", (q) =>
          q.eq("organizationId", args.organizationId).eq("isDefault", true),
        )
        .first();

      if (defaultMembership) {
        membershipType = defaultMembership.name;
        borrowingLimit =
          args.borrowingLimit ?? defaultMembership.borrowingLimit;
        holdLimit = args.holdLimit ?? defaultMembership.holdLimit;
      }
    }

    // Generate card number
    const cardNumber = await generateCardNumber(ctx, args.organizationId);

    const now = Date.now();

    const patronId = await ctx.db.insert("patrons", {
      organizationId: args.organizationId,
      cardNumber,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      address: args.address,
      membershipTypeId: args.membershipTypeId,
      membershipType,
      registrationDate: now,
      expirationDate: args.expirationDate,
      status: "active",
      borrowingLimit,
      holdLimit,
      fineBalance: 0,
      preferredBranch: args.preferredBranch,
      notificationPreferences: args.notificationPreferences ?? {
        email: true,
        sms: false,
        dueDateReminder: true,
        holdReady: true,
      },
      totalCheckouts: 0,
      notes: args.notes,
      createdBy: userId,
      createdAt: now,
    });

    return patronId;
  },
});

/**
 * Get a patron by ID
 */
export const get = query({
  args: {
    patronId: v.id("patrons"),
  },
  handler: async (ctx, args) => {
    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      return null;
    }

    // Get membership type details
    const membershipTypeDetails = patron.membershipTypeId
      ? await ctx.db.get(patron.membershipTypeId)
      : null;

    // Get active checkouts count
    const activeCheckouts = await ctx.db
      .query("circulations")
      .withIndex("by_patron_and_status", (q) =>
        q.eq("patronId", args.patronId).eq("status", "active"),
      )
      .collect();

    // Get active holds count
    const activeHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "available"),
        ),
      )
      .collect();

    // Get outstanding fines
    const outstandingFines = await ctx.db
      .query("libraryFines")
      .withIndex("by_patron_and_status", (q) =>
        q.eq("patronId", args.patronId).eq("status", "outstanding"),
      )
      .collect();

    const totalOutstandingFines = outstandingFines.reduce(
      (sum, fine) => sum + fine.balance,
      0,
    );

    return {
      ...patron,
      membershipTypeDetails,
      activeCheckoutsCount: activeCheckouts.length,
      activeHoldsCount: activeHolds.length,
      outstandingFinesTotal: totalOutstandingFines,
    };
  },
});

/**
 * Get a patron by card number
 */
export const getByCardNumber = query({
  args: {
    organizationId: v.id("organizations"),
    cardNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const patron = await ctx.db
      .query("patrons")
      .withIndex("by_organization_and_cardNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("cardNumber", args.cardNumber),
      )
      .first();

    return patron;
  },
});

/**
 * List patrons with pagination and search
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(patronStatusValidator),
    membershipTypeId: v.optional(v.id("membershipTypes")),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.search && args.search.trim()) {
      // Use search index
      query = ctx.db.query("patrons").withSearchIndex("search_patrons", (q) => {
        let searchQuery = q
          .search("lastName", args.search!)
          .eq("organizationId", args.organizationId);

        if (args.status) {
          searchQuery = searchQuery.eq("status", args.status);
        }

        return searchQuery;
      });
    } else if (args.status) {
      query = ctx.db
        .query("patrons")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("status"), args.status));
    } else {
      query = ctx.db
        .query("patrons")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );
    }

    const patrons = await query.paginate(args.paginationOpts);

    // Filter by membership type if specified
    let filteredPage = patrons.page;
    if (args.membershipTypeId) {
      filteredPage = patrons.page.filter(
        (p) => p.membershipTypeId === args.membershipTypeId,
      );
    }

    return {
      ...patrons,
      page: filteredPage,
    };
  },
});

/**
 * Update a patron
 */
export const update = mutation({
  args: {
    patronId: v.id("patrons"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(addressValidator),
    membershipTypeId: v.optional(v.id("membershipTypes")),
    expirationDate: v.optional(v.number()),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    preferredBranch: v.optional(v.id("locations")),
    notificationPreferences: v.optional(notificationPreferencesValidator),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    // Check email uniqueness if changing
    if (args.email && args.email !== patron.email) {
      const existingByEmail = await ctx.db
        .query("patrons")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .filter((q) =>
          q.and(
            q.eq(q.field("organizationId"), patron.organizationId),
            q.neq(q.field("_id"), args.patronId),
          ),
        )
        .first();

      if (existingByEmail) {
        throw new Error("A patron with this email already exists");
      }
    }

    const updates: Record<string, unknown> = {};

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.dateOfBirth !== undefined) updates.dateOfBirth = args.dateOfBirth;
    if (args.address !== undefined) updates.address = args.address;
    if (args.expirationDate !== undefined)
      updates.expirationDate = args.expirationDate;
    if (args.borrowingLimit !== undefined)
      updates.borrowingLimit = args.borrowingLimit;
    if (args.holdLimit !== undefined) updates.holdLimit = args.holdLimit;
    if (args.preferredBranch !== undefined)
      updates.preferredBranch = args.preferredBranch;
    if (args.notificationPreferences !== undefined)
      updates.notificationPreferences = args.notificationPreferences;
    if (args.notes !== undefined) updates.notes = args.notes;

    // Handle membership type change
    if (args.membershipTypeId !== undefined) {
      updates.membershipTypeId = args.membershipTypeId;
      if (args.membershipTypeId) {
        const membership = await ctx.db.get(args.membershipTypeId);
        if (membership) {
          updates.membershipType = membership.name;
          // Only update limits if not explicitly provided
          if (args.borrowingLimit === undefined) {
            updates.borrowingLimit = membership.borrowingLimit;
          }
          if (args.holdLimit === undefined) {
            updates.holdLimit = membership.holdLimit;
          }
        }
      }
    }

    await ctx.db.patch(args.patronId, updates);

    return null;
  },
});

/**
 * Update patron status
 */
export const updateStatus = mutation({
  args: {
    patronId: v.id("patrons"),
    status: patronStatusValidator,
    blockReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.status === "blocked" || args.status === "suspended") {
      updates.blockReason = args.blockReason;
    } else {
      updates.blockReason = undefined;
    }

    await ctx.db.patch(args.patronId, updates);

    return null;
  },
});

/**
 * Renew patron membership
 */
export const renewMembership = mutation({
  args: {
    patronId: v.id("patrons"),
    newExpirationDate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    await ctx.db.patch(args.patronId, {
      expirationDate: args.newExpirationDate,
      status: "active",
      blockReason: undefined,
    });

    return null;
  },
});

/**
 * Delete a patron
 */
export const remove = mutation({
  args: {
    patronId: v.id("patrons"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    // Check for active checkouts
    const activeCheckouts = await ctx.db
      .query("circulations")
      .withIndex("by_patron_and_status", (q) =>
        q.eq("patronId", args.patronId).eq("status", "active"),
      )
      .first();

    if (activeCheckouts) {
      throw new Error(
        "Cannot delete patron with active checkouts. Return all items first.",
      );
    }

    // Check for outstanding fines
    const outstandingFines = await ctx.db
      .query("libraryFines")
      .withIndex("by_patron_and_status", (q) =>
        q.eq("patronId", args.patronId).eq("status", "outstanding"),
      )
      .first();

    if (outstandingFines) {
      throw new Error(
        "Cannot delete patron with outstanding fines. Clear all fines first.",
      );
    }

    // Delete any pending holds
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId))
      .collect();

    for (const hold of holds) {
      await ctx.db.delete(hold._id);
    }

    await ctx.db.delete(args.patronId);

    return null;
  },
});

/**
 * Search patrons by name, email, or card number
 */
export const search = query({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query.trim().toLowerCase();
    const limit = args.limit ?? 10;

    if (!searchQuery) {
      return [];
    }

    // Try card number exact match first
    const byCardNumber = await ctx.db
      .query("patrons")
      .withIndex("by_organization_and_cardNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("cardNumber", searchQuery),
      )
      .first();

    if (byCardNumber) {
      return [byCardNumber];
    }

    // Search by last name
    const byLastName = await ctx.db
      .query("patrons")
      .withSearchIndex("search_patrons", (q) =>
        q
          .search("lastName", searchQuery)
          .eq("organizationId", args.organizationId),
      )
      .take(limit);

    // Also search all patrons for email or first name matches
    const allPatrons = await ctx.db
      .query("patrons")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const emailMatches = allPatrons.filter(
      (p) =>
        p.email?.toLowerCase().includes(searchQuery) ||
        p.firstName.toLowerCase().includes(searchQuery),
    );

    // Combine and dedupe results
    const resultMap = new Map();
    for (const patron of [...byLastName, ...emailMatches]) {
      resultMap.set(patron._id, patron);
    }

    return Array.from(resultMap.values()).slice(0, limit);
  },
});

/**
 * Get patron's checkout history
 */
export const getCheckoutHistory = query({
  args: {
    patronId: v.id("patrons"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("returned"),
        v.literal("overdue"),
        v.literal("lost"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.status) {
      query = ctx.db
        .query("circulations")
        .withIndex("by_patron_and_status", (q) =>
          q.eq("patronId", args.patronId).eq("status", args.status!),
        );
    } else {
      query = ctx.db
        .query("circulations")
        .withIndex("by_patron", (q) => q.eq("patronId", args.patronId));
    }

    const circulations = await query.paginate(args.paginationOpts);

    // Enrich with item data
    const enrichedPage = await Promise.all(
      circulations.page.map(async (circulation) => {
        const item = await ctx.db.get(circulation.itemId);
        const copy = await ctx.db.get(circulation.copyId);
        return {
          ...circulation,
          item,
          copy,
        };
      }),
    );

    return {
      ...circulations,
      page: enrichedPage,
    };
  },
});

/**
 * Get patron's active holds
 */
export const getHolds = query({
  args: {
    patronId: v.id("patrons"),
  },
  handler: async (ctx, args) => {
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "available"),
        ),
      )
      .collect();

    // Enrich with item data
    const enrichedHolds = await Promise.all(
      holds.map(async (hold) => {
        const item = await ctx.db.get(hold.itemId);
        const pickupLocation = hold.pickupLocationId
          ? await ctx.db.get(hold.pickupLocationId)
          : null;
        return {
          ...hold,
          item,
          pickupLocation,
        };
      }),
    );

    return enrichedHolds;
  },
});

/**
 * Get patron's fines
 */
export const getFines = query({
  args: {
    patronId: v.id("patrons"),
    includeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("libraryFines")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId));

    if (!args.includeAll) {
      query = query.filter((q) => q.eq(q.field("status"), "outstanding"));
    }

    const fines = await query.collect();

    // Enrich with item data
    const enrichedFines = await Promise.all(
      fines.map(async (fine) => {
        const circulation = fine.circulationId
          ? await ctx.db.get(fine.circulationId)
          : null;
        const item = circulation ? await ctx.db.get(circulation.itemId) : null;
        const copy = circulation ? await ctx.db.get(circulation.copyId) : null;
        return {
          ...fine,
          item,
          copy,
        };
      }),
    );

    return enrichedFines;
  },
});

/**
 * Generate a unique card number
 */
async function generateCardNumber(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const settings = await ctx.db
    .query("librarySettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  const prefix = settings?.cardNumberPrefix || "LIB";
  const length = settings?.cardNumberLength || 8;

  // Get highest existing card number
  const patrons = await ctx.db
    .query("patrons")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  let maxNumber = 0;
  for (const patron of patrons) {
    if (patron.cardNumber.startsWith(prefix)) {
      const numPart = patron.cardNumber.slice(prefix.length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(length, "0");

  return `${prefix}${paddedNumber}`;
}

/**
 * Generate a new card number (query for UI)
 */
export const generateNewCardNumber = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return generateCardNumber(ctx, args.organizationId);
  },
});

/**
 * Get patron statistics for dashboard
 */
export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    total: v.number(),
    active: v.number(),
    expired: v.number(),
    suspended: v.number(),
    blocked: v.number(),
    newThisMonth: v.number(),
    totalFinesBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    const patrons = await ctx.db
      .query("patrons")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeCount = patrons.filter((p) => p.status === "active").length;
    const expiredCount = patrons.filter((p) => p.status === "expired").length;
    const suspendedCount = patrons.filter(
      (p) => p.status === "suspended",
    ).length;
    const blockedCount = patrons.filter((p) => p.status === "blocked").length;

    const now = Date.now();
    const thisMonth = new Date(now);
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthStart = thisMonth.getTime();

    const newThisMonth = patrons.filter(
      (p) => p.registrationDate >= thisMonthStart,
    ).length;

    const totalFinesBalance = patrons.reduce(
      (sum, p) => sum + (p.fineBalance || 0),
      0,
    );

    return {
      total: patrons.length,
      active: activeCount,
      expired: expiredCount,
      suspended: suspendedCount,
      blocked: blockedCount,
      newThisMonth,
      totalFinesBalance,
    };
  },
});
