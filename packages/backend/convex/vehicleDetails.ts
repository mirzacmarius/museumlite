import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  mutation,
  query,
} from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const odometerUnitValidator = v.union(v.literal("miles"), v.literal("km"));

const serviceLogEntryValidator = v.object({
  serviceDate: v.number(),
  serviceType: v.string(),
  description: v.string(),
  mileage: v.optional(v.number()),
  provider: v.optional(v.string()),
  cost: v.optional(v.number()),
  documentIds: v.optional(v.array(v.id("_storage"))),
});

const partsLifingEntryValidator = v.object({
  partName: v.string(),
  installDate: v.optional(v.number()),
  installMileage: v.optional(v.number()),
  expectedLifeMiles: v.optional(v.number()),
  notes: v.optional(v.string()),
});

const eventHistoryEntryValidator = v.object({
  eventDate: v.number(),
  eventType: v.union(
    v.literal("concours"),
    v.literal("show"),
    v.literal("race"),
    v.literal("rally"),
    v.literal("auction"),
    v.literal("other"),
  ),
  eventName: v.string(),
  location: v.optional(v.string()),
  result: v.optional(v.string()),
  awards: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
});

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
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      vin: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      bodyStyle: v.optional(v.string()),
      engineNumber: v.optional(v.string()),
      transmissionType: v.optional(v.string()),
      exteriorColor: v.optional(v.string()),
      interiorColor: v.optional(v.string()),
      odometer: v.optional(v.number()),
      odometerUnit: v.optional(odometerUnitValidator),
      fuelType: v.optional(v.string()),
      registrationNumber: v.optional(v.string()),
      registrationState: v.optional(v.string()),
      titleNumber: v.optional(v.string()),
      insuranceValue: v.optional(v.number()),
      serviceLog: v.optional(v.array(serviceLogEntryValidator)),
      partsLifing: v.optional(v.array(partsLifingEntryValidator)),
      eventHistory: v.optional(v.array(eventHistoryEntryValidator)),
      createdAt: v.number(),
      lastModifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
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

    await requireAutomotiveModule(ctx, details.organizationId);
    await requirePermission(ctx, details.organizationId, "collections.read");

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
    vin: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    bodyStyle: v.optional(v.string()),
    engineNumber: v.optional(v.string()),
    transmissionType: v.optional(v.string()),
    exteriorColor: v.optional(v.string()),
    interiorColor: v.optional(v.string()),
    odometer: v.optional(v.number()),
    odometerUnit: v.optional(odometerUnitValidator),
    fuelType: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    registrationState: v.optional(v.string()),
    titleNumber: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    serviceLog: v.optional(v.array(serviceLogEntryValidator)),
    partsLifing: v.optional(v.array(partsLifingEntryValidator)),
    eventHistory: v.optional(v.array(eventHistoryEntryValidator)),
  },
  returns: v.id("vehicleDetails"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
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
      await ctx.db.patch(existing._id, {
        ...updateData,
        lastModifiedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: collection.organizationId,
        userId,
        action: "updated",
        entityType: "vehicleDetails",
        entityId: existing._id,
        changes: updateData,
      });

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const details = await ctx.db.get(args.vehicleDetailsId);
    if (!details) {
      throw new Error("Vehicle details not found");
    }
    await Promise.all([
      requireAutomotiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
      ctx.db.delete(args.vehicleDetailsId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: details.organizationId,
        userId,
        action: "deleted",
        entityType: "vehicleDetails",
        entityId: args.vehicleDetailsId,
      }),
    ] as const);

    return null;
  },
});

export const addServiceLogEntry = mutation({
  args: {
    collectionId: v.id("collections"),
    entry: serviceLogEntryValidator,
  },
  returns: v.id("vehicleDetails"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
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
      await ctx.db.patch(existing._id, {
        serviceLog: [...currentLog, args.entry],
        lastModifiedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: collection.organizationId,
        userId,
        action: "added_service_log",
        entityType: "vehicleDetails",
        entityId: existing._id,
        changes: { entry: args.entry },
      });

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
    entry: eventHistoryEntryValidator,
  },
  returns: v.id("vehicleDetails"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
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
      await ctx.db.patch(existing._id, {
        eventHistory: [...currentHistory, args.entry],
        lastModifiedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: collection.organizationId,
        userId,
        action: "added_event_history",
        entityType: "vehicleDetails",
        entityId: existing._id,
        changes: { entry: args.entry },
      });

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
