import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, query } from "../_generated/server";
import { requireModuleEnabled } from "../utils/featureGates";

const holdStatusValidator = v.union(
  v.literal("pending"),
  v.literal("available"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
  v.literal("expired"),
);

export const place = mutation({
  args: {
    accountId: v.id("accounts"),
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

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    if (account.accountType !== "patron") {
      throw new Error("Only patron accounts can place holds");
    }

    if (account.status !== "active") {
      throw new Error(`Cannot place hold: Account status is ${account.status}`);
    }

    await requireModuleEnabled(ctx, account.organizationId, "library");

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    if (!item.isCirculating) {
      throw new Error("This item is for reference only and cannot be held");
    }

    const existingHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "available"),
        ),
      )
      .collect();

    const holdLimit = account.holdLimit ?? 5;
    if (existingHolds.length >= holdLimit) {
      throw new Error(`Account has reached hold limit of ${holdLimit}`);
    }

    const existingHoldOnItem = existingHolds.find(
      (h) => h.itemId === args.itemId,
    );
    if (existingHoldOnItem) {
      throw new Error("Account already has a hold on this item");
    }

    const activeCheckout = await ctx.db
      .query("circulations")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
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
      throw new Error("Account already has this item checked out");
    }

    const pendingHolds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_item_and_status", (q) =>
        q.eq("itemId", args.itemId).eq("status", "pending"),
      )
      .collect();

    const queuePosition = pendingHolds.length + 1;

    const now = Date.now();

    const holdId = await ctx.db.insert("libraryHolds", {
      organizationId: account.organizationId,
      accountId: args.accountId,
      itemId: args.itemId,
      holdDate: now,
      queuePosition,
      pickupLocationId: args.pickupLocationId || account.preferredBranch,
      status: "pending",
      notes: args.notes,
      createdAt: now,
    });

    return holdId;
  },
});

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

    await requireModuleEnabled(ctx, hold.organizationId, "library");

    if (hold.status === "available" && hold.copyId) {
      const copy = await ctx.db.get(hold.copyId);
      if (copy && copy.status === "on_hold") {
        await ctx.db.patch(hold.copyId, { status: "available" });

        const item = await ctx.db.get(hold.itemId);
        if (item) {
          await ctx.db.patch(hold.itemId, {
            availableCopies: item.availableCopies + 1,
          });
        }
      }
    }

    await ctx.db.patch(args.holdId, { status: "cancelled" });

    await reorderHoldQueue(ctx, hold.itemId);

    return null;
  },
});

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

    await requireModuleEnabled(ctx, hold.organizationId, "library");

    await Promise.all([
      ctx.db.patch(args.holdId, { status: "fulfilled" }),
      reorderHoldQueue(ctx, hold.itemId),
    ]);

    return null;
  },
});

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

    await requireModuleEnabled(ctx, hold.organizationId, "library");

    await ctx.db.patch(args.holdId, {
      pickupLocationId: args.pickupLocationId,
    });

    return null;
  },
});

export const get = query({
  args: {
    holdId: v.id("libraryHolds"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const hold = await ctx.db.get(args.holdId);
    if (!hold) {
      return null;
    }

    await requireModuleEnabled(ctx, hold.organizationId, "library");

    const [account, item] = await Promise.all([
      ctx.db.get(hold.accountId),
      ctx.db.get(hold.itemId),
    ]);
    const copy = hold.copyId ? await ctx.db.get(hold.copyId) : null;
    const pickupLocation = hold.pickupLocationId
      ? await ctx.db.get(hold.pickupLocationId)
      : null;

    return {
      ...hold,
      account,
      item,
      copy,
      pickupLocation,
    };
  },
});

export const listByItem = query({
  args: {
    itemId: v.id("libraryItems"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return [];
    }

    await requireModuleEnabled(ctx, item.organizationId, "library");

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

    holds.sort((a, b) => a.queuePosition - b.queuePosition);

    const enrichedHolds = await Promise.all(
      holds.map(async (hold) => {
        const account = await ctx.db.get(hold.accountId);
        return {
          ...hold,
          account,
        };
      }),
    );

    return enrichedHolds;
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(holdStatusValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const query = args.status
      ? ctx.db
          .query("libraryHolds")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("libraryHolds")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const holds = await query.paginate(args.paginationOpts);

    const enrichedPage = await Promise.all(
      holds.page.map(async (hold) => {
        const [account, item] = await Promise.all([
          ctx.db.get(hold.accountId),
          ctx.db.get(hold.itemId),
        ]);
        const pickupLocation = hold.pickupLocationId
          ? await ctx.db.get(hold.pickupLocationId)
          : null;
        return {
          ...hold,
          account,
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

export const listAvailable = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const holds = await ctx.db
      .query("libraryHolds")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available"),
      )
      .paginate(args.paginationOpts);

    const enrichedPage = await Promise.all(
      holds.page.map(async (hold) => {
        const [account, item] = await Promise.all([
          ctx.db.get(hold.accountId),
          ctx.db.get(hold.itemId),
        ]);
        const pickupLocation = hold.pickupLocationId
          ? await ctx.db.get(hold.pickupLocationId)
          : null;
        return {
          ...hold,
          account,
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
    await requireModuleEnabled(ctx, args.organizationId, "library");
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

export const expireOldHolds = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    const now = Date.now();

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

    await Promise.all(
      Array.from(expiredHolds).map(async (hold) => {
        if (hold.copyId) {
          const copy = await ctx.db.get(hold.copyId);
          if (copy && copy.status === "on_hold") {
            await ctx.db.patch(hold.copyId, { status: "available" });

            const item = await ctx.db.get(hold.itemId);
            if (item) {
              await ctx.db.patch(hold.itemId, {
                availableCopies: item.availableCopies + 1,
              });
            }
          }
        }

        await ctx.db.patch(hold._id, { status: "expired" });

        await notifyNextInQueue(ctx, hold.itemId);
      }),
    );

    return expiredHolds.length;
  },
});

async function reorderHoldQueue(ctx: MutationCtx, itemId: Id<"libraryItems">) {
  const pendingHolds = await ctx.db
    .query("libraryHolds")
    .withIndex("by_item_and_status", (q) =>
      q.eq("itemId", itemId).eq("status", "pending"),
    )
    .collect();

  pendingHolds.sort((a, b) => a.holdDate - b.holdDate);

  await Promise.all(
    Array.from({ length: pendingHolds.length }, async (_, i) => {
      const hold = pendingHolds[i];
      if (hold) {
        await ctx.db.patch(hold._id, { queuePosition: i + 1 });
      }
    }),
  );
}

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

  pendingHolds.sort((a, b) => a.queuePosition - b.queuePosition);
  const nextHold = pendingHolds[0];

  if (!nextHold) {
    return;
  }

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

    await ctx.db.patch(availableCopy._id, { status: "on_hold" });

    const item = await ctx.db.get(itemId);
    if (item) {
      await ctx.db.patch(itemId, {
        availableCopies: Math.max(0, item.availableCopies - 1),
      });
    }

    await ctx.db.patch(nextHold._id, {
      status: "available",
      copyId: availableCopy._id,
      availableDate: now,
      expirationDate,
    });
  }
}
