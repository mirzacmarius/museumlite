import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { mutation } from "./utils/mutationBuilders";
import { requirePartyAccess, toPartySummary } from "./utils/parties";
import {
  DUPLICATE_SCAN_ACCOUNT_LIMIT,
  DUPLICATE_SCAN_NEW_REVIEW_LIMIT,
  findDuplicatePairs,
  recordDuplicateSuggestions,
} from "./utils/partyDuplicates";
import { partyError } from "./utils/partyErrors";
import {
  duplicateReasonValidator,
  duplicateReviewDecisionValidator,
  duplicateReviewStatusValidator,
  partySummaryValidator,
} from "./utils/partyValidators";

/**
 * Compares the most recent parties by normalized name, email and phone and
 * records new pairs as pending reviews. Bounded and safe to rerun: a pair is
 * suggested once, whatever its later review outcome.
 */
export const scan = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    created: v.number(),
    scanned: v.number(),
    scanLimitReached: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await requirePartyAccess(ctx, args.organizationId, "accounts.write");
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(DUPLICATE_SCAN_ACCOUNT_LIMIT + 1);
    const scanned = accounts.slice(0, DUPLICATE_SCAN_ACCOUNT_LIMIT);
    const created = await recordDuplicateSuggestions(
      ctx,
      args.organizationId,
      findDuplicatePairs(scanned),
      userId,
      DUPLICATE_SCAN_NEW_REVIEW_LIMIT,
    );
    return {
      created,
      scanned: scanned.length,
      scanLimitReached: accounts.length > DUPLICATE_SCAN_ACCOUNT_LIMIT,
    };
  },
});

const duplicateReviewViewValidator = v.object({
  _id: v.id("partyDuplicateReviews"),
  status: duplicateReviewStatusValidator,
  reasons: v.array(duplicateReasonValidator),
  /** Null when the account is no longer available. */
  first: v.union(partySummaryValidator, v.null()),
  second: v.union(partySummaryValidator, v.null()),
  suggestedAt: v.number(),
  reviewedAt: v.optional(v.number()),
  reviewedByName: v.optional(v.string()),
  note: v.optional(v.string()),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    status: duplicateReviewStatusValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(duplicateReviewViewValidator),
  handler: async (ctx, args) => {
    await requirePartyAccess(ctx, args.organizationId, "accounts.read");
    const result = await ctx.db
      .query("partyDuplicateReviews")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", args.status),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (review) => {
        const [first, second, reviewer] = await Promise.all([
          ctx.db.get(review.firstAccountId),
          ctx.db.get(review.secondAccountId),
          review.reviewedBy ? ctx.db.get(review.reviewedBy) : null,
        ]);
        const summary = (account: typeof first) =>
          account && account.organizationId === review.organizationId
            ? toPartySummary(account)
            : null;
        return {
          _id: review._id,
          status: review.status,
          reasons: review.reasons,
          first: summary(first),
          second: summary(second),
          suggestedAt: review.suggestedAt,
          reviewedAt: review.reviewedAt,
          reviewedByName: reviewer?.name ?? undefined,
          note: review.note,
        };
      }),
    );
    return { ...result, page };
  },
});

/**
 * Records a reviewer's decision on a suggested pair. Neither party is
 * changed: duplicates are never merged automatically.
 */
export const resolve = mutation({
  args: {
    reviewId: v.id("partyDuplicateReviews"),
    decision: duplicateReviewDecisionValidator,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw partyError(
        "DUPLICATE_REVIEW_NOT_FOUND",
        "Duplicate suggestion not found",
      );
    }
    await requirePartyAccess(ctx, review.organizationId, "accounts.write");
    if (review.status !== "pending") {
      throw partyError(
        "DUPLICATE_REVIEW_ALREADY_RESOLVED",
        "This suggestion has already been reviewed",
      );
    }
    const note = args.note?.trim() || undefined;
    await ctx.db.patch(review._id, {
      status: args.decision,
      reviewedBy: userId,
      reviewedAt: Date.now(),
      note,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: review.organizationId,
      userId,
      action: "party_duplicate_reviewed",
      entityType: "account",
      entityId: review.firstAccountId,
      changes: {
        decision: args.decision,
        firstAccountId: review.firstAccountId,
        secondAccountId: review.secondAccountId,
        reasons: review.reasons,
        note,
      },
    });
    return null;
  },
});
