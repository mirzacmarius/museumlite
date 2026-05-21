import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const fillLevelValidator = v.union(
  v.literal("into_neck"),
  v.literal("top_shoulder"),
  v.literal("high_shoulder"),
  v.literal("mid_shoulder"),
  v.literal("low_shoulder"),
  v.literal("below_shoulder"),
);

const closureTypeValidator = v.union(
  v.literal("cork"),
  v.literal("screwcap"),
  v.literal("synthetic"),
  v.literal("glass"),
  v.literal("crown"),
);

interface DrinkingWindow {
  _id: Id<"wineDetails">;
  collectionId: Id<"collections">;
  producer?: string;
  vintage?: number;
  peakWindowStart?: number;
  peakWindowEnd?: number;
  binNumber?: string;
}

async function requireWineModule(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "wine");
}

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("wineDetails"),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      vintage: v.optional(v.number()),
      peakWindowStart: v.optional(v.number()),
      peakWindowEnd: v.optional(v.number()),
      binNumber: v.optional(v.string()),
      rackNumber: v.optional(v.string()),
      rowNumber: v.optional(v.string()),
      bottleSize: v.optional(v.string()),
      quantity: v.optional(v.number()),
      fillLevel: v.optional(fillLevelValidator),
      closureType: v.optional(closureTypeValidator),
      labelCondition: v.optional(v.string()),
      capsuleCondition: v.optional(v.string()),
      producer: v.optional(v.string()),
      region: v.optional(v.string()),
      appellation: v.optional(v.string()),
      varietal: v.optional(v.string()),
      alcoholContent: v.optional(v.number()),
      purchasePrice: v.optional(v.number()),
      currentValue: v.optional(v.number()),
      drinkingNotes: v.optional(v.string()),
      createdAt: v.number(),
      lastModifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      return null;
    }

    await Promise.all([
      requireWineModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.read"),
    ] as const);

    const details = await ctx.db
      .query("wineDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    return details;
  },
});

export const upsert = mutation({
  args: {
    collectionId: v.id("collections"),
    vintage: v.optional(v.number()),
    peakWindowStart: v.optional(v.number()),
    peakWindowEnd: v.optional(v.number()),
    binNumber: v.optional(v.string()),
    rackNumber: v.optional(v.string()),
    rowNumber: v.optional(v.string()),
    bottleSize: v.optional(v.string()),
    quantity: v.optional(v.number()),
    fillLevel: v.optional(fillLevelValidator),
    closureType: v.optional(closureTypeValidator),
    labelCondition: v.optional(v.string()),
    capsuleCondition: v.optional(v.string()),
    producer: v.optional(v.string()),
    region: v.optional(v.string()),
    appellation: v.optional(v.string()),
    varietal: v.optional(v.string()),
    alcoholContent: v.optional(v.number()),
    purchasePrice: v.optional(v.number()),
    currentValue: v.optional(v.number()),
    drinkingNotes: v.optional(v.string()),
  },
  returns: v.id("wineDetails"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    await Promise.all([
      requireWineModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ] as const);

    const existing = await ctx.db
      .query("wineDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    const { collectionId, ...updateData } = args;

    if (existing) {
      await Promise.all([
        ctx.db.patch(existing._id, {
          ...updateData,
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "updated",
          entityType: "wineDetails",
          entityId: existing._id,
          changes: updateData,
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("wineDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      ...updateData,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "wineDetails",
      entityId: id,
      changes: updateData,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    wineDetailsId: v.id("wineDetails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.wineDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Wine details not found");
    }
    await Promise.all([
      Promise.all([
        requireWineModule(ctx, details.organizationId),
        requirePermission(ctx, details.organizationId, "collections.delete"),
      ] as const),
      ctx.db.delete(args.wineDetailsId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: details.organizationId,
        userId,
        action: "deleted",
        entityType: "wineDetails",
        entityId: args.wineDetailsId,
      }),
    ] as const);

    return null;
  },
});

export const listByBin = query({
  args: {
    organizationId: v.id("organizations"),
    binNumber: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("wineDetails"),
      collectionId: v.id("collections"),
      vintage: v.optional(v.number()),
      rackNumber: v.optional(v.string()),
      rowNumber: v.optional(v.string()),
      producer: v.optional(v.string()),
      quantity: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await Promise.all([
      requireWineModule(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);

    const wines = await ctx.db
      .query("wineDetails")
      .withIndex("by_organization_and_bin", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("binNumber", args.binNumber),
      )
      .collect();

    return wines.map((w) => ({
      _id: w._id,
      collectionId: w.collectionId,
      vintage: w.vintage,
      rackNumber: w.rackNumber,
      rowNumber: w.rowNumber,
      producer: w.producer,
      quantity: w.quantity,
    }));
  },
});

export const listDrinkingWindows = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("wineDetails"),
      collectionId: v.id("collections"),
      producer: v.optional(v.string()),
      vintage: v.optional(v.number()),
      peakWindowStart: v.optional(v.number()),
      peakWindowEnd: v.optional(v.number()),
      binNumber: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await Promise.all([
      requireWineModule(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);

    const currentYear = new Date().getFullYear();

    const wines = await ctx.db
      .query("wineDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const drinkingWindows: DrinkingWindow[] = [];

    for (const w of wines) {
      if (
        w.peakWindowStart === undefined ||
        w.peakWindowEnd === undefined ||
        w.peakWindowStart > currentYear + 5
      ) {
        continue;
      }

      drinkingWindows.push({
        _id: w._id,
        collectionId: w.collectionId,
        producer: w.producer,
        vintage: w.vintage,
        peakWindowStart: w.peakWindowStart,
        peakWindowEnd: w.peakWindowEnd,
        binNumber: w.binNumber,
      });
    }

    return drinkingWindows;
  },
});
