import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { requireModuleEnabled } from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

const provenanceEntryValidator = v.object({
  eventType: v.union(
    v.literal("sale"),
    v.literal("auction"),
    v.literal("inheritance"),
    v.literal("gift"),
    v.literal("commission"),
    v.literal("acquisition"),
    v.literal("other"),
  ),
  owner: v.string(),
  startYear: v.optional(v.string()),
  endYear: v.optional(v.string()),
  location: v.optional(v.string()),
  salePrice: v.optional(v.number()),
  currency: v.optional(v.string()),
  auctionHouse: v.optional(v.string()),
  documentIds: v.optional(v.array(v.id("_storage"))),
  notes: v.optional(v.string()),
  verified: v.optional(v.boolean()),
});

const shippingLogValidator = v.object({
  fromLocation: v.string(),
  toLocation: v.string(),
  carrier: v.optional(v.string()),
  trackingNumber: v.optional(v.string()),
  departedAt: v.optional(v.number()),
  arrivedAt: v.optional(v.number()),
  conditionBefore: v.optional(v.string()),
  conditionAfter: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const displayStatusValidator = v.union(
  v.literal("on_display"),
  v.literal("in_storage"),
  v.literal("loaned_out"),
  v.literal("in_transit"),
  v.literal("conservation"),
);

async function requireFineArtModule(
  ctx: MutationCtx | QueryCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "fine_art");
}

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("fineArtDetails"),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      appraisedValue: v.optional(v.number()),
      replacementValue: v.optional(v.number()),
      insurancePolicyNumber: v.optional(v.string()),
      insuranceCarrier: v.optional(v.string()),
      insuranceExpiresAt: v.optional(v.number()),
      reappraisalDate: v.optional(v.number()),
      lastAppraisalDate: v.optional(v.number()),
      appraiser: v.optional(v.string()),
      displayStatus: v.optional(displayStatusValidator),
      provenanceChain: v.optional(v.array(provenanceEntryValidator)),
      shippingLogs: v.optional(v.array(shippingLogValidator)),
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
      requireFineArtModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.read"),
    ]);
    const details = await ctx.db
      .query("fineArtDetails")
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
    appraisedValue: v.optional(v.number()),
    replacementValue: v.optional(v.number()),
    insurancePolicyNumber: v.optional(v.string()),
    insuranceCarrier: v.optional(v.string()),
    insuranceExpiresAt: v.optional(v.number()),
    reappraisalDate: v.optional(v.number()),
    lastAppraisalDate: v.optional(v.number()),
    appraiser: v.optional(v.string()),
    displayStatus: v.optional(displayStatusValidator),
    provenanceChain: v.optional(v.array(provenanceEntryValidator)),
    shippingLogs: v.optional(v.array(shippingLogValidator)),
  },
  returns: v.id("fineArtDetails"),
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
      requireFineArtModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("fineArtDetails")
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
          entityType: "fineArtDetails",
          entityId: existing._id,
          changes: updateData,
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("fineArtDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      ...updateData,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "fineArtDetails",
      entityId: id,
      changes: updateData,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    fineArtDetailsId: v.id("fineArtDetails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.fineArtDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Fine art details not found");
    }
    await Promise.all([
      requireFineArtModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
    ]);
    return rejectPermanentEvidenceDeletion();
  },
});

export const addProvenanceEntry = mutation({
  args: {
    collectionId: v.id("collections"),
    entry: provenanceEntryValidator,
  },
  returns: v.id("fineArtDetails"),
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
      requireFineArtModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("fineArtDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    if (existing) {
      const currentChain = existing.provenanceChain ?? [];
      await Promise.all([
        ctx.db.patch(existing._id, {
          provenanceChain: [...currentChain, args.entry],
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "added_provenance",
          entityType: "fineArtDetails",
          entityId: existing._id,
          changes: { entry: args.entry },
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("fineArtDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      provenanceChain: [args.entry],
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created_with_provenance",
      entityType: "fineArtDetails",
      entityId: id,
      changes: { entry: args.entry },
    });

    return id;
  },
});

export const addShippingLog = mutation({
  args: {
    collectionId: v.id("collections"),
    log: shippingLogValidator,
  },
  returns: v.id("fineArtDetails"),
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
      requireFineArtModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("fineArtDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    if (existing) {
      const currentLogs = existing.shippingLogs ?? [];
      await Promise.all([
        ctx.db.patch(existing._id, {
          shippingLogs: [...currentLogs, args.log],
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "added_shipping_log",
          entityType: "fineArtDetails",
          entityId: existing._id,
          changes: { log: args.log },
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("fineArtDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      shippingLogs: [args.log],
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created_with_shipping_log",
      entityType: "fineArtDetails",
      entityId: id,
      changes: { log: args.log },
    });

    return id;
  },
});
