import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  fineArtDetailFields,
  provenanceChainEntryValidator,
  shippingLogEntryValidator,
  typeDetailRecordFields,
} from "./utils/collectionTypeDetailFields";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { requireModuleEnabled } from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

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
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...fineArtDetailFields,
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
    ...fineArtDetailFields,
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
    entry: provenanceChainEntryValidator,
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
    log: shippingLogEntryValidator,
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
