import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  typeDetailRecordFields,
  vehicleDetailFields,
  vehicleEventHistoryEntryValidator,
  vehicleServiceLogEntryValidator,
} from "./utils/collectionTypeDetailFields";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { requireModuleEnabled } from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

async function requireAutomotiveModule(
  ctx: MutationCtx | QueryCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "automotive");
}

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("vehicleDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...vehicleDetailFields,
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
      requireAutomotiveModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.read"),
    ]);
    const details = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    return details;
  },
});

export const getByVin = query({
  args: {
    vin: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("vehicleDetails"),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      vin: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const details = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_vin", (q) => q.eq("vin", args.vin))
      .unique();

    if (!details) {
      return null;
    }

    await Promise.all([
      requireAutomotiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.read"),
    ]);

    return {
      _id: details._id,
      collectionId: details.collectionId,
      organizationId: details.organizationId,
      vin: details.vin,
      make: details.make,
      model: details.model,
      year: details.year,
    };
  },
});

export const upsert = mutation({
  args: {
    collectionId: v.id("collections"),
    ...vehicleDetailFields,
  },
  returns: v.id("vehicleDetails"),
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
      requireAutomotiveModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("vehicleDetails")
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
          entityType: "vehicleDetails",
          entityId: existing._id,
          changes: updateData,
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("vehicleDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      ...updateData,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "vehicleDetails",
      entityId: id,
      changes: updateData,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    vehicleDetailsId: v.id("vehicleDetails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.vehicleDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Vehicle details not found");
    }
    await Promise.all([
      requireAutomotiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
    ]);
    return rejectPermanentEvidenceDeletion();
  },
});

export const addServiceLogEntry = mutation({
  args: {
    collectionId: v.id("collections"),
    entry: vehicleServiceLogEntryValidator,
  },
  returns: v.id("vehicleDetails"),
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
      requireAutomotiveModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    if (existing) {
      const currentLog = existing.serviceLog ?? [];
      await Promise.all([
        ctx.db.patch(existing._id, {
          serviceLog: [...currentLog, args.entry],
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "added_service_log",
          entityType: "vehicleDetails",
          entityId: existing._id,
          changes: { entry: args.entry },
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("vehicleDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      serviceLog: [args.entry],
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created_with_service_log",
      entityType: "vehicleDetails",
      entityId: id,
      changes: { entry: args.entry },
    });

    return id;
  },
});

export const addEventHistoryEntry = mutation({
  args: {
    collectionId: v.id("collections"),
    entry: vehicleEventHistoryEntryValidator,
  },
  returns: v.id("vehicleDetails"),
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
      requireAutomotiveModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    if (existing) {
      const currentHistory = existing.eventHistory ?? [];
      await Promise.all([
        ctx.db.patch(existing._id, {
          eventHistory: [...currentHistory, args.entry],
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "added_event_history",
          entityType: "vehicleDetails",
          entityId: existing._id,
          changes: { entry: args.entry },
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("vehicleDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      eventHistory: [args.entry],
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created_with_event_history",
      entityType: "vehicleDetails",
      entityId: id,
      changes: { entry: args.entry },
    });

    return id;
  },
});
