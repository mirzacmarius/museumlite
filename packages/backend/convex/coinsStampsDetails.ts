import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { requireModuleEnabled } from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

const itemCategoryValidator = v.union(v.literal("coin"), v.literal("stamp"));

const rarityValidator = v.union(
  v.literal("common"),
  v.literal("scarce"),
  v.literal("rare"),
  v.literal("very_rare"),
  v.literal("unique"),
);

async function requireCoinsStampsModule(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "coins_stamps");
}

const coinsStampsDetailsFields = {
  itemCategory: v.optional(itemCategoryValidator),
  issuingAuthority: v.optional(v.string()),
  countryOrRegion: v.optional(v.string()),
  denomination: v.optional(v.string()),
  currency: v.optional(v.string()),
  issueYear: v.optional(v.number()),
  issuePeriod: v.optional(v.string()),
  mintOrPrinter: v.optional(v.string()),
  series: v.optional(v.string()),
  catalogNumber: v.optional(v.string()),
  grade: v.optional(v.string()),
  certificationNumber: v.optional(v.string()),
  certifyingAuthority: v.optional(v.string()),
  conditionNotes: v.optional(v.string()),
  composition: v.optional(v.string()),
  diameterMm: v.optional(v.number()),
  weightGrams: v.optional(v.number()),
  perforation: v.optional(v.string()),
  watermark: v.optional(v.string()),
  color: v.optional(v.string()),
  rarity: v.optional(rarityValidator),
  acquisitionPrice: v.optional(v.number()),
  estimatedValue: v.optional(v.number()),
  storageLocation: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("coinsStampsDetails"),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      ...coinsStampsDetailsFields,
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
      requireCoinsStampsModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.read"),
    ]);

    return await ctx.db
      .query("coinsStampsDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();
  },
});

export const upsert = mutation({
  args: {
    collectionId: v.id("collections"),
    ...coinsStampsDetailsFields,
  },
  returns: v.id("coinsStampsDetails"),
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
      requireCoinsStampsModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("coinsStampsDetails")
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
          entityType: "coinsStampsDetails",
          entityId: existing._id,
          changes: updateData,
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("coinsStampsDetails", {
      collectionId,
      organizationId: collection.organizationId,
      ...updateData,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "coinsStampsDetails",
      entityId: id,
      changes: updateData,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    coinsStampsDetailsId: v.id("coinsStampsDetails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.coinsStampsDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Coins and stamps details not found");
    }
    await Promise.all([
      requireCoinsStampsModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
    ]);
    return rejectPermanentEvidenceDeletion();
  },
});
