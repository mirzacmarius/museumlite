import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

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
