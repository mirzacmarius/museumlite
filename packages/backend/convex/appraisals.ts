import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { mutation } from "./utils/mutationBuilders";
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

      await Promise.all(
        existingAppraisals.map((appraisal) =>
          ctx.db.patch(appraisal._id, { isCurrentAppraisal: false }),
        ),
      );
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
    const [userId, appraisal] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.appraisalId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    await Promise.all([
      ctx.db.patch(args.appraisalId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: appraisal.organizationId,
        userId,
        action: "updated",
        entityType: "appraisal",
        entityId: args.appraisalId,
        changes: updates,
      }),
    ]);

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
    const [userId, appraisal] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.appraisalId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }
    await requirePermission(
      ctx,
      appraisal.organizationId,
      "collections.delete",
    );
    return rejectPermanentEvidenceDeletion();
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
    const [userId, appraisal] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.appraisalId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    const [, existingAppraisals] = await Promise.all([
      requirePermission(ctx, appraisal.organizationId, "collections.update"),
      ctx.db
        .query("appraisals")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", appraisal.collectionId),
        )
        .filter((q) => q.eq(q.field("isCurrentAppraisal"), true))
        .collect(),
    ] as const);

    await Promise.all([
      ...existingAppraisals.map((existing) =>
        ctx.db.patch(existing._id, { isCurrentAppraisal: false }),
      ),
      ctx.db.patch(args.appraisalId, { isCurrentAppraisal: true }),
    ]);

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

    const [, appraisals] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "collections.read"),
      ctx.db
        .query("appraisals")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect(),
    ] as const);

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
const BOUNDED_APPRAISAL_SEARCH_SCAN_LIMIT = 500;
const MAX_APPRAISAL_AGE_MS = 730 * 24 * 60 * 60 * 1000;
const APPRAISAL_EXPIRY_WARNING_MS = 90 * 24 * 60 * 60 * 1000;

async function enrichAppraisalPage(
  ctx: { db: QueryCtx["db"] },
  appraisals: Doc<"appraisals">[],
  now: number,
) {
  return await Promise.all(
    appraisals.map(async (appraisal) => {
      const collection = await ctx.db.get(appraisal.collectionId);
      const appraisalAge = now - appraisal.appraisalDate;
      const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));
      const isValid = appraisalAge <= MAX_APPRAISAL_AGE_MS;
      const daysUntilExpiry = isValid
        ? Math.floor(
            (MAX_APPRAISAL_AGE_MS - appraisalAge) / (24 * 60 * 60 * 1000),
          )
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
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    expiringSoon: v.optional(v.boolean()),
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

    const now = Date.now();

    if (args.expiringSoon) {
      const recentAppraisals = await ctx.db
        .query("appraisals")
        .withIndex("by_organization_and_appraisalDate", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(BOUNDED_APPRAISAL_SEARCH_SCAN_LIMIT);

      const expiringAppraisals = recentAppraisals.filter((appraisal) => {
        const appraisalAge = now - appraisal.appraisalDate;
        return (
          appraisalAge >= MAX_APPRAISAL_AGE_MS - APPRAISAL_EXPIRY_WARNING_MS
        );
      });

      const cursor = args.paginationOpts.cursor
        ? Number.parseInt(args.paginationOpts.cursor, 10)
        : 0;
      const startIndex = Number.isNaN(cursor) ? 0 : cursor;
      const endIndex = Math.min(
        startIndex + args.paginationOpts.numItems,
        expiringAppraisals.length,
      );
      const pageAppraisals = expiringAppraisals.slice(startIndex, endIndex);

      return {
        page: await enrichAppraisalPage(ctx, pageAppraisals, now),
        isDone: endIndex >= expiringAppraisals.length,
        continueCursor: endIndex.toString(),
      };
    }

    const paginationResult = await ctx.db
      .query("appraisals")
      .withIndex("by_organization_and_appraisalDate", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: await enrichAppraisalPage(ctx, paginationResult.page, now),
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.continueCursor,
    };
  },
});
