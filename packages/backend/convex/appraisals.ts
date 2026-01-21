import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission } from "./utils/permissions";

const appraisalTypeValidator = v.union(
  v.literal("insurance"),
  v.literal("market"),
  v.literal("fair_market"),
  v.literal("replacement"),
  v.literal("liquidation"),
);

/**
 * Create an appraisal for a collection item
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    appraisalDate: v.number(),
    appraiserName: v.string(),
    appraiserCompany: v.optional(v.string()),
    appraiserCredentials: v.optional(v.string()),
    appraisalType: appraisalTypeValidator,
    value: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
    documents: v.optional(v.array(v.id("_storage"))),
    validUntil: v.optional(v.number()),
    setAsCurrent: v.optional(v.boolean()),
  },
  returns: v.id("appraisals"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    // If setting as current, unset any existing current appraisals
    if (args.setAsCurrent) {
      const existingAppraisals = await ctx.db
        .query("appraisals")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .filter((q) => q.eq(q.field("isCurrentAppraisal"), true))
        .collect();

      for (const appraisal of existingAppraisals) {
        await ctx.db.patch(appraisal._id, { isCurrentAppraisal: false });
      }
    }

    const appraisalId = await ctx.db.insert("appraisals", {
      organizationId: collection.organizationId,
      collectionId: args.collectionId,
      appraisalDate: args.appraisalDate,
      appraiserName: args.appraiserName,
      appraiserCompany: args.appraiserCompany,
      appraiserCredentials: args.appraiserCredentials,
      appraisalType: args.appraisalType,
      value: args.value,
      currency: args.currency,
      notes: args.notes,
      documents: args.documents,
      createdBy: userId,
      createdAt: Date.now(),
      validUntil: args.validUntil,
      isCurrentAppraisal: args.setAsCurrent ?? false,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "appraisal",
      entityId: appraisalId,
      changes: {
        collectionId: args.collectionId,
        value: args.value,
        appraisalType: args.appraisalType,
      },
    });

    return appraisalId;
  },
});

/**
 * Update an appraisal
 */
export const update = mutation({
  args: {
    appraisalId: v.id("appraisals"),
    appraisalDate: v.optional(v.number()),
    appraiserName: v.optional(v.string()),
    appraiserCompany: v.optional(v.string()),
    appraiserCredentials: v.optional(v.string()),
    appraisalType: v.optional(appraisalTypeValidator),
    value: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    documents: v.optional(v.array(v.id("_storage"))),
    validUntil: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    await requirePermission(
      ctx,
      appraisal.organizationId,
      "collections.update",
    );

    const updates: Record<string, unknown> = {};
    if (args.appraisalDate !== undefined)
      updates.appraisalDate = args.appraisalDate;
    if (args.appraiserName !== undefined)
      updates.appraiserName = args.appraiserName;
    if (args.appraiserCompany !== undefined)
      updates.appraiserCompany = args.appraiserCompany;
    if (args.appraiserCredentials !== undefined)
      updates.appraiserCredentials = args.appraiserCredentials;
    if (args.appraisalType !== undefined)
      updates.appraisalType = args.appraisalType;
    if (args.value !== undefined) updates.value = args.value;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.documents !== undefined) updates.documents = args.documents;
    if (args.validUntil !== undefined) updates.validUntil = args.validUntil;

    await ctx.db.patch(args.appraisalId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: appraisal.organizationId,
      userId,
      action: "updated",
      entityType: "appraisal",
      entityId: args.appraisalId,
      changes: updates,
    });

    return null;
  },
});

/**
 * Delete an appraisal
 */
export const remove = mutation({
  args: {
    appraisalId: v.id("appraisals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    await requirePermission(
      ctx,
      appraisal.organizationId,
      "collections.delete",
    );

    await ctx.db.delete(args.appraisalId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: appraisal.organizationId,
      userId,
      action: "deleted",
      entityType: "appraisal",
      entityId: args.appraisalId,
      changes: {},
    });

    return null;
  },
});

/**
 * Set an appraisal as the current/active one for an item
 */
export const setAsCurrent = mutation({
  args: {
    appraisalId: v.id("appraisals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    await requirePermission(
      ctx,
      appraisal.organizationId,
      "collections.update",
    );

    // Unset any existing current appraisals for this collection
    const existingAppraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", appraisal.collectionId),
      )
      .filter((q) => q.eq(q.field("isCurrentAppraisal"), true))
      .collect();

    for (const existing of existingAppraisals) {
      await ctx.db.patch(existing._id, { isCurrentAppraisal: false });
    }

    // Set this one as current
    await ctx.db.patch(args.appraisalId, { isCurrentAppraisal: true });

    return null;
  },
});

/**
 * Get an appraisal by ID
 */
export const get = query({
  args: {
    appraisalId: v.id("appraisals"),
  },
  returns: v.union(
    v.object({
      _id: v.id("appraisals"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      collectionId: v.id("collections"),
      appraisalDate: v.number(),
      appraiserName: v.string(),
      appraiserCompany: v.optional(v.string()),
      appraiserCredentials: v.optional(v.string()),
      appraisalType: appraisalTypeValidator,
      value: v.number(),
      currency: v.string(),
      notes: v.optional(v.string()),
      documents: v.optional(v.array(v.id("_storage"))),
      createdBy: v.id("users"),
      createdAt: v.number(),
      validUntil: v.optional(v.number()),
      isCurrentAppraisal: v.optional(v.boolean()),
      ageDays: v.number(),
      isValid: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      return null;
    }

    await requirePermission(ctx, appraisal.organizationId, "collections.read");

    const maxAgeMs = 730 * 24 * 60 * 60 * 1000; // 2 years
    const appraisalAge = Date.now() - appraisal.appraisalDate;
    const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));

    return {
      ...appraisal,
      ageDays,
      isValid: appraisalAge <= maxAgeMs,
    };
  },
});

/**
 * List appraisals for a collection item
 */
export const listByCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("appraisals"),
      appraisalDate: v.number(),
      appraiserName: v.string(),
      appraiserCompany: v.optional(v.string()),
      appraisalType: appraisalTypeValidator,
      value: v.number(),
      currency: v.string(),
      isCurrentAppraisal: v.optional(v.boolean()),
      ageDays: v.number(),
      isValid: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const appraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    const maxAgeMs = 730 * 24 * 60 * 60 * 1000;

    return appraisals
      .map((appraisal) => {
        const appraisalAge = Date.now() - appraisal.appraisalDate;
        const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));
        return {
          _id: appraisal._id,
          appraisalDate: appraisal.appraisalDate,
          appraiserName: appraisal.appraiserName,
          appraiserCompany: appraisal.appraiserCompany,
          appraisalType: appraisal.appraisalType,
          value: appraisal.value,
          currency: appraisal.currency,
          isCurrentAppraisal: appraisal.isCurrentAppraisal,
          ageDays,
          isValid: appraisalAge <= maxAgeMs,
        };
      })
      .sort((a, b) => b.appraisalDate - a.appraisalDate);
  },
});

/**
 * List appraisals for an organization with pagination
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    expiringSoon: v.optional(v.boolean()), // Filter to show appraisals expiring within 90 days
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("appraisals"),
        collectionId: v.id("collections"),
        collectionTitle: v.optional(v.string()),
        appraisalDate: v.number(),
        appraiserName: v.string(),
        appraisalType: appraisalTypeValidator,
        value: v.number(),
        currency: v.string(),
        ageDays: v.number(),
        isValid: v.boolean(),
        daysUntilExpiry: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    let appraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const maxAgeMs = 730 * 24 * 60 * 60 * 1000; // 2 years
    const expiryWarningMs = 90 * 24 * 60 * 60 * 1000; // 90 days

    let enrichedAppraisals = await Promise.all(
      appraisals.map(async (appraisal) => {
        const collection = await ctx.db.get(appraisal.collectionId);
        const appraisalAge = Date.now() - appraisal.appraisalDate;
        const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));
        const isValid = appraisalAge <= maxAgeMs;
        const daysUntilExpiry = isValid
          ? Math.floor((maxAgeMs - appraisalAge) / (24 * 60 * 60 * 1000))
          : undefined;

        return {
          _id: appraisal._id,
          collectionId: appraisal.collectionId,
          collectionTitle: collection?.title,
          appraisalDate: appraisal.appraisalDate,
          appraiserName: appraisal.appraiserName,
          appraisalType: appraisal.appraisalType,
          value: appraisal.value,
          currency: appraisal.currency,
          ageDays,
          isValid,
          daysUntilExpiry,
        };
      }),
    );

    // Filter for expiring soon if requested
    if (args.expiringSoon) {
      enrichedAppraisals = enrichedAppraisals.filter((a) => {
        const appraisalAge = Date.now() - a.appraisalDate;
        return appraisalAge >= maxAgeMs - expiryWarningMs;
      });
    }

    // Sort by appraisal date descending
    enrichedAppraisals.sort((a, b) => b.appraisalDate - a.appraisalDate);

    // Handle pagination
    const cursor = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      enrichedAppraisals.length,
    );
    const page = enrichedAppraisals.slice(startIndex, endIndex);

    return {
      page,
      isDone: endIndex >= enrichedAppraisals.length,
      continueCursor: endIndex.toString(),
    };
  },
});
