import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./utils/authorizationContext";
import { requireAmount, requireCurrencyCode } from "./utils/currency";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requirePermission, requireValuationRead } from "./utils/permissions";
import {
  APPRAISAL_PURPOSE_ORDER,
  appraisalAgeDays,
  appraisalExpiresAt,
  appraisalPurposeValidator,
  appraisalViewValidator,
  isWithinValuationAge,
  loadObjectAppraisals,
  MAX_APPRAISALS_PER_OBJECT,
  refreshCurrentValuationFlags,
  selectCurrentValuations,
  toAppraisalView,
  VALUATION_MAX_AGE_MS,
  VALUATION_PERMISSION,
} from "./utils/valuation";
import { valuationError } from "./utils/valuationErrors";

const appraisalFields = {
  appraisalDate: v.number(),
  appraiserName: v.string(),
  appraiserCompany: v.optional(v.string()),
  appraiserCredentials: v.optional(v.string()),
  appraisalType: appraisalPurposeValidator,
  value: v.number(),
  currency: v.string(),
  notes: v.optional(v.string()),
  validUntil: v.optional(v.number()),
};

interface AppraisalInput {
  appraisalDate: number;
  appraiserName: string;
  appraiserCompany?: string;
  appraiserCredentials?: string;
  appraisalType: Doc<"appraisals">["appraisalType"];
  value: number;
  currency: string;
  notes?: string;
  validUntil?: number;
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function requireRecordAppraisal(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  await Promise.all([
    requirePermission(ctx, organizationId, "collections.update"),
    requirePermission(ctx, organizationId, VALUATION_PERMISSION),
  ]);
}

/** Validates recorded appraisal facts; values are never edited afterwards. */
function validatedAppraisal(input: AppraisalInput) {
  const currency = requireCurrencyCode(input.currency);
  requireAmount(input.value, "Appraised value");
  if (!Number.isFinite(input.appraisalDate)) {
    throw valuationError("INVALID_DATE", "Appraisal date is invalid");
  }
  if (
    input.validUntil !== undefined &&
    (!Number.isFinite(input.validUntil) ||
      input.validUntil < input.appraisalDate)
  ) {
    throw valuationError(
      "INVALID_DATE",
      "Valid-until date must be on or after the appraisal date",
    );
  }
  const appraiserName = input.appraiserName.trim();
  if (!appraiserName) {
    throw valuationError("APPRAISER_REQUIRED", "Appraiser name is required");
  }
  return {
    appraisalDate: input.appraisalDate,
    appraiserName,
    appraiserCompany: optionalText(input.appraiserCompany),
    appraiserCredentials: optionalText(input.appraiserCredentials),
    appraisalType: input.appraisalType,
    value: input.value,
    currency,
    notes: optionalText(input.notes),
    validUntil: input.validUntil,
  };
}

/**
 * Record an appraisal for an object. It becomes the current valuation for its
 * purpose and currency when no later appraisal exists for them.
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    ...appraisalFields,
  },
  returns: v.id("appraisals"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw valuationError("REFERENCE_NOT_FOUND", "Object not found");
    }
    await requireRecordAppraisal(ctx, collection.organizationId);
    const { collectionId, ...input } = args;
    const fields = validatedAppraisal(input);

    const appraisalId = await ctx.db.insert("appraisals", {
      organizationId: collection.organizationId,
      collectionId,
      ...fields,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await refreshCurrentValuationFlags(ctx, collectionId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "appraisal",
      entityId: appraisalId,
      changes: {
        collectionId,
        purpose: fields.appraisalType,
        value: fields.value,
        currency: fields.currency,
        appraisalDate: fields.appraisalDate,
      },
    });

    return appraisalId;
  },
});

/** The trimmed correction reason; refuses already superseded appraisals. */
function supersessionReason(previous: Doc<"appraisals">, rawReason: string) {
  if (previous.supersededBy !== undefined) {
    throw valuationError(
      "APPRAISAL_ALREADY_SUPERSEDED",
      "This appraisal was already superseded; correct the superseding appraisal instead",
    );
  }
  const reason = rawReason.trim();
  if (!reason) {
    throw valuationError(
      "REASON_REQUIRED",
      "A reason is required to supersede an appraisal",
    );
  }
  return reason;
}

/**
 * Correct an appraisal by recording a superseding one. The superseded record
 * keeps its original values and remains in the object's history.
 */
export const supersede = mutation({
  args: {
    appraisalId: v.id("appraisals"),
    reason: v.string(),
    ...appraisalFields,
  },
  returns: v.id("appraisals"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const previous = await ctx.db.get(args.appraisalId);
    if (!previous) {
      throw valuationError("REFERENCE_NOT_FOUND", "Appraisal not found");
    }
    await requireRecordAppraisal(ctx, previous.organizationId);
    const reason = supersessionReason(previous, args.reason);
    const { appraisalId: _previousId, reason: _reason, ...input } = args;
    const fields = validatedAppraisal(input);
    const now = Date.now();

    const appraisalId = await ctx.db.insert("appraisals", {
      organizationId: previous.organizationId,
      collectionId: previous.collectionId,
      ...fields,
      // The supporting report stays attached to the corrected valuation.
      documents: previous.documents,
      supersedes: previous._id,
      supersessionReason: reason,
      createdBy: userId,
      createdAt: now,
    });
    await ctx.db.patch(previous._id, {
      supersededBy: appraisalId,
      supersededAt: now,
      supersededByUserId: userId,
    });
    await refreshCurrentValuationFlags(ctx, previous.collectionId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: previous.organizationId,
      userId,
      action: "superseded",
      entityType: "appraisal",
      entityId: previous._id,
      changes: {
        supersededBy: appraisalId,
        reason,
        previous: {
          purpose: previous.appraisalType,
          value: previous.value,
          currency: previous.currency,
          appraisalDate: previous.appraisalDate,
        },
        replacement: {
          purpose: fields.appraisalType,
          value: fields.value,
          currency: fields.currency,
          appraisalDate: fields.appraisalDate,
        },
      },
    });

    return appraisalId;
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

async function isCurrentAppraisal(
  ctx: Pick<QueryCtx, "db">,
  appraisal: Doc<"appraisals">,
) {
  if (appraisal.supersededBy !== undefined) return false;
  const current = selectCurrentValuations(
    await loadObjectAppraisals(ctx, appraisal.collectionId),
  );
  return [...current.values()].some((entry) => entry._id === appraisal._id);
}

/**
 * Get an appraisal by ID
 */
export const get = query({
  args: {
    appraisalId: v.id("appraisals"),
  },
  returns: v.union(
    appraisalViewValidator.extend({
      organizationId: v.id("organizations"),
      documents: v.optional(v.array(v.id("_storage"))),
      createdBy: v.id("users"),
      isValid: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      return null;
    }

    await requireValuationRead(ctx, appraisal.organizationId);

    const view = toAppraisalView(
      appraisal,
      await isCurrentAppraisal(ctx, appraisal),
      Date.now(),
    );
    return {
      ...view,
      organizationId: appraisal.organizationId,
      documents: appraisal.documents,
      createdBy: appraisal.createdBy,
      isValid:
        view.isWithinValuationAge && appraisal.supersededBy === undefined,
    };
  },
});

/**
 * List appraisals for a collection item, newest first, with the derived
 * current valuation marker.
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
      appraisalType: appraisalPurposeValidator,
      value: v.number(),
      currency: v.string(),
      isCurrent: v.boolean(),
      isSuperseded: v.boolean(),
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
      loadObjectAppraisals(ctx, args.collectionId),
    ] as const);
    const current = new Set(
      [...selectCurrentValuations(appraisals).values()].map(
        (appraisal) => appraisal._id,
      ),
    );
    const now = Date.now();

    return appraisals.map((appraisal) => ({
      _id: appraisal._id,
      appraisalDate: appraisal.appraisalDate,
      appraiserName: appraisal.appraiserName,
      appraiserCompany: appraisal.appraiserCompany,
      appraisalType: appraisal.appraisalType,
      value: appraisal.value,
      currency: appraisal.currency,
      isCurrent: current.has(appraisal._id),
      isSuperseded: appraisal.supersededBy !== undefined,
      ageDays: appraisalAgeDays(appraisal, now),
      isValid:
        appraisal.supersededBy === undefined &&
        isWithinValuationAge(appraisal, now, VALUATION_MAX_AGE_MS),
    }));
  },
});

/**
 * An object's valuations: the current valuation for each purpose and
 * currency, and the full appraisal history including superseded records.
 */
export const getObjectValuation = query({
  args: {
    collectionId: v.id("collections"),
    now: v.number(),
  },
  returns: v.union(
    v.object({
      current: v.array(appraisalViewValidator),
      history: v.array(appraisalViewValidator),
      truncated: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }
    await requireValuationRead(ctx, collection.organizationId);

    const appraisals = await loadObjectAppraisals(ctx, args.collectionId);
    const currentIds = new Set(
      [...selectCurrentValuations(appraisals).values()].map(
        (appraisal) => appraisal._id,
      ),
    );
    const history = appraisals.map((appraisal) =>
      toAppraisalView(appraisal, currentIds.has(appraisal._id), args.now),
    );
    const current = history
      .filter((entry) => entry.isCurrent)
      .sort(
        (a, b) =>
          APPRAISAL_PURPOSE_ORDER.indexOf(a.purpose) -
            APPRAISAL_PURPOSE_ORDER.indexOf(b.purpose) ||
          a.currency.localeCompare(b.currency),
      );

    return {
      current,
      history,
      truncated: appraisals.length >= MAX_APPRAISALS_PER_OBJECT,
    };
  },
});

/**
 * List appraisals for an organization with pagination
 */
const BOUNDED_APPRAISAL_SEARCH_SCAN_LIMIT = 500;
const APPRAISAL_EXPIRY_WARNING_MS = 90 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function enrichAppraisalPage(
  ctx: { db: QueryCtx["db"] },
  appraisals: Doc<"appraisals">[],
  now: number,
) {
  return await Promise.all(
    appraisals.map(async (appraisal) => {
      const collection = await ctx.db.get(appraisal.collectionId);
      const renewalDueAt = appraisalExpiresAt(appraisal, VALUATION_MAX_AGE_MS);
      const isValid =
        appraisal.supersededBy === undefined &&
        isWithinValuationAge(appraisal, now, VALUATION_MAX_AGE_MS);
      return {
        _id: appraisal._id,
        collectionId: appraisal.collectionId,
        collectionTitle: collection?.title,
        appraisalDate: appraisal.appraisalDate,
        appraiserName: appraisal.appraiserName,
        appraisalType: appraisal.appraisalType,
        value: appraisal.value,
        currency: appraisal.currency,
        isSuperseded: appraisal.supersededBy !== undefined,
        ageDays: appraisalAgeDays(appraisal, now),
        isValid,
        daysUntilExpiry: isValid
          ? Math.floor((renewalDueAt - now) / MS_PER_DAY)
          : undefined,
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
        appraisalType: appraisalPurposeValidator,
        value: v.number(),
        currency: v.string(),
        isSuperseded: v.boolean(),
        ageDays: v.number(),
        isValid: v.boolean(),
        daysUntilExpiry: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireValuationRead(ctx, args.organizationId);

    const now = Date.now();

    if (args.expiringSoon) {
      const recentAppraisals = await ctx.db
        .query("appraisals")
        .withIndex("by_organization_and_appraisalDate", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(BOUNDED_APPRAISAL_SEARCH_SCAN_LIMIT);

      const expiringAppraisals = recentAppraisals.filter(
        (appraisal) =>
          appraisal.supersededBy === undefined &&
          appraisalExpiresAt(appraisal, VALUATION_MAX_AGE_MS) - now <=
            APPRAISAL_EXPIRY_WARNING_MS,
      );

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

const BACKFILL_PAGE_SIZE = 50;

/**
 * Recomputes the stored current-valuation flag for objects with appraisals
 * recorded before purpose-scoped valuations. Bounded per page and resumable;
 * safe to run more than once.
 */
export const backfillCurrentValuations = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ processed: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("appraisals")
      .paginate({ numItems: BACKFILL_PAGE_SIZE, cursor: args.cursor ?? null });
    const objects = new Set<Id<"collections">>(
      page.page.map((appraisal) => appraisal.collectionId),
    );
    for (const collectionId of objects) {
      await refreshCurrentValuationFlags(ctx, collectionId);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.appraisals.backfillCurrentValuations,
        { cursor: page.continueCursor },
      );
    }
    return { processed: page.page.length, isDone: page.isDone };
  },
});
