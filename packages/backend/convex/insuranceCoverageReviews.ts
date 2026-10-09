import { customQuery } from "convex-helpers/server/customFunctions";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./utils/authorizationContext";
import {
  normalizeCurrency,
  requireAmount,
  requireCurrencyCode,
} from "./utils/currency";
import {
  type CoverageTarget,
  coverageTargetKindValidator,
  describeTarget,
  needsTargetReview,
  recordedTargets,
  requireTargetInOrganization,
  targetFields,
  targetId,
} from "./utils/insuranceCoverage";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requireCapability } from "./utils/permissions";
import { valuationError } from "./utils/valuationErrors";

/**
 * Review queue for legacy insurance coverages that name more than one target.
 * Nothing is split or reassigned automatically: a person decides which
 * target the recorded coverage applies to and, optionally, records separate
 * coverages with explicit values for the other targets.
 */

/** Coverage reviews belong to the insurance capability (loans plan). */
const insuranceReadQuery = customQuery(query, {
  args: { organizationId: v.id("organizations") },
  input: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    await requireCapability(ctx, args.organizationId, "insurance", "loans.read");
    return { ctx: { userId, organizationId: args.organizationId }, args: {} };
  },
});

const reviewStatusValidator = v.union(v.literal("open"), v.literal("resolved"));

const reviewViewValidator = v.object({
  _id: v.id("legacyCoverageReviews"),
  coverageId: v.id("insuranceCoverages"),
  policyId: v.id("insurancePolicies"),
  policyNumber: v.string(),
  policyCurrency: v.optional(v.string()),
  coveredValue: v.number(),
  coverageCurrency: v.optional(v.string()),
  status: reviewStatusValidator,
  detectedAt: v.number(),
  targets: v.array(
    v.object({
      kind: coverageTargetKindValidator,
      id: v.string(),
      label: v.string(),
      reference: v.optional(v.string()),
    }),
  ),
  resolution: v.optional(
    v.object({
      keptTarget: coverageTargetKindValidator,
      createdCoverageIds: v.array(v.id("insuranceCoverages")),
      note: v.optional(v.string()),
      resolvedByName: v.optional(v.string()),
      resolvedAt: v.number(),
    }),
  ),
});

type ReviewView = Infer<typeof reviewViewValidator>;

const REVIEW_PAGE_LIMIT = 100;

async function toReviewView(
  ctx: Pick<QueryCtx, "db">,
  review: Doc<"legacyCoverageReviews">,
): Promise<ReviewView> {
  const [coverage, policy] = await Promise.all([
    ctx.db.get(review.coverageId),
    ctx.db.get(review.policyId),
  ]);
  const targets: ReviewView["targets"] = [];
  for (const target of recordedTargets(review)) {
    const described = await describeTarget(ctx, target);
    targets.push({
      kind: target.kind,
      id: targetId(target),
      label: described?.label ?? "",
      reference: described?.reference,
    });
  }
  let resolution: ReviewView["resolution"];
  if (review.resolution) {
    const resolver = await ctx.db.get(review.resolution.resolvedBy);
    resolution = {
      keptTarget: review.resolution.keptTarget,
      createdCoverageIds: review.resolution.createdCoverageIds,
      note: review.resolution.note,
      resolvedByName: resolver?.name ?? resolver?.username ?? undefined,
      resolvedAt: review.resolution.resolvedAt,
    };
  }
  return {
    _id: review._id,
    coverageId: review.coverageId,
    policyId: review.policyId,
    policyNumber: policy?.policyNumber ?? "",
    policyCurrency: policy?.currency,
    coveredValue: review.coveredValue,
    coverageCurrency: normalizeCurrency(coverage?.currency) ?? undefined,
    status: review.status,
    detectedAt: review.detectedAt,
    targets,
    resolution,
  };
}

export const list = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(reviewStatusValidator),
  },
  returns: v.object({
    reviews: v.array(reviewViewValidator),
    openCount: v.number(),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const status = args.status ?? "open";
    const rows = await ctx.db
      .query("legacyCoverageReviews")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", ctx.organizationId).eq("status", status),
      )
      .order("desc")
      .take(REVIEW_PAGE_LIMIT + 1);
    let openCount = 0;
    const open = ctx.db
      .query("legacyCoverageReviews")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", ctx.organizationId).eq("status", "open"),
      );
    for await (const _review of open) openCount += 1;

    const reviews: ReviewView[] = [];
    for (const review of rows.slice(0, REVIEW_PAGE_LIMIT)) {
      reviews.push(await toReviewView(ctx, review));
    }
    return {
      reviews,
      openCount,
      truncated: rows.length > REVIEW_PAGE_LIMIT,
    };
  },
});

function requireOpenReview(review: Doc<"legacyCoverageReviews">) {
  if (review.status === "resolved") {
    throw valuationError(
      "LEGACY_REVIEW_RESOLVED",
      "This coverage review was already resolved",
    );
  }
}

/**
 * Resolve a legacy coverage: it keeps only the chosen target. Each `split`
 * entry records a separate coverage, under the same policy and dates, for
 * another of the legacy targets with the value and currency the reviewer
 * entered.
 */
export const resolve = mutation({
  args: {
    reviewId: v.id("legacyCoverageReviews"),
    keep: coverageTargetKindValidator,
    currency: v.optional(v.string()),
    split: v.optional(
      v.array(
        v.object({
          kind: coverageTargetKindValidator,
          coveredValue: v.number(),
          currency: v.string(),
        }),
      ),
    ),
    note: v.optional(v.string()),
  },
  returns: v.object({
    createdCoverageIds: v.array(v.id("insuranceCoverages")),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw valuationError("REFERENCE_NOT_FOUND", "Review not found");
    }
    await requireCapability(
      ctx,
      review.organizationId,
      "insurance",
      "organization.manage_settings",
    );
    requireOpenReview(review);
    const coverage = await ctx.db.get(review.coverageId);
    if (!coverage || coverage.organizationId !== review.organizationId) {
      throw valuationError("REFERENCE_NOT_FOUND", "Coverage not found");
    }

    const legacyTargets = recordedTargets(review);
    const targetOf = (kind: CoverageTarget["kind"]) =>
      legacyTargets.find((target) => target.kind === kind);
    const kept = targetOf(args.keep);
    const split = args.split ?? [];
    const splitKinds = new Set(split.map((entry) => entry.kind));
    if (
      !kept ||
      splitKinds.size !== split.length ||
      splitKinds.has(args.keep) ||
      split.some((entry) => !targetOf(entry.kind))
    ) {
      throw valuationError(
        "LEGACY_REVIEW_TARGET_INVALID",
        "Choose targets recorded on the legacy coverage, each once",
      );
    }

    const currency =
      args.currency === undefined
        ? undefined
        : requireCurrencyCode(args.currency);
    await requireTargetInOrganization(ctx, kept, review.organizationId);
    const splitRows: Array<{
      target: CoverageTarget;
      coveredValue: number;
      currency: string;
    }> = [];
    for (const entry of split) {
      const target = targetOf(entry.kind);
      if (!target) continue;
      requireAmount(entry.coveredValue, "Covered value");
      await requireTargetInOrganization(ctx, target, review.organizationId);
      splitRows.push({
        target,
        coveredValue: entry.coveredValue,
        currency: requireCurrencyCode(entry.currency),
      });
    }

    const now = Date.now();
    const note = args.note?.trim() || undefined;
    await ctx.db.patch(coverage._id, {
      collectionId: undefined,
      loanId: undefined,
      exhibitionId: undefined,
      ...targetFields(kept),
      ...(currency === undefined ? {} : { currency }),
    });
    const createdCoverageIds: Id<"insuranceCoverages">[] = [];
    for (const row of splitRows) {
      createdCoverageIds.push(
        await ctx.db.insert("insuranceCoverages", {
          organizationId: coverage.organizationId,
          policyId: coverage.policyId,
          ...targetFields(row.target),
          splitFromCoverageId: coverage._id,
          coveredValue: row.coveredValue,
          currency: row.currency,
          effectiveDate: coverage.effectiveDate,
          expirationDate: coverage.expirationDate,
          status: coverage.status,
          notes: note,
          createdBy: userId,
          createdAt: now,
        }),
      );
    }
    await ctx.db.patch(review._id, {
      status: "resolved",
      resolution: {
        keptTarget: kept.kind,
        createdCoverageIds,
        note,
        resolvedBy: userId,
        resolvedAt: now,
      },
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: review.organizationId,
      userId,
      action: "target_review_resolved",
      entityType: "insuranceCoverage",
      entityId: coverage._id,
      changes: {
        legacyTargets: legacyTargets.map((target) => ({
          kind: target.kind,
          id: targetId(target),
        })),
        keptTarget: { kind: kept.kind, id: targetId(kept) },
        currency: currency ?? coverage.currency,
        createdCoverages: splitRows.map((row, index) => ({
          coverageId: createdCoverageIds[index],
          kind: row.target.kind,
          id: targetId(row.target),
          coveredValue: row.coveredValue,
          currency: row.currency,
        })),
        note,
      },
    });

    return { createdCoverageIds };
  },
});

const ENQUEUE_PAGE_SIZE = 100;

/**
 * Opens a review for every legacy coverage that names several targets.
 * Bounded per page, resumable and idempotent; coverages are not changed.
 */
export const enqueueLegacyCoverageReviews = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    scanned: v.number(),
    opened: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("insuranceCoverages")
      .paginate({ numItems: ENQUEUE_PAGE_SIZE, cursor: args.cursor ?? null });
    const now = Date.now();
    let opened = 0;
    for (const coverage of page.page) {
      if (coverage.status === "removed" || !needsTargetReview(coverage)) {
        continue;
      }
      const existing = await ctx.db
        .query("legacyCoverageReviews")
        .withIndex("by_coverage", (q) => q.eq("coverageId", coverage._id))
        .first();
      if (existing) continue;
      await ctx.db.insert("legacyCoverageReviews", {
        organizationId: coverage.organizationId,
        coverageId: coverage._id,
        policyId: coverage.policyId,
        status: "open",
        collectionId: coverage.collectionId,
        loanId: coverage.loanId,
        exhibitionId: coverage.exhibitionId,
        coveredValue: coverage.coveredValue,
        detectedAt: now,
      });
      opened += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.insuranceCoverageReviews.enqueueLegacyCoverageReviews,
        { cursor: page.continueCursor },
      );
    }
    return { scanned: page.page.length, opened, isDone: page.isDone };
  },
});
