import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { generateNextTransitNumber } from "./utils/numberGenerator";
import { requirePermission } from "./utils/permissions";

const transitTypeValidator = v.union(
  v.literal("outgoing"),
  v.literal("incoming"),
  v.literal("internal"),
  v.literal("return"),
);

const transitStatusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("in_transit"),
  v.literal("out_for_delivery"),
  v.literal("delivered"),
  v.literal("delayed"),
  v.literal("held"),
  v.literal("returned"),
  v.literal("cancelled"),
);

const carrierTypeValidator = v.union(
  v.literal("art_handler"),
  v.literal("courier"),
  v.literal("freight"),
  v.literal("postal"),
  v.literal("internal"),
  v.literal("other"),
);

const weightUnitValidator = v.union(v.literal("kg"), v.literal("lb"));

const transitItemStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("damaged"),
  v.literal("missing"),
);

export const createTransitRecord = mutation({
  args: {
    organizationId: v.id("organizations"),
    transitType: transitTypeValidator,
    originName: v.string(),
    originAddress: v.optional(v.string()),
    originLocationId: v.optional(v.id("locations")),
    originContact: v.optional(v.string()),
    originPhone: v.optional(v.string()),
    destinationName: v.string(),
    destinationAddress: v.optional(v.string()),
    destinationLocationId: v.optional(v.id("locations")),
    destinationContact: v.optional(v.string()),
    destinationPhone: v.optional(v.string()),
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    carrierType: v.optional(carrierTypeValidator),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    waybillNumber: v.optional(v.string()),
    scheduledPickupDate: v.optional(v.number()),
    estimatedDeliveryDate: v.optional(v.number()),
    packageCount: v.optional(v.number()),
    totalWeight: v.optional(v.number()),
    weightUnit: v.optional(weightUnitValidator),
    dimensions: v.optional(v.string()),
    packingMethod: v.optional(v.string()),
    specialHandling: v.optional(v.array(v.string())),
    insurancePolicyId: v.optional(v.id("insurancePolicies")),
    insuranceValue: v.optional(v.number()),
    insuranceReference: v.optional(v.string()),
    shippingCost: v.optional(v.number()),
    currency: v.optional(v.string()),
    loanId: v.optional(v.id("loans")),
    exhibitionId: v.optional(v.id("exhibitions")),
    collectionIds: v.optional(v.array(v.id("collections"))),
    notes: v.optional(v.string()),
  },
  returns: v.id("transitRecords"),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "loans.create"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.loanId) {
      const loan = await ctx.db.get(args.loanId);
      if (!loan) {
        throw new Error("Loan not found");
      }
      if (loan.organizationId !== args.organizationId) {
        throw new Error("Loan does not belong to this organization");
      }
    }

    if (args.exhibitionId) {
      const exhibition = await ctx.db.get(args.exhibitionId);
      if (!exhibition) {
        throw new Error("Exhibition not found");
      }
      if (exhibition.organizationId !== args.organizationId) {
        throw new Error("Exhibition does not belong to this organization");
      }
    }

    if (args.collectionIds && args.collectionIds.length > 0) {
      await Promise.all(
        Array.from(args.collectionIds).map(async (collectionId) => {
          const collection = await ctx.db.get(collectionId);
          if (!collection) {
            throw new Error(`Collection ${collectionId} not found`);
          }
          if (collection.organizationId !== args.organizationId) {
            throw new Error(
              `Collection ${collectionId} does not belong to organization`,
            );
          }
        }),
      );
    }

    const transitNumber = await generateNextTransitNumber(
      ctx,
      args.organizationId,
    );
    const now = Date.now();

    const transitRecordId = await ctx.db.insert("transitRecords", {
      organizationId: args.organizationId,
      transitNumber,
      transitType: args.transitType,
      originName: args.originName,
      originAddress: args.originAddress,
      originLocationId: args.originLocationId,
      originContact: args.originContact,
      originPhone: args.originPhone,
      destinationName: args.destinationName,
      destinationAddress: args.destinationAddress,
      destinationLocationId: args.destinationLocationId,
      destinationContact: args.destinationContact,
      destinationPhone: args.destinationPhone,
      carrier: args.carrier,
      carrierContact: args.carrierContact,
      carrierPhone: args.carrierPhone,
      carrierEmail: args.carrierEmail,
      carrierType: args.carrierType,
      trackingNumber: args.trackingNumber,
      trackingUrl: args.trackingUrl,
      waybillNumber: args.waybillNumber,
      scheduledPickupDate: args.scheduledPickupDate,
      estimatedDeliveryDate: args.estimatedDeliveryDate,
      status: "draft",
      packageCount: args.packageCount,
      totalWeight: args.totalWeight,
      weightUnit: args.weightUnit,
      dimensions: args.dimensions,
      packingMethod: args.packingMethod,
      specialHandling: args.specialHandling,
      insurancePolicyId: args.insurancePolicyId,
      insuranceValue: args.insuranceValue,
      insuranceReference: args.insuranceReference,
      shippingCost: args.shippingCost,
      currency: args.currency ?? "USD",
      loanId: args.loanId,
      exhibitionId: args.exhibitionId,
      collectionIds: args.collectionIds,
      notes: args.notes,
      createdBy: userId,
      createdAt: now,
    });

    if (args.collectionIds && args.collectionIds.length > 0) {
      await Promise.all(
        Array.from(args.collectionIds).map(async (collectionId) => {
          await ctx.db.insert("transitItems", {
            transitRecordId,
            collectionId,
            status: "pending",
            createdAt: now,
          });
        }),
      );
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "transitRecord",
      entityId: transitRecordId,
      changes: { transitNumber, transitType: args.transitType },
    });

    return transitRecordId;
  },
});

export const updateTransitRecord = mutation({
  args: {
    transitRecordId: v.id("transitRecords"),
    originName: v.optional(v.string()),
    originAddress: v.optional(v.string()),
    originLocationId: v.optional(v.id("locations")),
    originContact: v.optional(v.string()),
    originPhone: v.optional(v.string()),
    destinationName: v.optional(v.string()),
    destinationAddress: v.optional(v.string()),
    destinationLocationId: v.optional(v.id("locations")),
    destinationContact: v.optional(v.string()),
    destinationPhone: v.optional(v.string()),
    carrier: v.optional(v.string()),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    carrierType: v.optional(carrierTypeValidator),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    waybillNumber: v.optional(v.string()),
    scheduledPickupDate: v.optional(v.number()),
    estimatedDeliveryDate: v.optional(v.number()),
    packageCount: v.optional(v.number()),
    totalWeight: v.optional(v.number()),
    weightUnit: v.optional(weightUnitValidator),
    dimensions: v.optional(v.string()),
    packingMethod: v.optional(v.string()),
    specialHandling: v.optional(v.array(v.string())),
    insurancePolicyId: v.optional(v.id("insurancePolicies")),
    insuranceValue: v.optional(v.number()),
    insuranceReference: v.optional(v.string()),
    shippingCost: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, transitRecord] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.transitRecordId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!transitRecord) {
      throw new Error("Transit record not found");
    }

    if (
      transitRecord.status === "delivered" ||
      transitRecord.status === "cancelled"
    ) {
      throw new Error("Cannot update delivered or cancelled transit records");
    }

    await requirePermission(ctx, transitRecord.organizationId, "loans.update");

    const { transitRecordId, ...updates } = args;

    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length > 0) {
      filteredUpdates.lastModifiedBy = userId;
      filteredUpdates.lastModifiedAt = Date.now();
      await ctx.db.patch(args.transitRecordId, filteredUpdates);
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: transitRecord.organizationId,
      userId,
      action: "updated",
      entityType: "transitRecord",
      entityId: args.transitRecordId,
      changes: filteredUpdates,
    });

    return null;
  },
});

export const updateTransitStatus = mutation({
  args: {
    transitRecordId: v.id("transitRecords"),
    status: transitStatusValidator,
    location: v.optional(v.string()),
    description: v.string(),
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    reportedByName: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
    documentIds: v.optional(v.array(v.id("_storage"))),
    notes: v.optional(v.string()),
  },
  returns: v.id("transitStatusUpdates"),
  handler: async (ctx, args) => {
    const [userId, transitRecord] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.transitRecordId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!transitRecord) {
      throw new Error("Transit record not found");
    }

    await requirePermission(ctx, transitRecord.organizationId, "loans.update");

    const now = Date.now();

    const statusUpdateId = await ctx.db.insert("transitStatusUpdates", {
      transitRecordId: args.transitRecordId,
      status: args.status,
      location: args.location,
      description: args.description,
      temperature: args.temperature,
      humidity: args.humidity,
      reportedBy: userId,
      reportedByName: args.reportedByName,
      reportedAt: now,
      photoIds: args.photoIds,
      documentIds: args.documentIds,
      notes: args.notes,
    });

    const statusUpdates: Record<string, unknown> = {
      status: args.status,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    };

    if (args.status === "in_transit" && !transitRecord.actualPickupDate) {
      statusUpdates.actualPickupDate = now;
    }

    if (args.status === "delivered" && !transitRecord.actualDeliveryDate) {
      statusUpdates.actualDeliveryDate = now;
    }

    await ctx.db.patch(args.transitRecordId, statusUpdates);

    if (args.status === "in_transit") {
      const transitItems = await ctx.db
        .query("transitItems")
        .withIndex("by_transitRecord", (q) =>
          q.eq("transitRecordId", args.transitRecordId),
        )
        .collect();

      await Promise.all(
        Array.from(transitItems).map(async (item) => {
          if (item.status === "pending") {
            await ctx.db.patch(item._id, { status: "in_transit" });
          }
        }),
      );
    }

    if (args.status === "delivered") {
      const transitItems = await ctx.db
        .query("transitItems")
        .withIndex("by_transitRecord", (q) =>
          q.eq("transitRecordId", args.transitRecordId),
        )
        .collect();

      await Promise.all(
        Array.from(transitItems).map(async (item) => {
          if (item.status === "in_transit" || item.status === "pending") {
            await ctx.db.patch(item._id, { status: "delivered" });
          }
        }),
      );
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: transitRecord.organizationId,
      userId,
      action: "status_updated",
      entityType: "transitRecord",
      entityId: args.transitRecordId,
      changes: { status: args.status, description: args.description },
    });

    await notifyTransitStatusChange(
      ctx,
      transitRecord.organizationId,
      args.transitRecordId,
      transitRecord.transitNumber,
      args.status,
      args.description,
      userId,
    );

    return statusUpdateId;
  },
});

async function notifyTransitStatusChange(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  transitRecordId: Id<"transitRecords">,
  transitNumber: string,
  status: string,
  description: string,
  excludeUserId: Id<"users">,
): Promise<void> {
  const notifyStatuses = [
    "in_transit",
    "out_for_delivery",
    "delivered",
    "delayed",
    "held",
  ];

  if (!notifyStatuses.includes(status)) {
    return;
  }

  const userOrgs = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const statusLabels: Record<string, string> = {
    in_transit: "In Transit",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    delayed: "Delayed",
    held: "Held",
  };

  const title = `Transit ${statusLabels[status] ?? status}: ${transitNumber}`;
  const message = description;

  await Promise.all(
    Array.from(userOrgs).map(async (userOrg) => {
      if (userOrg.userId !== excludeUserId) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId,
          userId: userOrg.userId,
          type: "transit_status_update",
          title,
          message,
          relatedEntityType: "transitRecord",
          relatedEntityId: transitRecordId,
        });
      }
    }),
  );
}

export const deleteTransitRecord = mutation({
  args: {
    transitRecordId: v.id("transitRecords"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, transitRecord] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.transitRecordId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!transitRecord) {
      throw new Error("Transit record not found");
    }

    if (
      transitRecord.status !== "draft" &&
      transitRecord.status !== "cancelled"
    ) {
      throw new Error("Can only delete draft or cancelled transit records");
    }

    const [, transitItems, statusUpdates] = await Promise.all([
      requirePermission(
        ctx,
        transitRecord.organizationId,
        "organization.manage_settings",
      ),
      ctx.db
        .query("transitItems")
        .withIndex("by_transitRecord", (q) =>
          q.eq("transitRecordId", args.transitRecordId),
        )
        .collect(),
      ctx.db
        .query("transitStatusUpdates")
        .withIndex("by_transitRecord", (q) =>
          q.eq("transitRecordId", args.transitRecordId),
        )
        .collect(),
    ] as const);

    await Promise.all([
      ...transitItems.map((item) => ctx.db.delete(item._id)),
      ...statusUpdates.map((update) => ctx.db.delete(update._id)),
      ctx.db.delete(args.transitRecordId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: transitRecord.organizationId,
        userId,
        action: "deleted",
        entityType: "transitRecord",
        entityId: args.transitRecordId,
        changes: { transitNumber: transitRecord.transitNumber },
      }),
    ]);

    return null;
  },
});

export const getTransitRecord = query({
  args: {
    transitRecordId: v.id("transitRecords"),
  },
  returns: v.union(
    v.object({
      _id: v.id("transitRecords"),
      organizationId: v.id("organizations"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      originName: v.string(),
      originAddress: v.optional(v.string()),
      originLocationId: v.optional(v.id("locations")),
      originLocation: v.optional(
        v.object({ _id: v.id("locations"), name: v.string() }),
      ),
      originContact: v.optional(v.string()),
      originPhone: v.optional(v.string()),
      destinationName: v.string(),
      destinationAddress: v.optional(v.string()),
      destinationLocationId: v.optional(v.id("locations")),
      destinationLocation: v.optional(
        v.object({ _id: v.id("locations"), name: v.string() }),
      ),
      destinationContact: v.optional(v.string()),
      destinationPhone: v.optional(v.string()),
      carrier: v.string(),
      carrierContact: v.optional(v.string()),
      carrierPhone: v.optional(v.string()),
      carrierEmail: v.optional(v.string()),
      carrierType: v.optional(carrierTypeValidator),
      trackingNumber: v.optional(v.string()),
      trackingUrl: v.optional(v.string()),
      waybillNumber: v.optional(v.string()),
      scheduledPickupDate: v.optional(v.number()),
      actualPickupDate: v.optional(v.number()),
      estimatedDeliveryDate: v.optional(v.number()),
      actualDeliveryDate: v.optional(v.number()),
      status: transitStatusValidator,
      packageCount: v.optional(v.number()),
      totalWeight: v.optional(v.number()),
      weightUnit: v.optional(weightUnitValidator),
      dimensions: v.optional(v.string()),
      packingMethod: v.optional(v.string()),
      specialHandling: v.optional(v.array(v.string())),
      insurancePolicyId: v.optional(v.id("insurancePolicies")),
      insuranceValue: v.optional(v.number()),
      insuranceReference: v.optional(v.string()),
      shippingCost: v.optional(v.number()),
      currency: v.optional(v.string()),
      conditionAtPickup: v.optional(v.string()),
      conditionAtDelivery: v.optional(v.string()),
      notes: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      loanId: v.optional(v.id("loans")),
      loan: v.optional(
        v.object({ _id: v.id("loans"), loanNumber: v.string() }),
      ),
      exhibitionId: v.optional(v.id("exhibitions")),
      exhibition: v.optional(
        v.object({ _id: v.id("exhibitions"), title: v.string() }),
      ),
      items: v.array(
        v.object({
          _id: v.id("transitItems"),
          collectionId: v.id("collections"),
          accessionNumber: v.string(),
          title: v.string(),
          conditionAtPickup: v.optional(v.string()),
          conditionAtDelivery: v.optional(v.string()),
          status: transitItemStatusValidator,
          notes: v.optional(v.string()),
        }),
      ),
      statusHistory: v.array(
        v.object({
          _id: v.id("transitStatusUpdates"),
          status: transitStatusValidator,
          location: v.optional(v.string()),
          description: v.string(),
          temperature: v.optional(v.number()),
          humidity: v.optional(v.number()),
          reportedBy: v.optional(v.id("users")),
          reportedByName: v.optional(v.string()),
          reportedAt: v.number(),
        }),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
      lastModifiedBy: v.optional(v.id("users")),
      lastModifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const transitRecord = await ctx.db.get(args.transitRecordId);
    if (!transitRecord) {
      return null;
    }

    await requirePermission(ctx, transitRecord.organizationId, "loans.read");

    let originLocation: { _id: Id<"locations">; name: string } | undefined;
    if (transitRecord.originLocationId) {
      const loc = await ctx.db.get(transitRecord.originLocationId);
      if (loc) {
        originLocation = { _id: loc._id, name: loc.name };
      }
    }

    let destinationLocation: { _id: Id<"locations">; name: string } | undefined;
    if (transitRecord.destinationLocationId) {
      const loc = await ctx.db.get(transitRecord.destinationLocationId);
      if (loc) {
        destinationLocation = { _id: loc._id, name: loc.name };
      }
    }

    let loan: { _id: Id<"loans">; loanNumber: string } | undefined;
    if (transitRecord.loanId) {
      const loanDoc = await ctx.db.get(transitRecord.loanId);
      if (loanDoc) {
        loan = { _id: loanDoc._id, loanNumber: loanDoc.loanNumber };
      }
    }

    let exhibition: { _id: Id<"exhibitions">; title: string } | undefined;
    if (transitRecord.exhibitionId) {
      const exhibitionDoc = await ctx.db.get(transitRecord.exhibitionId);
      if (exhibitionDoc) {
        exhibition = { _id: exhibitionDoc._id, title: exhibitionDoc.title };
      }
    }

    const transitItems = await ctx.db
      .query("transitItems")
      .withIndex("by_transitRecord", (q) =>
        q.eq("transitRecordId", args.transitRecordId),
      )
      .collect();

    const [items, statusUpdates] = await Promise.all([
      Promise.all(
        transitItems.map(async (item) => {
          const collection = await ctx.db.get(item.collectionId);
          return {
            _id: item._id,
            collectionId: item.collectionId,
            accessionNumber: collection?.accessionNumber ?? "",
            title: collection?.title ?? "",
            conditionAtPickup: item.conditionAtPickup,
            conditionAtDelivery: item.conditionAtDelivery,
            status: item.status,
            notes: item.notes,
          };
        }),
      ),
      ctx.db
        .query("transitStatusUpdates")
        .withIndex("by_transitRecord", (q) =>
          q.eq("transitRecordId", args.transitRecordId),
        )
        .collect(),
    ] as const);

    const statusHistory = statusUpdates
      .sort((a, b) => b.reportedAt - a.reportedAt)
      .map((update) => ({
        _id: update._id,
        status: update.status,
        location: update.location,
        description: update.description,
        temperature: update.temperature,
        humidity: update.humidity,
        reportedBy: update.reportedBy,
        reportedByName: update.reportedByName,
        reportedAt: update.reportedAt,
      }));

    return {
      _id: transitRecord._id,
      organizationId: transitRecord.organizationId,
      transitNumber: transitRecord.transitNumber,
      transitType: transitRecord.transitType,
      originName: transitRecord.originName,
      originAddress: transitRecord.originAddress,
      originLocationId: transitRecord.originLocationId,
      originLocation,
      originContact: transitRecord.originContact,
      originPhone: transitRecord.originPhone,
      destinationName: transitRecord.destinationName,
      destinationAddress: transitRecord.destinationAddress,
      destinationLocationId: transitRecord.destinationLocationId,
      destinationLocation,
      destinationContact: transitRecord.destinationContact,
      destinationPhone: transitRecord.destinationPhone,
      carrier: transitRecord.carrier,
      carrierContact: transitRecord.carrierContact,
      carrierPhone: transitRecord.carrierPhone,
      carrierEmail: transitRecord.carrierEmail,
      carrierType: transitRecord.carrierType,
      trackingNumber: transitRecord.trackingNumber,
      trackingUrl: transitRecord.trackingUrl,
      waybillNumber: transitRecord.waybillNumber,
      scheduledPickupDate: transitRecord.scheduledPickupDate,
      actualPickupDate: transitRecord.actualPickupDate,
      estimatedDeliveryDate: transitRecord.estimatedDeliveryDate,
      actualDeliveryDate: transitRecord.actualDeliveryDate,
      status: transitRecord.status,
      packageCount: transitRecord.packageCount,
      totalWeight: transitRecord.totalWeight,
      weightUnit: transitRecord.weightUnit,
      dimensions: transitRecord.dimensions,
      packingMethod: transitRecord.packingMethod,
      specialHandling: transitRecord.specialHandling,
      insurancePolicyId: transitRecord.insurancePolicyId,
      insuranceValue: transitRecord.insuranceValue,
      insuranceReference: transitRecord.insuranceReference,
      shippingCost: transitRecord.shippingCost,
      currency: transitRecord.currency,
      conditionAtPickup: transitRecord.conditionAtPickup,
      conditionAtDelivery: transitRecord.conditionAtDelivery,
      notes: transitRecord.notes,
      internalNotes: transitRecord.internalNotes,
      loanId: transitRecord.loanId,
      loan,
      exhibitionId: transitRecord.exhibitionId,
      exhibition,
      items,
      statusHistory,
      createdBy: transitRecord.createdBy,
      createdAt: transitRecord.createdAt,
      lastModifiedBy: transitRecord.lastModifiedBy,
      lastModifiedAt: transitRecord.lastModifiedAt,
    };
  },
});

export const listTransitRecords = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(transitStatusValidator),
    transitType: v.optional(transitTypeValidator),
    carrier: v.optional(v.string()),
    loanId: v.optional(v.id("loans")),
    exhibitionId: v.optional(v.id("exhibitions")),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("transitRecords"),
        transitNumber: v.string(),
        transitType: transitTypeValidator,
        originName: v.string(),
        destinationName: v.string(),
        carrier: v.string(),
        trackingNumber: v.optional(v.string()),
        status: transitStatusValidator,
        scheduledPickupDate: v.optional(v.number()),
        estimatedDeliveryDate: v.optional(v.number()),
        actualDeliveryDate: v.optional(v.number()),
        itemCount: v.number(),
        loanNumber: v.optional(v.string()),
        exhibitionTitle: v.optional(v.string()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "loans.read");

    let baseQuery = ctx.db
      .query("transitRecords")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.status) {
      baseQuery = baseQuery.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.transitType) {
      baseQuery = baseQuery.filter((q) =>
        q.eq(q.field("transitType"), args.transitType),
      );
    }

    if (args.carrier) {
      baseQuery = baseQuery.filter((q) =>
        q.eq(q.field("carrier"), args.carrier),
      );
    }

    if (args.loanId) {
      baseQuery = baseQuery.filter((q) => q.eq(q.field("loanId"), args.loanId));
    }

    if (args.exhibitionId) {
      baseQuery = baseQuery.filter((q) =>
        q.eq(q.field("exhibitionId"), args.exhibitionId),
      );
    }

    let allResults = await baseQuery.collect();

    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      allResults = allResults.filter((record) => {
        return (
          record.transitNumber?.toLowerCase().includes(searchLower) ||
          record.originName?.toLowerCase().includes(searchLower) ||
          record.destinationName?.toLowerCase().includes(searchLower) ||
          record.carrier?.toLowerCase().includes(searchLower) ||
          record.trackingNumber?.toLowerCase().includes(searchLower) ||
          false
        );
      });
    }

    allResults.sort((a, b) => b.createdAt - a.createdAt);

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allResults.length,
    );
    const page = allResults.slice(startIndex, endIndex);

    const recordsWithDetails = await Promise.all(
      page.map(async (record) => {
        const items = await ctx.db
          .query("transitItems")
          .withIndex("by_transitRecord", (q) =>
            q.eq("transitRecordId", record._id),
          )
          .collect();

        let loanNumber: string | undefined;
        if (record.loanId) {
          const loan = await ctx.db.get(record.loanId);
          loanNumber = loan?.loanNumber;
        }

        let exhibitionTitle: string | undefined;
        if (record.exhibitionId) {
          const exhibition = await ctx.db.get(record.exhibitionId);
          exhibitionTitle = exhibition?.title;
        }

        return {
          _id: record._id,
          transitNumber: record.transitNumber,
          transitType: record.transitType,
          originName: record.originName,
          destinationName: record.destinationName,
          carrier: record.carrier,
          trackingNumber: record.trackingNumber,
          status: record.status,
          scheduledPickupDate: record.scheduledPickupDate,
          estimatedDeliveryDate: record.estimatedDeliveryDate,
          actualDeliveryDate: record.actualDeliveryDate,
          itemCount: items.length,
          loanNumber,
          exhibitionTitle,
        };
      }),
    );

    return {
      page: recordsWithDetails,
      isDone: endIndex >= allResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const addItemsToTransit = mutation({
  args: {
    transitRecordId: v.id("transitRecords"),
    collectionIds: v.array(v.id("collections")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, transitRecord] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.transitRecordId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!transitRecord) {
      throw new Error("Transit record not found");
    }

    if (
      transitRecord.status !== "draft" &&
      transitRecord.status !== "scheduled"
    ) {
      throw new Error(
        "Can only add items to draft or scheduled transit records",
      );
    }

    const [, existingItems] = await Promise.all([
      requirePermission(ctx, transitRecord.organizationId, "loans.update"),
      ctx.db
        .query("transitItems")
        .withIndex("by_transitRecord", (q) =>
          q.eq("transitRecordId", args.transitRecordId),
        )
        .collect(),
    ] as const);
    const existingCollectionIds = new Set(
      existingItems.map((i) => i.collectionId),
    );

    const now = Date.now();

    await Promise.all(
      Array.from(args.collectionIds).map(async (collectionId) => {
        if (existingCollectionIds.has(collectionId)) {
          return;
        }

        const collection = await ctx.db.get(collectionId);
        if (!collection) {
          throw new Error(`Collection ${collectionId} not found`);
        }
        if (collection.organizationId !== transitRecord.organizationId) {
          throw new Error(
            `Collection ${collectionId} does not belong to organization`,
          );
        }

        await ctx.db.insert("transitItems", {
          transitRecordId: args.transitRecordId,
          collectionId,
          status: "pending",
          createdAt: now,
        });
      }),
    );

    const currentCollectionIds = transitRecord.collectionIds ?? [];
    const newCollectionIdSet = new Set(currentCollectionIds);
    for (const collectionId of args.collectionIds) {
      newCollectionIdSet.add(collectionId);
    }
    const newCollectionIds = [...newCollectionIdSet];

    await ctx.db.patch(args.transitRecordId, {
      collectionIds: newCollectionIds,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    });

    return null;
  },
});

export const removeItemFromTransit = mutation({
  args: {
    transitItemId: v.id("transitItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, transitItem] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.transitItemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!transitItem) {
      throw new Error("Transit item not found");
    }

    const transitRecord = await ctx.db.get(transitItem.transitRecordId);
    if (!transitRecord) {
      throw new Error("Transit record not found");
    }

    if (
      transitRecord.status !== "draft" &&
      transitRecord.status !== "scheduled"
    ) {
      throw new Error(
        "Can only remove items from draft or scheduled transit records",
      );
    }

    await requirePermission(ctx, transitRecord.organizationId, "loans.update");

    await ctx.db.delete(args.transitItemId);

    const currentCollectionIds = transitRecord.collectionIds ?? [];
    const newCollectionIds = currentCollectionIds.filter(
      (id) => id !== transitItem.collectionId,
    );

    await ctx.db.patch(transitRecord._id, {
      collectionIds: newCollectionIds.length > 0 ? newCollectionIds : undefined,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const updateTransitItemCondition = mutation({
  args: {
    transitItemId: v.id("transitItems"),
    conditionAtPickup: v.optional(v.string()),
    conditionAtDelivery: v.optional(v.string()),
    status: v.optional(transitItemStatusValidator),
    packingNotes: v.optional(v.string()),
    specialHandling: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, transitItem] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.transitItemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!transitItem) {
      throw new Error("Transit item not found");
    }

    const transitRecord = await ctx.db.get(transitItem.transitRecordId);
    if (!transitRecord) {
      throw new Error("Transit record not found");
    }

    await requirePermission(ctx, transitRecord.organizationId, "loans.update");

    const { transitItemId, ...updates } = args;

    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(args.transitItemId, filteredUpdates);
    }

    return null;
  },
});

export const getTransitForLoan = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.array(
    v.object({
      _id: v.id("transitRecords"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      carrier: v.string(),
      status: transitStatusValidator,
      scheduledPickupDate: v.optional(v.number()),
      estimatedDeliveryDate: v.optional(v.number()),
      actualDeliveryDate: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return [];
    }

    const [, transitRecords] = await Promise.all([
      requirePermission(ctx, loan.organizationId, "loans.read"),
      ctx.db
        .query("transitRecords")
        .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
        .collect(),
    ] as const);

    return transitRecords.map((record) => ({
      _id: record._id,
      transitNumber: record.transitNumber,
      transitType: record.transitType,
      carrier: record.carrier,
      status: record.status,
      scheduledPickupDate: record.scheduledPickupDate,
      estimatedDeliveryDate: record.estimatedDeliveryDate,
      actualDeliveryDate: record.actualDeliveryDate,
    }));
  },
});

export const getTransitForLoanWithHistory = query({
  args: { loanId: v.id("loans"), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("transitRecords"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      carrier: v.string(),
      status: transitStatusValidator,
      scheduledPickupDate: v.optional(v.number()),
      estimatedDeliveryDate: v.optional(v.number()),
      actualDeliveryDate: v.optional(v.number()),
      statusHistory: v.array(
        v.object({
          status: transitStatusValidator,
          location: v.optional(v.string()),
          description: v.string(),
          reportedAt: v.number(),
          reportedByName: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    // Load loan first to get organizationId for permission check
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return [];
    }

    // Permission check: require loans.read (same as existing transit queries)
    const [, transitRecords] = await Promise.all([
      requirePermission(ctx, loan.organizationId, "loans.read"),
      ctx.db
        .query("transitRecords")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect(),
    ] as const);

    // Limit to 5 most recent records if limit specified
    const recordsToProcess = args.limit
      ? transitRecords.slice(0, args.limit)
      : transitRecords;

    // For each record, fetch status history
    const recordsWithHistory = await Promise.all(
      recordsToProcess.map(async (record) => {
        const statusUpdates = await ctx.db
          .query("transitStatusUpdates")
          .withIndex("by_transitRecord", (q) =>
            q.eq("transitRecordId", record._id),
          )
          .collect();

        const statusHistory = statusUpdates
          .sort((a, b) => b.reportedAt - a.reportedAt)
          .map((update) => ({
            status: update.status,
            location: update.location,
            description: update.description,
            reportedAt: update.reportedAt,
            reportedByName: update.reportedByName,
          }));

        return {
          _id: record._id,
          transitNumber: record.transitNumber,
          transitType: record.transitType,
          carrier: record.carrier,
          status: record.status,
          scheduledPickupDate: record.scheduledPickupDate,
          estimatedDeliveryDate: record.estimatedDeliveryDate,
          actualDeliveryDate: record.actualDeliveryDate,
          statusHistory,
        };
      }),
    );

    return recordsWithHistory;
  },
});

export const getTransitForExhibition = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("transitRecords"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      carrier: v.string(),
      status: transitStatusValidator,
      scheduledPickupDate: v.optional(v.number()),
      estimatedDeliveryDate: v.optional(v.number()),
      actualDeliveryDate: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      return [];
    }

    const [, transitRecords] = await Promise.all([
      requirePermission(ctx, exhibition.organizationId, "loans.read"),
      ctx.db
        .query("transitRecords")
        .withIndex("by_exhibition", (q) =>
          q.eq("exhibitionId", args.exhibitionId),
        )
        .collect(),
    ] as const);

    return transitRecords.map((record) => ({
      _id: record._id,
      transitNumber: record.transitNumber,
      transitType: record.transitType,
      carrier: record.carrier,
      status: record.status,
      scheduledPickupDate: record.scheduledPickupDate,
      estimatedDeliveryDate: record.estimatedDeliveryDate,
      actualDeliveryDate: record.actualDeliveryDate,
    }));
  },
});

export const getTransitForCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("transitRecords"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      originName: v.string(),
      destinationName: v.string(),
      carrier: v.string(),
      status: transitStatusValidator,
      scheduledPickupDate: v.optional(v.number()),
      estimatedDeliveryDate: v.optional(v.number()),
      actualDeliveryDate: v.optional(v.number()),
      itemStatus: transitItemStatusValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    const [, transitItems] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "loans.read"),
      ctx.db
        .query("transitItems")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect(),
    ] as const);

    const results = await Promise.all(
      transitItems.map(async (item) => {
        const record = await ctx.db.get(item.transitRecordId);
        if (!record) return null;

        return {
          _id: record._id,
          transitNumber: record.transitNumber,
          transitType: record.transitType,
          originName: record.originName,
          destinationName: record.destinationName,
          carrier: record.carrier,
          status: record.status,
          scheduledPickupDate: record.scheduledPickupDate,
          estimatedDeliveryDate: record.estimatedDeliveryDate,
          actualDeliveryDate: record.actualDeliveryDate,
          itemStatus: item.status,
        };
      }),
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const getUpcomingDeliveries = query({
  args: {
    organizationId: v.id("organizations"),
    days: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("transitRecords"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      destinationName: v.string(),
      carrier: v.string(),
      status: transitStatusValidator,
      estimatedDeliveryDate: v.optional(v.number()),
      itemCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "loans.read");

    const daysAhead = args.days ?? 7;
    const now = Date.now();
    const futureDate = now + daysAhead * 24 * 60 * 60 * 1000;

    const transitRecords = await ctx.db
      .query("transitRecords")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "in_transit"),
      )
      .collect();

    const incomingRecords = transitRecords.filter(
      (r) =>
        r.estimatedDeliveryDate &&
        r.estimatedDeliveryDate >= now &&
        r.estimatedDeliveryDate <= futureDate,
    );

    const outForDeliveryRecords = await ctx.db
      .query("transitRecords")
      .withIndex("by_organization_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("status", "out_for_delivery"),
      )
      .collect();

    const allRecords = [...incomingRecords, ...outForDeliveryRecords];
    allRecords.sort((a, b) => {
      const dateA = a.estimatedDeliveryDate ?? Number.MAX_SAFE_INTEGER;
      const dateB = b.estimatedDeliveryDate ?? Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });

    const results = await Promise.all(
      allRecords.map(async (record) => {
        const items = await ctx.db
          .query("transitItems")
          .withIndex("by_transitRecord", (q) =>
            q.eq("transitRecordId", record._id),
          )
          .collect();

        return {
          _id: record._id,
          transitNumber: record.transitNumber,
          transitType: record.transitType,
          destinationName: record.destinationName,
          carrier: record.carrier,
          status: record.status,
          estimatedDeliveryDate: record.estimatedDeliveryDate,
          itemCount: items.length,
        };
      }),
    );

    return results;
  },
});

export const getTransitStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalActive: v.number(),
    inTransit: v.number(),
    outForDelivery: v.number(),
    scheduled: v.number(),
    delayed: v.number(),
    deliveredThisMonth: v.number(),
  }),
  handler: async (ctx, args) => {
    const [, allRecords] = await Promise.all([
      requirePermission(ctx, args.organizationId, "loans.read"),
      ctx.db
        .query("transitRecords")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ] as const);

    const _now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthTs = startOfMonth.getTime();

    const inTransit = allRecords.filter(
      (r) => r.status === "in_transit",
    ).length;
    const outForDelivery = allRecords.filter(
      (r) => r.status === "out_for_delivery",
    ).length;
    const scheduled = allRecords.filter((r) => r.status === "scheduled").length;
    const delayed = allRecords.filter((r) => r.status === "delayed").length;
    const totalActive = inTransit + outForDelivery + scheduled + delayed;

    const deliveredThisMonth = allRecords.filter(
      (r) =>
        r.status === "delivered" &&
        r.actualDeliveryDate &&
        r.actualDeliveryDate >= startOfMonthTs,
    ).length;

    return {
      totalActive,
      inTransit,
      outForDelivery,
      scheduled,
      delayed,
      deliveredThisMonth,
    };
  },
});

export const checkUpcomingDeliveriesInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    const now = Date.now();
    const tomorrow = now + 24 * 60 * 60 * 1000;

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const transitRecords = await ctx.db
          .query("transitRecords")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();

        const upcomingDeliveries = transitRecords.filter(
          (r) =>
            (r.status === "in_transit" || r.status === "out_for_delivery") &&
            r.estimatedDeliveryDate &&
            r.estimatedDeliveryDate >= now &&
            r.estimatedDeliveryDate <= tomorrow,
        );

        if (upcomingDeliveries.length > 0) {
          const userOrgs = await ctx.db
            .query("userOrganizations")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", org._id),
            )
            .collect();

          await Promise.all(
            userOrgs.flatMap((userOrg) =>
              upcomingDeliveries.map((transit) =>
                ctx.runMutation(internal.audit.createNotificationInternal, {
                  organizationId: org._id,
                  userId: userOrg.userId,
                  type: "transit_delivery_reminder",
                  title: `Delivery Expected Tomorrow: ${transit.transitNumber}`,
                  message: `Transit ${transit.transitNumber} to ${transit.destinationName} is expected to arrive tomorrow.`,
                  relatedEntityType: "transitRecord",
                  relatedEntityId: transit._id,
                }),
              ),
            ),
          );
        }
      }),
    );

    return null;
  },
});

export const checkDelayedTransitsInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    const now = Date.now();

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const transitRecords = await ctx.db
          .query("transitRecords")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();

        const overdueDeliveries = transitRecords.filter(
          (r) =>
            (r.status === "in_transit" ||
              r.status === "out_for_delivery" ||
              r.status === "scheduled") &&
            r.estimatedDeliveryDate &&
            r.estimatedDeliveryDate < now,
        );

        await Promise.all(
          Array.from(overdueDeliveries).map(async (transit) => {
            const [, userOrgs] = await Promise.all([
              Promise.all([
                ctx.db.patch(transit._id, {
                  status: "delayed",
                  lastModifiedAt: now,
                }),
                ctx.db.insert("transitStatusUpdates", {
                  transitRecordId: transit._id,
                  status: "delayed",
                  description:
                    "Automatically marked as delayed - past estimated delivery date",
                  reportedAt: now,
                }),
              ]),
              ctx.db
                .query("userOrganizations")
                .withIndex("by_organization", (q) =>
                  q.eq("organizationId", org._id),
                )
                .collect(),
            ]);

            await Promise.all(
              userOrgs.map((userOrg) =>
                ctx.runMutation(internal.audit.createNotificationInternal, {
                  organizationId: org._id,
                  userId: userOrg.userId,
                  type: "transit_delayed",
                  title: `Transit Delayed: ${transit.transitNumber}`,
                  message: `Transit ${transit.transitNumber} is past its estimated delivery date and has been marked as delayed.`,
                  relatedEntityType: "transitRecord",
                  relatedEntityId: transit._id,
                }),
              ),
            );
          }),
        );
      }),
    );

    return null;
  },
});
