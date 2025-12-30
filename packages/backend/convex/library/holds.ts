import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Hold status validator
const holdStatusValidator = v.union(
  v.literal("pending"),
  v.literal("available"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
  v.literal("expired"),
);

/**
 * Place a hold on an item
 */
export const place = mutation({
  args: {
    patronId: v.id("patrons"),
    itemId: v.id("libraryItems"),
    pickupLocationId: v.optional(v.id("locations")),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryHolds"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get patron
    const patron = await ctx.db.get(args.patronId);
    if (!patron) {
      throw new Error("Patron not found");
    }

    // Check patron status
    if (patron.status !== "active") {
      throw new Error(`Cannot place hold: Patron status is ${patron.status}`);
    }

    // Get item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    if (!item.isCirculating) {
      throw new Error("This item is for reference only and cannot be held");
    }

    // Check hold limit
    const existingHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "available"),
        ),
      )
      .collect();

    if (existingHolds.length >= patron.holdLimit) {
      throw new Error(`Patron has reached hold limit of ${patron.holdLimit}`);
    }

    // Check if patron already has a hold on this item
    const existingHoldOnItem = existingHolds.find(
      (h) => h.itemId === args.itemId,
    );
    if (existingHoldOnItem) {
      throw new Error("Patron already has a hold on this item");
    }

    // Check if patron currently has this item checked out
    const activeCheckout = await ctx.db
      .query("circulations")
      .withIndex("by_patron", (q) => q.eq("patronId", args.patronId))
      .filter((q) =>
        q.and(
          q.eq(q.field("itemId"), args.itemId),
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "overdue"),
          ),
        ),
      )
      .first();

    if (activeCheckout) {
      throw new Error("Patron already has this item checked out");
    }

    // Get current queue position for this item
    const pendingHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_item_and_status", (q) =>
        q.eq("itemId", args.itemId).eq("status", "pending"),
      )
      .collect();

    const queuePosition = pendingHolds.length + 1;

    const now = Date.now();

    const holdId = await ctx.db.insert("libraryHolds", {
      organizationId: patron.organizationId,
      patronId: args.patronId,
      itemId: args.itemId,
      holdDate: now,
      queuePosition,
      pickupLocationId: args.pickupLocationId || patron.preferredBranch,
      status: "pending",
      notes: args.notes,
      createdAt: now,
    });

    return holdId;
  },
});

/**
 * Cancel a hold
 */
export const cancel = mutation({
  args: {
    holdId: v.id("libraryHolds"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const hold = await ctx.db.get(args.holdId);
    if (!hold) {
      throw new Error("Hold not found");
    }

    if (hold.status === "fulfilled" || hold.status === "cancelled") {
      throw new Error(`Cannot cancel hold with status: ${hold.status}`);
    }

    // If hold was available, release the copy
    if (hold.status === "available" && hold.copyId) {
      const copy = await ctx.db.get(hold.copyId);
      if (copy && copy.status === "on_hold") {
        await ctx.db.patch(hold.copyId, { status: "available" });

        // Update item available copies
        const item = await ctx.db.get(hold.itemId);
        if (item) {
          await ctx.db.patch(hold.itemId, {
            availableCopies: item.availableCopies + 1,
          });
        }
      }
    }

    // Update hold status
    await ctx.db.patch(args.holdId, { status: "cancelled" });

    // Reorder queue positions for remaining holds
    await reorderHoldQueue(ctx, hold.itemId);

    return null;
  },
});

/**
 * Mark a hold as fulfilled (patron picked up the item)
 */
export const fulfill = mutation({
  args: {
    holdId: v.id("libraryHolds"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const hold = await ctx.db.get(args.holdId);
    if (!hold) {
      throw new Error("Hold not found");
    }

    if (hold.status !== "available") {
      throw new Error("Hold is not ready for pickup");
    }

    await ctx.db.patch(args.holdId, { status: "fulfilled" });

    // Reorder queue
    await reorderHoldQueue(ctx, hold.itemId);

    return null;
  },
});

/**
 * Update hold pickup location
 */
export const updatePickupLocation = mutation({
  args: {
    holdId: v.id("libraryHolds"),
    pickupLocationId: v.id("locations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const hold = await ctx.db.get(args.holdId);
    if (!hold) {
      throw new Error("Hold not found");
    }

    if (hold.status !== "pending") {
      throw new Error("Can only update pickup location for pending holds");
    }

    await ctx.db.patch(args.holdId, {
      pickupLocationId: args.pickupLocationId,
    });

    return null;
  },
});

/**
 * Get a hold by ID
 */
export const get = query({
  args: {
    holdId: v.id("libraryHolds"),
  },
  handler: async (ctx, args) => {
    const hold = await ctx.db.get(args.holdId);
    if (!hold) {
      return null;
    }

    const patron = await ctx.db.get(hold.patronId);
    const item = await ctx.db.get(hold.itemId);
    const copy = hold.copyId ? await ctx.db.get(hold.copyId) : null;
    const pickupLocation = hold.pickupLocationId
      ? await ctx.db.get(hold.pickupLocationId)
      : null;

    return {
      ...hold,
      patron,
      item,
      copy,
      pickupLocation,
    };
  },
});

/**
 * List holds for an item
 */
export const listByItem = query({
  args: {
    itemId: v.id("libraryItems"),
  },
  handler: async (ctx, args) => {
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "available"),
        ),
      )
      .collect();

    // Sort by queue position
    holds.sort((a, b) => a.queuePosition - b.queuePosition);

    // Enrich with patron data
    const enrichedHolds = await Promise.all(
      holds.map(async (hold) => {
        const patron = await ctx.db.get(hold.patronId);
        return {
          ...hold,
          patron,
        };
      }),
    );

    return enrichedHolds;
  },
});

/**
 * List all holds (for organization)
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(holdStatusValidator),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.status) {
      query = ctx.db
        .query("libraryHolds")
        .withIndex("by_organization_and_status", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("status", args.status!),
        );
    } else {
      query = ctx.db
        .query("libraryHolds")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );
    }

    const holds = await query.paginate(args.paginationOpts);

    // Enrich with related data
    const enrichedPage = await Promise.all(
      holds.page.map(async (hold) => {
        const patron = await ctx.db.get(hold.patronId);
        const item = await ctx.db.get(hold.itemId);
        const pickupLocation = hold.pickupLocationId
          ? await ctx.db.get(hold.pickupLocationId)
          : null;
        return {
          ...hold,
          patron,
          item,
          pickupLocation,
        };
      }),
    );

    return {
      ...holds,
      page: enrichedPage,
    };
  },
});

/**
 * List holds ready for pickup
 */
export const listAvailable = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available"),
      )
      .paginate(args.paginationOpts);

    // Enrich with related data
    const enrichedPage = await Promise.all(
      holds.page.map(async (hold) => {
        const patron = await ctx.db.get(hold.patronId);
        const item = await ctx.db.get(hold.itemId);
        const pickupLocation = hold.pickupLocationId
          ? await ctx.db.get(hold.pickupLocationId)
          : null;
        return {
          ...hold,
          patron,
          item,
          pickupLocation,
        };
      }),
    );

    return {
      ...holds,
      page: enrichedPage,
    };
  },
});

/**
 * Get hold statistics
 */
export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    total: v.number(),
    pending: v.number(),
    available: v.number(),
    fulfilled: v.number(),
    expired: v.number(),
    placedToday: v.number(),
  }),
  handler: async (ctx, args) => {
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const pending = holds.filter((h) => h.status === "pending").length;
    const available = holds.filter((h) => h.status === "available").length;
    const fulfilled = holds.filter((h) => h.status === "fulfilled").length;
    const expired = holds.filter((h) => h.status === "expired").length;

    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const placedToday = holds.filter((h) => h.holdDate >= todayStart).length;

    return {
      total: holds.length,
      pending,
      available,
      fulfilled,
      expired,
      placedToday,
    };
  },
});

/**
 * Expire old holds (should be called periodically)
 */
export const expireOldHolds = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get available holds that have expired
    const expiredHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available"),
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("expirationDate"), undefined),
          q.lt(q.field("expirationDate"), now),
        ),
      )
      .collect();

    for (const hold of expiredHolds) {
      // Release the copy
      if (hold.copyId) {
        const copy = await ctx.db.get(hold.copyId);
        if (copy && copy.status === "on_hold") {
          await ctx.db.patch(hold.copyId, { status: "available" });

          // Update item available copies
          const item = await ctx.db.get(hold.itemId);
          if (item) {
            await ctx.db.patch(hold.itemId, {
              availableCopies: item.availableCopies + 1,
            });
          }
        }
      }

      // Mark hold as expired
      await ctx.db.patch(hold._id, { status: "expired" });

      // Move to next person in queue
      await notifyNextInQueue(ctx, hold.itemId);
    }

    return expiredHolds.length;
  },
});

/**
 * Helper: Reorder hold queue positions after cancellation
 */
async function reorderHoldQueue(ctx: MutationCtx, itemId: Id<"libraryItems">) {
  const pendingHolds = await ctx.db
    .query("libraryHolds")
    .withIndex("by_item_and_status", (q) =>
      q.eq("itemId", itemId).eq("status", "pending"),
    )
    .collect();

  // Sort by hold date
  pendingHolds.sort((a, b) => a.holdDate - b.holdDate);

  // Update queue positions
  for (let i = 0; i < pendingHolds.length; i++) {
    const hold = pendingHolds[i];
    if (hold) {
      await ctx.db.patch(hold._id, { queuePosition: i + 1 });
    }
  }
}

/**
 * Helper: Notify next person in queue when item becomes available
 */
async function notifyNextInQueue(ctx: MutationCtx, itemId: Id<"libraryItems">) {
  const pendingHolds = await ctx.db
    .query("libraryHolds")
    .withIndex("by_item_and_status", (q) =>
      q.eq("itemId", itemId).eq("status", "pending"),
    )
    .collect();

  if (pendingHolds.length === 0) {
    return;
  }

  // Sort by queue position
  pendingHolds.sort((a, b) => a.queuePosition - b.queuePosition);
  const nextHold = pendingHolds[0];

  if (!nextHold) {
    return;
  }

  // Check if there's an available copy
  const availableCopy = await ctx.db
    .query("itemCopies")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .filter((q) => q.eq(q.field("status"), "available"))
    .first();

  if (availableCopy) {
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", nextHold.organizationId),
      )
      .first();

    const holdExpirationDays = settings?.holdExpirationDays || 7;
    const now = Date.now();
    const expirationDate = now + holdExpirationDays * 24 * 60 * 60 * 1000;

    // Mark copy as on hold
    await ctx.db.patch(availableCopy._id, { status: "on_hold" });

    // Update item available copies
    const item = await ctx.db.get(itemId);
    if (item) {
      await ctx.db.patch(itemId, {
        availableCopies: Math.max(0, item.availableCopies - 1),
      });
    }

    // Update hold
    await ctx.db.patch(nextHold._id, {
      status: "available",
      copyId: availableCopy._id,
      availableDate: now,
      expirationDate,
    });
  }
}
