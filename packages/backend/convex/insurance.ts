import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./utils/authorizationContext";
import { createOrganizationQuery } from "./utils/convexAuth";
import {
  CurrencyTotalsBuilder,
  currencyTotalsValidator,
  normalizeCurrency,
  requireAmount,
  requireCurrencyCode,
} from "./utils/currency";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import {
  type CoverageTarget,
  collectInForceCoverage,
  coverageInterval,
  coverageState,
  coverageStateValidator,
  coverageTarget,
  coverageTargetKindValidator,
  coverageTargetValidator,
  describeTarget,
  effectivePolicyStatus,
  recordedTargets,
  requireCoveragePeriod,
  requireTargetInOrganization,
  targetFields,
  targetId,
} from "./utils/insuranceCoverage";
import {
  computeCoverageAlerts,
  coverageAlertsValidator,
} from "./utils/insuranceCoverageAlerts";
import {
  computeInsuranceStats,
  insuranceStatsValidator,
} from "./utils/insuranceStats";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { generateNextClaimNumber } from "./utils/numberGenerator";
import {
  getUserIdsWithPermission,
  requirePermission,
} from "./utils/permissions";
import {
  appraisalAgeDays,
  appraisalExpiresAt,
  currentValuationFor,
  DAY_MS,
  INSURANCE_APPRAISAL_MAX_AGE_MS,
  VALUATION_MAX_AGE_MS,
} from "./utils/valuation";
import { valuationError } from "./utils/valuationErrors";

const insuranceReadQuery = createOrganizationQuery("loans.read");

const policyTypeValidator = v.union(
  v.literal("blanket"),
  v.literal("scheduled"),
  v.literal("exhibition"),
  v.literal("transit"),
  v.literal("loan"),
);

const policyStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending"),
  v.literal("expired"),
  v.literal("cancelled"),
  v.literal("suspended"),
);

const premiumFrequencyValidator = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("semi_annual"),
  v.literal("annual"),
);

const coverageStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending"),
  v.literal("expired"),
  v.literal("removed"),
);

const incidentTypeValidator = v.union(
  v.literal("damage"),
  v.literal("theft"),
  v.literal("loss"),
  v.literal("fire"),
  v.literal("water"),
  v.literal("vandalism"),
  v.literal("natural_disaster"),
  v.literal("transit"),
  v.literal("other"),
);

const claimStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("settled"),
  v.literal("closed"),
  v.literal("appealed"),
);

const payoutMethodValidator = v.union(
  v.literal("check"),
  v.literal("wire"),
  v.literal("repair_reimbursement"),
  v.literal("replacement"),
);

type ReadCtx = Pick<QueryCtx, "db">;

function requirePolicyPeriod(effectiveDate: number, expirationDate: number) {
  if (
    !Number.isFinite(effectiveDate) ||
    !Number.isFinite(expirationDate) ||
    expirationDate <= effectiveDate
  ) {
    throw valuationError(
      "INVALID_POLICY_PERIOD",
      "The policy must expire after it takes effect",
    );
  }
}

async function requirePolicyNumberAvailable(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  policyNumber: string,
) {
  const existingPolicy = await ctx.db
    .query("insurancePolicies")
    .withIndex("by_organization_and_policyNumber", (q) =>
      q.eq("organizationId", organizationId).eq("policyNumber", policyNumber),
    )
    .first();
  if (existingPolicy) {
    throw valuationError("POLICY_NUMBER_TAKEN", "Policy number already exists");
  }
}

/** Recorded status for a newly dated policy. */
function statusFromDates(
  effectiveDate: number,
  expirationDate: number,
  now: number,
): "active" | "pending" | "expired" {
  if (expirationDate < now) return "expired";
  return effectiveDate <= now ? "active" : "pending";
}

export const createPolicy = mutation({
  args: {
    organizationId: v.id("organizations"),
    policyNumber: v.string(),
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    policyType: policyTypeValidator,
    coverageAmount: v.number(),
    currency: v.string(),
    deductible: v.optional(v.number()),
    perItemLimit: v.optional(v.number()),
    premiumAmount: v.optional(v.number()),
    premiumFrequency: v.optional(premiumFrequencyValidator),
    nextPremiumDue: v.optional(v.number()),
    effectiveDate: v.number(),
    expirationDate: v.number(),
    renewalDate: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
    territory: v.optional(v.string()),
    exclusions: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  returns: v.id("insurancePolicies"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );
    const currency = requireCurrencyCode(args.currency);
    requirePolicyPeriod(args.effectiveDate, args.expirationDate);
    requireAmount(args.coverageAmount, "Coverage amount");
    requireAmount(args.deductible, "Deductible");
    requireAmount(args.perItemLimit, "Per-item limit");
    requireAmount(args.premiumAmount, "Premium");
    const policyNumber = args.policyNumber.trim();
    await requirePolicyNumberAvailable(ctx, args.organizationId, policyNumber);

    const now = Date.now();
    const policyId = await ctx.db.insert("insurancePolicies", {
      ...args,
      policyNumber,
      carrier: args.carrier.trim(),
      currency,
      status: statusFromDates(args.effectiveDate, args.expirationDate, now),
      createdBy: userId,
      createdAt: now,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "insurancePolicy",
      entityId: policyId,
      changes: {
        policyNumber,
        carrier: args.carrier,
        currency,
        effectiveDate: args.effectiveDate,
        expirationDate: args.expirationDate,
      },
    });

    return policyId;
  },
});

/**
 * When an expired policy is renewed, coverages that lapsed with it return to
 * force. Coverages whose own end date has passed stay expired.
 */
async function reactivateRenewedCoverages(
  ctx: MutationCtx,
  policyId: Id<"insurancePolicies">,
  now: number,
) {
  const lapsed = await ctx.db
    .query("insuranceCoverages")
    .withIndex("by_policy_and_status", (q) =>
      q.eq("policyId", policyId).eq("status", "expired"),
    )
    .take(MAX_POLICY_COVERAGES);
  let reactivated = 0;
  for (const coverage of lapsed) {
    if (
      coverage.expirationDate !== undefined &&
      coverage.expirationDate < now
    ) {
      continue;
    }
    await ctx.db.patch(coverage._id, { status: "active" });
    reactivated += 1;
  }
  return reactivated;
}

export const updatePolicy = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    policyNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    policyType: v.optional(policyTypeValidator),
    coverageAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    deductible: v.optional(v.number()),
    perItemLimit: v.optional(v.number()),
    premiumAmount: v.optional(v.number()),
    premiumFrequency: v.optional(premiumFrequencyValidator),
    nextPremiumDue: v.optional(v.number()),
    effectiveDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    renewalDate: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
    status: v.optional(policyStatusValidator),
    territory: v.optional(v.string()),
    exclusions: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw valuationError("REFERENCE_NOT_FOUND", "Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const { policyId, ...updates } = args;
    const filteredUpdates: Partial<Doc<"insurancePolicies">> =
      Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined),
      );

    if (args.policyNumber !== undefined) {
      const policyNumber = args.policyNumber.trim();
      if (policyNumber !== policy.policyNumber) {
        await requirePolicyNumberAvailable(
          ctx,
          policy.organizationId,
          policyNumber,
        );
      }
      filteredUpdates.policyNumber = policyNumber;
    }
    if (args.currency !== undefined) {
      filteredUpdates.currency = requireCurrencyCode(args.currency);
    }
    requireAmount(args.coverageAmount, "Coverage amount");
    requireAmount(args.deductible, "Deductible");
    requireAmount(args.perItemLimit, "Per-item limit");
    requireAmount(args.premiumAmount, "Premium");

    const effectiveDate = args.effectiveDate ?? policy.effectiveDate;
    const expirationDate = args.expirationDate ?? policy.expirationDate;
    const datesChanged =
      args.effectiveDate !== undefined || args.expirationDate !== undefined;
    if (datesChanged) {
      requirePolicyPeriod(effectiveDate, expirationDate);
      const now = Date.now();
      if (
        args.status === undefined &&
        (policy.status === "active" ||
          policy.status === "pending" ||
          policy.status === "expired")
      ) {
        filteredUpdates.status = statusFromDates(
          effectiveDate,
          expirationDate,
          now,
        );
      }
    }

    const renewed =
      policy.status === "expired" &&
      (filteredUpdates.status === "active" ||
        filteredUpdates.status === "pending");
    const reactivated = renewed
      ? await reactivateRenewedCoverages(ctx, args.policyId, Date.now())
      : 0;

    await Promise.all([
      ctx.db.patch(args.policyId, {
        ...filteredUpdates,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: policy.organizationId,
        userId,
        action: "updated",
        entityType: "insurancePolicy",
        entityId: args.policyId,
        changes: reactivated
          ? { ...filteredUpdates, reactivatedCoverages: reactivated }
          : filteredUpdates,
      }),
    ]);

    return null;
  },
});

const MAX_POLICY_COVERAGES = 200;
const MAX_POLICY_CLAIMS = 200;

export const deletePolicy = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, policy] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.policyId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!policy) {
      throw new Error("Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );
    return rejectPermanentEvidenceDeletion();
  },
});

export const listPolicies = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
    status: v.optional(policyStatusValidator),
    policyType: v.optional(policyTypeValidator),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("insurancePolicies"),
        policyNumber: v.string(),
        carrier: v.string(),
        policyType: policyTypeValidator,
        coverageAmount: v.number(),
        currency: v.optional(v.string()),
        effectiveDate: v.number(),
        expirationDate: v.number(),
        status: policyStatusValidator,
        coverageCount: v.number(),
        claimsCount: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const searchLower = args.search?.trim().toLowerCase();
    const matching: Array<
      Doc<"insurancePolicies"> & {
        effectiveStatus: Doc<"insurancePolicies">["status"];
      }
    > = [];
    const policies = ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.organizationId),
      );
    for await (const policy of policies) {
      const effectiveStatus = effectivePolicyStatus(policy, args.now);
      if (args.status && effectiveStatus !== args.status) continue;
      if (args.policyType && policy.policyType !== args.policyType) continue;
      if (
        searchLower &&
        !policy.policyNumber.toLowerCase().includes(searchLower) &&
        !policy.carrier.toLowerCase().includes(searchLower)
      ) {
        continue;
      }
      matching.push({ ...policy, effectiveStatus });
    }

    matching.sort((a, b) => b.createdAt - a.createdAt);

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = Number.isNaN(cursor) ? 0 : cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      matching.length,
    );
    const page = matching.slice(startIndex, endIndex);

    const policiesWithCounts = await Promise.all(
      page.map(async (policy) => {
        let coverageCount = 0;
        for (const status of ["active", "pending"] as const) {
          const coverages = ctx.db
            .query("insuranceCoverages")
            .withIndex("by_policy_and_status", (q) =>
              q.eq("policyId", policy._id).eq("status", status),
            );
          for await (const _coverage of coverages) coverageCount += 1;
        }
        let claimsCount = 0;
        const claims = ctx.db
          .query("insuranceClaims")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id));
        for await (const _claim of claims) claimsCount += 1;
        return {
          _id: policy._id,
          policyNumber: policy.policyNumber,
          carrier: policy.carrier,
          policyType: policy.policyType,
          coverageAmount: policy.coverageAmount,
          currency: policy.currency,
          effectiveDate: policy.effectiveDate,
          expirationDate: policy.expirationDate,
          status: policy.effectiveStatus,
          coverageCount,
          claimsCount,
        };
      }),
    );

    return {
      page: policiesWithCounts,
      isDone: endIndex >= matching.length,
      continueCursor: endIndex.toString(),
    };
  },
});

const POLICY_OPTION_LIMIT = 200;

/**
 * Policies to choose from when adding coverage or a claim, newest first,
 * with their status at `now`. Independent of the policy list filters.
 */
export const listPolicyOptions = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
  },
  returns: v.object({
    policies: v.array(
      v.object({
        _id: v.id("insurancePolicies"),
        policyNumber: v.string(),
        carrier: v.string(),
        currency: v.optional(v.string()),
        effectiveDate: v.number(),
        expirationDate: v.number(),
        status: policyStatusValidator,
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const policies = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.organizationId),
      )
      .order("desc")
      .take(POLICY_OPTION_LIMIT + 1);
    return {
      policies: policies.slice(0, POLICY_OPTION_LIMIT).map((policy) => ({
        _id: policy._id,
        policyNumber: policy.policyNumber,
        carrier: policy.carrier,
        currency: policy.currency,
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate,
        status: effectivePolicyStatus(policy, args.now),
      })),
      truncated: policies.length > POLICY_OPTION_LIMIT,
    };
  },
});

const coverageAppraisalStatusValidator = v.union(
  v.literal("not_applicable"),
  v.literal("currency_not_recorded"),
  v.literal("missing"),
  v.literal("current"),
  v.literal("stale"),
);

const coverageViewValidator = v.object({
  _id: v.id("insuranceCoverages"),
  policyId: v.id("insurancePolicies"),
  policyNumber: v.string(),
  policyCurrency: v.optional(v.string()),
  target: v.union(
    v.object({
      kind: coverageTargetKindValidator,
      id: v.string(),
      label: v.string(),
      reference: v.optional(v.string()),
    }),
    v.null(),
  ),
  recordedTargets: v.array(
    v.object({ kind: coverageTargetKindValidator, id: v.string() }),
  ),
  coveredValue: v.number(),
  currency: v.optional(v.string()),
  start: v.number(),
  end: v.number(),
  status: coverageStatusValidator,
  state: coverageStateValidator,
  appraisalStatus: coverageAppraisalStatusValidator,
  currentAppraisal: v.union(
    v.object({
      appraisalId: v.id("appraisals"),
      value: v.number(),
      currency: v.string(),
      appraisalDate: v.number(),
    }),
    v.null(),
  ),
  splitFromCoverageId: v.optional(v.id("insuranceCoverages")),
  notes: v.optional(v.string()),
});

/**
 * The current insurance valuation that supports an object coverage, in the
 * coverage's currency.
 */
async function coverageAppraisal(
  ctx: ReadCtx,
  coverage: Doc<"insuranceCoverages">,
  target: CoverageTarget | null,
  now: number,
) {
  if (target?.kind !== "object") {
    return {
      appraisalStatus: "not_applicable" as const,
      currentAppraisal: null,
    };
  }
  const currency = normalizeCurrency(coverage.currency);
  if (currency === null) {
    return {
      appraisalStatus: "currency_not_recorded" as const,
      currentAppraisal: null,
    };
  }
  const appraisal = await currentValuationFor(
    ctx,
    target.collectionId,
    "insurance",
    currency,
  );
  if (!appraisal) {
    return { appraisalStatus: "missing" as const, currentAppraisal: null };
  }
  return {
    appraisalStatus:
      appraisalExpiresAt(appraisal, INSURANCE_APPRAISAL_MAX_AGE_MS) < now
        ? ("stale" as const)
        : ("current" as const),
    currentAppraisal: {
      appraisalId: appraisal._id,
      value: appraisal.value,
      currency: appraisal.currency,
      appraisalDate: appraisal.appraisalDate,
    },
  };
}

type CoverageView = Infer<typeof coverageViewValidator>;

async function toCoverageView(
  ctx: ReadCtx,
  coverage: Doc<"insuranceCoverages">,
  policy: Doc<"insurancePolicies"> | null,
  now: number,
): Promise<CoverageView> {
  const target = coverageTarget(coverage);
  const described = target ? await describeTarget(ctx, target) : null;
  const interval = coverageInterval(coverage, {
    effectiveDate: policy?.effectiveDate ?? 0,
    expirationDate: policy?.expirationDate ?? 0,
  });
  return {
    _id: coverage._id,
    policyId: coverage.policyId,
    policyNumber: policy?.policyNumber ?? "",
    policyCurrency: policy?.currency,
    target:
      target && described
        ? {
            kind: target.kind,
            id: targetId(target),
            label: described.label,
            reference: described.reference,
          }
        : null,
    recordedTargets: recordedTargets(coverage).map((entry) => ({
      kind: entry.kind,
      id: targetId(entry),
    })),
    coveredValue: coverage.coveredValue,
    currency: normalizeCurrency(coverage.currency) ?? undefined,
    start: interval.start,
    end: interval.end,
    status: coverage.status,
    state: coverageState(coverage, policy, now),
    ...(await coverageAppraisal(ctx, coverage, target, now)),
    splitFromCoverageId: coverage.splitFromCoverageId,
    notes: coverage.notes,
  };
}

/** Coverages for an organization, or one policy, with their state at `now`. */
export const listCoverages = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
    policyId: v.optional(v.id("insurancePolicies")),
  },
  returns: paginationResultValidator(coverageViewValidator),
  handler: async (ctx, args) => {
    const policyId = args.policyId;
    if (policyId) {
      const policy = await ctx.db.get(policyId);
      if (!policy || policy.organizationId !== ctx.organizationId) {
        throw valuationError("REFERENCE_NOT_FOUND", "Policy not found");
      }
    }
    const result = policyId
      ? await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_policy", (q) => q.eq("policyId", policyId))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", ctx.organizationId),
          )
          .order("desc")
          .paginate(args.paginationOpts);

    const policies = new Map<
      Id<"insurancePolicies">,
      Doc<"insurancePolicies"> | null
    >();
    const page: CoverageView[] = [];
    for (const coverage of result.page) {
      if (!policies.has(coverage.policyId)) {
        const policy = await ctx.db.get(coverage.policyId);
        policies.set(
          coverage.policyId,
          policy?.organizationId === ctx.organizationId ? policy : null,
        );
      }
      page.push(
        await toCoverageView(
          ctx,
          coverage,
          policies.get(coverage.policyId) ?? null,
          args.now,
        ),
      );
    }
    return { ...result, page };
  },
});

export const getPolicy = query({
  args: {
    policyId: v.id("insurancePolicies"),
    now: v.number(),
  },
  returns: v.union(
    v.object({
      _id: v.id("insurancePolicies"),
      organizationId: v.id("organizations"),
      policyNumber: v.string(),
      carrier: v.string(),
      carrierContact: v.optional(v.string()),
      carrierPhone: v.optional(v.string()),
      carrierEmail: v.optional(v.string()),
      policyType: policyTypeValidator,
      coverageAmount: v.number(),
      currency: v.optional(v.string()),
      deductible: v.optional(v.number()),
      perItemLimit: v.optional(v.number()),
      premiumAmount: v.optional(v.number()),
      premiumFrequency: v.optional(premiumFrequencyValidator),
      nextPremiumDue: v.optional(v.number()),
      effectiveDate: v.number(),
      expirationDate: v.number(),
      renewalDate: v.optional(v.number()),
      autoRenew: v.optional(v.boolean()),
      status: policyStatusValidator,
      recordedStatus: policyStatusValidator,
      territory: v.optional(v.string()),
      exclusions: v.optional(v.array(v.string())),
      documentIds: v.optional(v.array(v.id("_storage"))),
      documentUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      coverages: v.array(coverageViewValidator),
      coveragesTruncated: v.boolean(),
      claims: v.array(
        v.object({
          _id: v.id("insuranceClaims"),
          claimNumber: v.string(),
          incidentType: incidentTypeValidator,
          incidentDate: v.number(),
          claimedAmount: v.number(),
          currency: v.optional(v.string()),
          status: claimStatusValidator,
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      return null;
    }

    const [, documentUrls, coverages, claims] = await Promise.all([
      requirePermission(ctx, policy.organizationId, "loans.read"),
      policy.documentIds
        ? Promise.all(policy.documentIds.map((id) => ctx.storage.getUrl(id)))
        : Promise.resolve(undefined),
      ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .take(MAX_POLICY_COVERAGES + 1),
      ctx.db
        .query("insuranceClaims")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .take(MAX_POLICY_CLAIMS),
    ] as const);

    const coverageViews: CoverageView[] = [];
    for (const coverage of coverages.slice(0, MAX_POLICY_COVERAGES)) {
      coverageViews.push(await toCoverageView(ctx, coverage, policy, args.now));
    }

    return {
      _id: policy._id,
      organizationId: policy.organizationId,
      policyNumber: policy.policyNumber,
      carrier: policy.carrier,
      carrierContact: policy.carrierContact,
      carrierPhone: policy.carrierPhone,
      carrierEmail: policy.carrierEmail,
      policyType: policy.policyType,
      coverageAmount: policy.coverageAmount,
      currency: policy.currency,
      deductible: policy.deductible,
      perItemLimit: policy.perItemLimit,
      premiumAmount: policy.premiumAmount,
      premiumFrequency: policy.premiumFrequency,
      nextPremiumDue: policy.nextPremiumDue,
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      renewalDate: policy.renewalDate,
      autoRenew: policy.autoRenew,
      status: effectivePolicyStatus(policy, args.now),
      recordedStatus: policy.status,
      territory: policy.territory,
      exclusions: policy.exclusions,
      documentIds: policy.documentIds,
      documentUrls,
      notes: policy.notes,
      createdBy: policy.createdBy,
      createdAt: policy.createdAt,
      coverages: coverageViews,
      coveragesTruncated: coverages.length > MAX_POLICY_COVERAGES,
      claims: claims.map((claim) => ({
        _id: claim._id,
        claimNumber: claim.claimNumber,
        incidentType: claim.incidentType,
        incidentDate: claim.incidentDate,
        claimedAmount: claim.claimedAmount,
        currency: claim.currency,
        status: claim.status,
      })),
    };
  },
});

/**
 * Insure one object, loan or exhibition under a policy, in the coverage's own
 * currency and for an interval inside the policy period. For objects, the
 * current insurance valuation in that currency is linked when one exists.
 */
export const addCoverage = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    target: coverageTargetValidator,
    coveredValue: v.number(),
    currency: v.string(),
    effectiveDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    requireCurrentAppraisal: v.optional(v.boolean()),
  },
  returns: v.id("insuranceCoverages"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw valuationError("REFERENCE_NOT_FOUND", "Policy not found");
    }
    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const now = Date.now();
    const policyStatus = effectivePolicyStatus(policy, now);
    if (
      policyStatus === "cancelled" ||
      policyStatus === "suspended" ||
      policyStatus === "expired"
    ) {
      throw valuationError(
        "POLICY_NOT_IN_FORCE",
        "Coverage can only be added to a policy that is active or about to start",
      );
    }
    const currency = requireCurrencyCode(args.currency);
    requireAmount(args.coveredValue, "Covered value");
    requireCoveragePeriod(policy, args.effectiveDate, args.expirationDate);
    await requireTargetInOrganization(ctx, args.target, policy.organizationId);

    let appraisalId: Id<"appraisals"> | undefined;
    let appraisalDate: number | undefined;
    if (args.target.kind === "object") {
      const appraisal = await currentValuationFor(
        ctx,
        args.target.collectionId,
        "insurance",
        currency,
      );
      const supportsCover =
        appraisal !== null &&
        appraisalExpiresAt(appraisal, INSURANCE_APPRAISAL_MAX_AGE_MS) >= now;
      if (args.requireCurrentAppraisal && !supportsCover) {
        throw valuationError(
          "CURRENT_APPRAISAL_REQUIRED",
          "A current insurance appraisal in this currency is required",
        );
      }
      if (appraisal && supportsCover) {
        appraisalId = appraisal._id;
        appraisalDate = appraisal.appraisalDate;
      }
    }

    const coverageId = await ctx.db.insert("insuranceCoverages", {
      organizationId: policy.organizationId,
      policyId: args.policyId,
      ...targetFields(args.target),
      coveredValue: args.coveredValue,
      currency,
      effectiveDate: args.effectiveDate,
      expirationDate: args.expirationDate,
      status: "active",
      appraisalId,
      appraisalDate,
      appraisalRequired: args.requireCurrentAppraisal,
      notes: args.notes?.trim() || undefined,
      createdBy: userId,
      createdAt: now,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: policy.organizationId,
      userId,
      action: "created",
      entityType: "insuranceCoverage",
      entityId: coverageId,
      changes: {
        policyId: args.policyId,
        target: { kind: args.target.kind, id: targetId(args.target) },
        coveredValue: args.coveredValue,
        currency,
        effectiveDate: args.effectiveDate,
        expirationDate: args.expirationDate,
      },
    });

    return coverageId;
  },
});

export const removeCoverage = mutation({
  args: {
    coverageId: v.id("insuranceCoverages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const coverage = await ctx.db.get(args.coverageId);
    if (!coverage) {
      throw valuationError("REFERENCE_NOT_FOUND", "Coverage not found");
    }
    await requirePermission(
      ctx,
      coverage.organizationId,
      "organization.manage_settings",
    );
    await ctx.db.patch(args.coverageId, { status: "removed" });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: coverage.organizationId,
      userId,
      action: "removed",
      entityType: "insuranceCoverage",
      entityId: args.coverageId,
      changes: { status: "removed" },
    });

    return null;
  },
});

const objectCoverageValidator = v.object({
  _id: v.id("insuranceCoverages"),
  policyId: v.id("insurancePolicies"),
  policyNumber: v.string(),
  carrier: v.string(),
  coveredValue: v.number(),
  currency: v.optional(v.string()),
  needsTargetReview: v.boolean(),
  effectiveDate: v.optional(v.number()),
  expirationDate: v.optional(v.number()),
  policyExpirationDate: v.number(),
  status: coverageStatusValidator,
});

export const getCoverageForObject = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(objectCoverageValidator),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    const [, coverages] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "loans.read"),
      ctx.db
        .query("insuranceCoverages")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .order("desc")
        .take(MAX_POLICY_COVERAGES),
    ] as const);

    const results: Array<Infer<typeof objectCoverageValidator>> = [];
    for (const coverage of coverages) {
      if (coverage.status !== "active") continue;
      const target = coverageTarget(coverage);
      if (target && target.kind !== "object") continue;
      const policy = await ctx.db.get(coverage.policyId);
      results.push({
        _id: coverage._id,
        policyId: coverage.policyId,
        policyNumber: policy?.policyNumber ?? "",
        carrier: policy?.carrier ?? "",
        coveredValue: coverage.coveredValue,
        currency: normalizeCurrency(coverage.currency) ?? undefined,
        needsTargetReview: target === null,
        effectiveDate: coverage.effectiveDate,
        expirationDate: coverage.expirationDate,
        policyExpirationDate: policy?.expirationDate ?? 0,
        status: coverage.status,
      });
    }
    return results;
  },
});

const TARGET_OPTION_LIMIT = 100;

/** Recent loans or exhibitions that a coverage can name as its target. */
export const listCoverageTargetOptions = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    kind: v.union(v.literal("loan"), v.literal("exhibition")),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      reference: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const options: Array<{ id: string; label: string; reference?: string }> =
      [];
    if (args.kind === "loan") {
      const loans = await ctx.db
        .query("loans")
        .withIndex("by_organization_and_startDate", (q) =>
          q.eq("organizationId", ctx.organizationId),
        )
        .order("desc")
        .take(TARGET_OPTION_LIMIT);
      for (const loan of loans) {
        if (loan.status === "cancelled") continue;
        options.push({
          id: loan._id,
          label: loan.lenderBorrowerName,
          reference: loan.loanNumber,
        });
      }
      return options;
    }
    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization_and_startDate", (q) =>
        q.eq("organizationId", ctx.organizationId),
      )
      .order("desc")
      .take(TARGET_OPTION_LIMIT);
    for (const exhibition of exhibitions) {
      if (exhibition.status === "rejected") continue;
      options.push({ id: exhibition._id, label: exhibition.title });
    }
    return options;
  },
});

export const createClaim = mutation({
  args: {
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),
    collectionIds: v.optional(v.array(v.id("collections"))),
    exhibitionId: v.optional(v.id("exhibitions")),
    loanId: v.optional(v.id("loans")),
    incidentDate: v.number(),
    incidentLocation: v.optional(v.string()),
    incidentType: incidentTypeValidator,
    incidentDescription: v.string(),
    claimedAmount: v.number(),
    currency: v.string(),
    documentIds: v.optional(v.array(v.id("_storage"))),
    photoIds: v.optional(v.array(v.id("_storage"))),
    internalNotes: v.optional(v.string()),
  },
  returns: v.id("insuranceClaims"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const [, policy] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.get(args.policyId),
    ] as const);
    if (!policy || policy.organizationId !== args.organizationId) {
      throw valuationError(
        "REFERENCE_NOT_FOUND",
        "Policy not found or belongs to different org",
      );
    }
    const currency = requireCurrencyCode(args.currency);
    requireAmount(args.claimedAmount, "Claimed amount");
    const targets: CoverageTarget[] = [
      ...(args.collectionIds ?? []).map((collectionId) => ({
        kind: "object" as const,
        collectionId,
      })),
      ...(args.loanId ? [{ kind: "loan" as const, loanId: args.loanId }] : []),
      ...(args.exhibitionId
        ? [{ kind: "exhibition" as const, exhibitionId: args.exhibitionId }]
        : []),
    ];
    for (const target of targets) {
      await requireTargetInOrganization(ctx, target, args.organizationId);
    }

    const claimNumber = await generateNextClaimNumber(ctx, args.organizationId);

    const claimId = await ctx.db.insert("insuranceClaims", {
      organizationId: args.organizationId,
      policyId: args.policyId,
      claimNumber,
      collectionIds: args.collectionIds,
      exhibitionId: args.exhibitionId,
      loanId: args.loanId,
      incidentDate: args.incidentDate,
      incidentLocation: args.incidentLocation,
      incidentType: args.incidentType,
      incidentDescription: args.incidentDescription,
      claimedAmount: args.claimedAmount,
      currency,
      status: "draft",
      reportedDate: Date.now(),
      documentIds: args.documentIds,
      photoIds: args.photoIds,
      internalNotes: args.internalNotes,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "insuranceClaim",
      entityId: claimId,
      changes: {
        claimNumber,
        incidentType: args.incidentType,
        claimedAmount: args.claimedAmount,
        currency,
      },
    });

    return claimId;
  },
});

export const updateClaim = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    incidentLocation: v.optional(v.string()),
    incidentDescription: v.optional(v.string()),
    claimedAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    assessedAmount: v.optional(v.number()),
    settledAmount: v.optional(v.number()),
    deductibleApplied: v.optional(v.number()),
    status: v.optional(claimStatusValidator),
    adjusterName: v.optional(v.string()),
    adjusterPhone: v.optional(v.string()),
    adjusterEmail: v.optional(v.string()),
    adjusterNotes: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    payoutMethod: v.optional(payoutMethodValidator),
    payoutDate: v.optional(v.number()),
    payoutReference: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, claim] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.claimId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!claim) {
      throw new Error("Claim not found");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const { claimId, status, ...otherUpdates } = args;
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(otherUpdates).filter(([_, v]) => v !== undefined),
    );
    if (args.currency !== undefined) {
      updates.currency = requireCurrencyCode(args.currency);
    }
    requireAmount(args.claimedAmount, "Claimed amount");
    requireAmount(args.assessedAmount, "Assessed amount");
    requireAmount(args.settledAmount, "Settled amount");
    requireAmount(args.deductibleApplied, "Deductible applied");

    if (status) {
      updates.status = status;

      if (status === "submitted" && claim.status === "draft") {
        updates.submittedDate = Date.now();
      }

      if (status === "under_review" && !claim.reviewStartDate) {
        updates.reviewStartDate = Date.now();
      }

      if (
        (status === "approved" || status === "denied") &&
        !claim.decisionDate
      ) {
        updates.decisionDate = Date.now();
      }

      if (status === "settled" && !claim.settlementDate) {
        updates.settlementDate = Date.now();
      }
    }

    updates.lastModifiedBy = userId;
    updates.lastModifiedAt = Date.now();

    await Promise.all([
      ctx.db.patch(args.claimId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: claim.organizationId,
        userId,
        action: "updated",
        entityType: "insuranceClaim",
        entityId: args.claimId,
        changes: updates,
      }),
    ]);

    return null;
  },
});

export const listClaims = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(claimStatusValidator),
    policyId: v.optional(v.id("insurancePolicies")),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("insuranceClaims"),
        claimNumber: v.string(),
        policyNumber: v.string(),
        carrier: v.string(),
        incidentType: incidentTypeValidator,
        incidentDate: v.number(),
        claimedAmount: v.number(),
        currency: v.optional(v.string()),
        settledAmount: v.optional(v.number()),
        status: claimStatusValidator,
        reportedDate: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    let allClaims: Array<Doc<"insuranceClaims">> = [];

    const claimsQuery = args.status
      ? ctx.db
          .query("insuranceClaims")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", ctx.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("insuranceClaims")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", ctx.organizationId),
          );

    for await (const claim of claimsQuery) {
      allClaims.push(claim);
    }

    if (args.policyId) {
      allClaims = allClaims.filter((c) => c.policyId === args.policyId);
    }

    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      allClaims = allClaims.filter(
        (c) =>
          c.claimNumber.toLowerCase().includes(searchLower) ||
          c.incidentDescription.toLowerCase().includes(searchLower),
      );
    }

    allClaims.sort((a, b) => b.reportedDate - a.reportedDate);

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allClaims.length,
    );
    const page = allClaims.slice(startIndex, endIndex);

    const claimsWithPolicy = await Promise.all(
      page.map(async (claim) => {
        const policy = await ctx.db.get(claim.policyId);
        return {
          _id: claim._id,
          claimNumber: claim.claimNumber,
          policyNumber: policy?.policyNumber ?? "",
          carrier: policy?.carrier ?? "",
          incidentType: claim.incidentType,
          incidentDate: claim.incidentDate,
          claimedAmount: claim.claimedAmount,
          currency: claim.currency,
          settledAmount: claim.settledAmount,
          status: claim.status,
          reportedDate: claim.reportedDate,
        };
      }),
    );

    return {
      page: claimsWithPolicy,
      isDone: endIndex >= allClaims.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const getClaim = query({
  args: {
    claimId: v.id("insuranceClaims"),
  },
  returns: v.union(
    v.object({
      _id: v.id("insuranceClaims"),
      organizationId: v.id("organizations"),
      policyId: v.id("insurancePolicies"),
      policyNumber: v.string(),
      carrier: v.string(),
      claimNumber: v.string(),
      collectionIds: v.optional(v.array(v.id("collections"))),
      collections: v.optional(
        v.array(
          v.object({
            _id: v.id("collections"),
            title: v.string(),
            accessionNumber: v.string(),
          }),
        ),
      ),
      exhibitionId: v.optional(v.id("exhibitions")),
      exhibitionTitle: v.optional(v.string()),
      loanId: v.optional(v.id("loans")),
      loanNumber: v.optional(v.string()),
      incidentDate: v.number(),
      incidentLocation: v.optional(v.string()),
      incidentType: incidentTypeValidator,
      incidentDescription: v.string(),
      claimedAmount: v.number(),
      currency: v.optional(v.string()),
      assessedAmount: v.optional(v.number()),
      settledAmount: v.optional(v.number()),
      deductibleApplied: v.optional(v.number()),
      status: claimStatusValidator,
      reportedDate: v.number(),
      submittedDate: v.optional(v.number()),
      reviewStartDate: v.optional(v.number()),
      decisionDate: v.optional(v.number()),
      settlementDate: v.optional(v.number()),
      adjusterName: v.optional(v.string()),
      adjusterPhone: v.optional(v.string()),
      adjusterEmail: v.optional(v.string()),
      adjusterNotes: v.optional(v.string()),
      documentIds: v.optional(v.array(v.id("_storage"))),
      documentUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      photoIds: v.optional(v.array(v.id("_storage"))),
      photoUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      denialReason: v.optional(v.string()),
      payoutMethod: v.optional(payoutMethodValidator),
      payoutDate: v.optional(v.number()),
      payoutReference: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      return null;
    }

    await requirePermission(ctx, claim.organizationId, "loans.read");

    const policy = await ctx.db.get(claim.policyId);

    let collections:
      | Array<{
          _id: Id<"collections">;
          title: string;
          accessionNumber: string;
        }>
      | undefined;
    if (claim.collectionIds && claim.collectionIds.length > 0) {
      const collectionDocs = await Promise.all(
        claim.collectionIds.map((id) => ctx.db.get(id)),
      );
      collections = collectionDocs.flatMap((collection) =>
        collection === null
          ? []
          : [
              {
                _id: collection._id,
                title: collection.title,
                accessionNumber: collection.accessionNumber,
              },
            ],
      );
    }

    const [exhibition, loan] = await Promise.all([
      claim.exhibitionId ? ctx.db.get(claim.exhibitionId) : null,
      claim.loanId ? ctx.db.get(claim.loanId) : null,
    ]);
    const exhibitionTitle = exhibition?.title;
    const loanNumber = loan?.loanNumber;

    const documentUrls = claim.documentIds
      ? await Promise.all(claim.documentIds.map((id) => ctx.storage.getUrl(id)))
      : undefined;

    const photoUrls = claim.photoIds
      ? await Promise.all(claim.photoIds.map((id) => ctx.storage.getUrl(id)))
      : undefined;

    return {
      _id: claim._id,
      organizationId: claim.organizationId,
      policyId: claim.policyId,
      policyNumber: policy?.policyNumber ?? "",
      carrier: policy?.carrier ?? "",
      claimNumber: claim.claimNumber,
      collectionIds: claim.collectionIds,
      collections,
      exhibitionId: claim.exhibitionId,
      exhibitionTitle,
      loanId: claim.loanId,
      loanNumber,
      incidentDate: claim.incidentDate,
      incidentLocation: claim.incidentLocation,
      incidentType: claim.incidentType,
      incidentDescription: claim.incidentDescription,
      claimedAmount: claim.claimedAmount,
      currency: claim.currency,
      assessedAmount: claim.assessedAmount,
      settledAmount: claim.settledAmount,
      deductibleApplied: claim.deductibleApplied,
      status: claim.status,
      reportedDate: claim.reportedDate,
      submittedDate: claim.submittedDate,
      reviewStartDate: claim.reviewStartDate,
      decisionDate: claim.decisionDate,
      settlementDate: claim.settlementDate,
      adjusterName: claim.adjusterName,
      adjusterPhone: claim.adjusterPhone,
      adjusterEmail: claim.adjusterEmail,
      adjusterNotes: claim.adjusterNotes,
      documentIds: claim.documentIds,
      documentUrls,
      photoIds: claim.photoIds,
      photoUrls,
      denialReason: claim.denialReason,
      payoutMethod: claim.payoutMethod,
      payoutDate: claim.payoutDate,
      payoutReference: claim.payoutReference,
      internalNotes: claim.internalNotes,
      createdBy: claim.createdBy,
      createdAt: claim.createdAt,
    };
  },
});

const expiringPolicyValidator = v.object({
  _id: v.id("insurancePolicies"),
  policyNumber: v.string(),
  carrier: v.string(),
  currency: v.optional(v.string()),
  expirationDate: v.number(),
  daysUntilExpiry: v.number(),
  coverageCount: v.number(),
  coveredValue: currencyTotalsValidator,
});

export const getExpiringPolicies = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
    daysAhead: v.optional(v.number()),
  },
  returns: v.array(expiringPolicyValidator),
  handler: async (ctx, args) => {
    const days = Math.min(Math.max(args.daysAhead ?? 30, 0), 366);
    const now = args.now;
    const futureDate = now + days * DAY_MS;

    const enrichedPolicies: Array<Infer<typeof expiringPolicyValidator>> = [];
    const expiringQuery = ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization_and_expirationDate", (q) =>
        q
          .eq("organizationId", ctx.organizationId)
          .gte("expirationDate", now)
          .lte("expirationDate", futureDate),
      );

    for await (const policy of expiringQuery) {
      if (effectivePolicyStatus(policy, now) !== "active") {
        continue;
      }

      let coverageCount = 0;
      const coveredValue = new CurrencyTotalsBuilder();
      const coverages = ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy_and_status", (q) =>
          q.eq("policyId", policy._id).eq("status", "active"),
        );
      for await (const coverage of coverages) {
        if (coverageState(coverage, policy, now) !== "in_force") continue;
        coverageCount += 1;
        coveredValue.add(coverage.currency, coverage.coveredValue);
      }

      enrichedPolicies.push({
        _id: policy._id,
        policyNumber: policy.policyNumber,
        carrier: policy.carrier,
        currency: policy.currency,
        expirationDate: policy.expirationDate,
        daysUntilExpiry: Math.ceil((policy.expirationDate - now) / DAY_MS),
        coverageCount,
        coveredValue: coveredValue.build(),
      });
    }

    return enrichedPolicies.sort(
      (a, b) => a.daysUntilExpiry - b.daysUntilExpiry,
    );
  },
});

/**
 * Objects in the institution's care without cover in force at `now`, whether
 * directly or as part of a covered loan or exhibition.
 */
export const getUncoveredObjects = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        status: v.string(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { coveredObjectIds } = await collectInForceCoverage(
      ctx,
      ctx.organizationId,
      args.now,
    );

    const uncoveredObjects: Array<{
      _id: Id<"collections">;
      title: string;
      accessionNumber: string;
      status: string;
    }> = [];
    for (const status of ["active", "loaned"] as const) {
      const objects = ctx.db
        .query("collections")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", ctx.organizationId).eq("status", status),
        );
      for await (const obj of objects) {
        if (!coveredObjectIds.has(obj._id)) {
          uncoveredObjects.push({
            _id: obj._id,
            title: obj.title,
            accessionNumber: obj.accessionNumber,
            status: obj.status,
          });
        }
      }
    }

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = Number.isNaN(cursor) ? 0 : cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      uncoveredObjects.length,
    );
    const page = uncoveredObjects.slice(startIndex, endIndex);

    return {
      page,
      isDone: endIndex >= uncoveredObjects.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const getInsuranceStats = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
  },
  returns: insuranceStatsValidator,
  handler: async (ctx, args) => {
    return await computeInsuranceStats(ctx, ctx.organizationId, args.now);
  },
});

export const getCoverageAlerts = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
  },
  returns: coverageAlertsValidator,
  handler: async (ctx, args) => {
    return await computeCoverageAlerts(ctx, ctx.organizationId, args.now);
  },
});

export const uploadPolicyDocument = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, policy] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.policyId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!policy) {
      throw new Error("Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const documentIds = policy.documentIds ?? [];
    documentIds.push(args.storageId);

    await ctx.db.patch(args.policyId, {
      documentIds,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const uploadClaimDocument = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    storageId: v.id("_storage"),
    documentType: v.union(v.literal("document"), v.literal("photo")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, claim] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.claimId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!claim) {
      throw new Error("Claim not found");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    if (args.documentType === "document") {
      const documentIds = claim.documentIds ?? [];
      documentIds.push(args.storageId);
      await ctx.db.patch(args.claimId, {
        documentIds,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    } else {
      const photoIds = claim.photoIds ?? [];
      photoIds.push(args.storageId);
      await ctx.db.patch(args.claimId, {
        photoIds,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    }

    return null;
  },
});

const EXPIRY_ALERT_DAYS = new Set([7, 14, 30]);
const EXPIRY_ALERT_SCAN_LIMIT = 500;

function describeCoveredValue(policyCoverages: Doc<"insuranceCoverages">[]) {
  const totals = new CurrencyTotalsBuilder();
  for (const coverage of policyCoverages) {
    totals.add(coverage.currency, coverage.coveredValue);
  }
  return totals
    .build()
    .byCurrency.map(
      (entry) => `${entry.currency} ${entry.total.toLocaleString("en-US")}`,
    )
    .join("; ");
}

/**
 * Daily: brings recorded policy and coverage statuses in line with their
 * dates, then notifies coordinators about policies expiring in 7, 14 or 30
 * days. Covered values are reported per currency.
 */
export const checkExpiringPoliciesInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.insurance.reconcileInsuranceStatuses,
      {},
    );

    const now = Date.now();
    const expiring = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_expirationDate", (q) =>
        q.gt("expirationDate", now).lte("expirationDate", now + 31 * DAY_MS),
      )
      .take(EXPIRY_ALERT_SCAN_LIMIT);

    for (const policy of expiring) {
      if (effectivePolicyStatus(policy, now) !== "active") continue;
      const daysUntilExpiry = Math.ceil((policy.expirationDate - now) / DAY_MS);
      if (!EXPIRY_ALERT_DAYS.has(daysUntilExpiry)) continue;

      const coverages = (
        await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_policy_and_status", (q) =>
            q.eq("policyId", policy._id).eq("status", "active"),
          )
          .take(MAX_POLICY_COVERAGES)
      ).filter(
        (coverage) => coverageState(coverage, policy, now) === "in_force",
      );
      const values = describeCoveredValue(coverages);
      const message = values
        ? `Policy ${policy.policyNumber} (${policy.carrier}) covering ${coverages.length} items valued at ${values} expires in ${daysUntilExpiry} days.`
        : `Policy ${policy.policyNumber} (${policy.carrier}) covering ${coverages.length} items expires in ${daysUntilExpiry} days.`;

      const coordinatorUserIds = await getUserIdsWithPermission(
        ctx,
        policy.organizationId,
        "organization.manage_settings",
      );
      for (const coordinatorUserId of coordinatorUserIds) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: policy.organizationId,
          userId: coordinatorUserId,
          type: "insurance_expiry",
          title: `Insurance Policy Expiring in ${daysUntilExpiry} Days`,
          message,
          relatedEntityType: "insurancePolicy",
          relatedEntityId: policy._id,
        });
      }
    }

    return null;
  },
});

const RECONCILE_BATCH = 100;

/**
 * Moves recorded statuses to match dates: policies past their expiration
 * become expired together with their coverages, policies whose period has
 * started become active, and coverages past their own end become expired.
 * Bounded per run; reschedules itself until nothing is left.
 */
export const reconcileInsuranceStatuses = internalMutation({
  args: {},
  returns: v.object({
    policiesExpired: v.number(),
    policiesActivated: v.number(),
    coveragesExpired: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let budget = RECONCILE_BATCH;
    let policiesExpired = 0;
    let policiesActivated = 0;
    let coveragesExpired = 0;
    let hasMore = false;

    for (const status of ["active", "pending"] as const) {
      const overdue = await ctx.db
        .query("insurancePolicies")
        .withIndex("by_status_and_expirationDate", (q) =>
          q.eq("status", status).lt("expirationDate", now),
        )
        .take(budget + 1);
      if (overdue.length > budget) hasMore = true;
      for (const policy of overdue.slice(0, budget)) {
        let policyDone = true;
        for (const coverageStatus of ["active", "pending"] as const) {
          const coverages = await ctx.db
            .query("insuranceCoverages")
            .withIndex("by_policy_and_status", (q) =>
              q.eq("policyId", policy._id).eq("status", coverageStatus),
            )
            .take(budget + 1);
          if (coverages.length > budget) policyDone = false;
          for (const coverage of coverages.slice(0, budget)) {
            await ctx.db.patch(coverage._id, { status: "expired" });
            coveragesExpired += 1;
            budget -= 1;
          }
        }
        if (!policyDone || budget <= 0) {
          hasMore = true;
          break;
        }
        await ctx.db.patch(policy._id, {
          status: "expired",
          lastModifiedAt: now,
        });
        policiesExpired += 1;
        budget -= 1;
      }
      if (budget <= 0) break;
    }

    if (budget > 0) {
      const started = await ctx.db
        .query("insurancePolicies")
        .withIndex("by_status_and_effectiveDate", (q) =>
          q.eq("status", "pending").lte("effectiveDate", now),
        )
        .take(budget + 1);
      if (started.length > budget) hasMore = true;
      for (const policy of started.slice(0, budget)) {
        if (policy.expirationDate < now) continue;
        await ctx.db.patch(policy._id, {
          status: "active",
          lastModifiedAt: now,
        });
        policiesActivated += 1;
        budget -= 1;
      }
    }

    if (budget > 0) {
      const ended = await ctx.db
        .query("insuranceCoverages")
        .withIndex("by_status_and_expirationDate", (q) =>
          q
            .eq("status", "active")
            .gt("expirationDate", 0)
            .lt("expirationDate", now),
        )
        .take(budget + 1);
      if (ended.length > budget) hasMore = true;
      for (const coverage of ended.slice(0, budget)) {
        await ctx.db.patch(coverage._id, { status: "expired" });
        coveragesExpired += 1;
        budget -= 1;
      }
    }

    if (hasMore || budget <= 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.insurance.reconcileInsuranceStatuses,
        {},
      );
    }
    return {
      policiesExpired,
      policiesActivated,
      coveragesExpired,
      hasMore: hasMore || budget <= 0,
    };
  },
});

// ============================================================================
// Dispute Workflow
// ============================================================================

const disputeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_review"),
  v.literal("resolved"),
  v.literal("escalated"),
);

/**
 * Open a dispute on a claim
 */
export const openDispute = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, claim] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.claimId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (
      claim.status !== "denied" &&
      claim.status !== "approved" &&
      claim.status !== "settled"
    ) {
      throw new Error("Can only dispute claims that have been decided");
    }

    if (claim.isDisputed) {
      throw new Error("Claim already has an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    await Promise.all([
      ctx.db.patch(args.claimId, {
        status: "appealed",
        isDisputed: true,
        disputeReason: args.reason,
        disputeDate: Date.now(),
        disputeStatus: "pending",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: claim.organizationId,
        userId,
        action: "opened_dispute",
        entityType: "insuranceClaim",
        entityId: args.claimId,
        changes: { reason: args.reason },
      }),
    ] as const);

    return null;
  },
});

/**
 * Update dispute status
 */
export const updateDisputeStatus = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    disputeStatus: disputeStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, claim] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.claimId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (!claim.isDisputed) {
      throw new Error("Claim does not have an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const updates: Record<string, unknown> = {
      disputeStatus: args.disputeStatus,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    if (args.notes) {
      updates.internalNotes = claim.internalNotes
        ? `${claim.internalNotes}\n\n[${new Date().toISOString()}] Dispute update: ${args.notes}`
        : `[${new Date().toISOString()}] Dispute update: ${args.notes}`;
    }

    await Promise.all([
      ctx.db.patch(args.claimId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: claim.organizationId,
        userId,
        action: "updated_dispute",
        entityType: "insuranceClaim",
        entityId: args.claimId,
        changes: { disputeStatus: args.disputeStatus },
      }),
    ]);

    return null;
  },
});

/**
 * Resolve a dispute
 */
export const resolveDispute = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    resolution: v.string(),
    newStatus: v.optional(claimStatusValidator),
    settledAmount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, claim] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.claimId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (!claim.isDisputed) {
      throw new Error("Claim does not have an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const now = Date.now();
    const updates: Record<string, unknown> = {
      disputeStatus: "resolved",
      disputeResolution: args.resolution,
      disputeResolvedDate: now,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    };

    if (args.newStatus) {
      updates.status = args.newStatus;
      if (args.newStatus === "settled") {
        updates.settlementDate = now;
      }
    }

    if (args.settledAmount !== undefined) {
      updates.settledAmount = args.settledAmount;
    }

    await Promise.all([
      ctx.db.patch(args.claimId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: claim.organizationId,
        userId,
        action: "resolved_dispute",
        entityType: "insuranceClaim",
        entityId: args.claimId,
        changes: {
          resolution: args.resolution,
          newStatus: args.newStatus,
          settledAmount: args.settledAmount,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Upload dispute documents
 */
export const uploadDisputeDocument = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, claim] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.claimId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (!claim.isDisputed) {
      throw new Error("Claim does not have an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const documentIds = claim.disputeDocumentIds ?? [];
    documentIds.push(args.storageId);

    await ctx.db.patch(args.claimId, {
      disputeDocumentIds: documentIds,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

// ============================================================================
// Auto-Claim on Transit Damage
// ============================================================================

/** In-force object coverage for one object at `now`, if any. */
async function inForceObjectCoverage(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
  now: number,
) {
  const coverages = await ctx.db
    .query("insuranceCoverages")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .take(MAX_POLICY_COVERAGES);
  for (const coverage of coverages) {
    if (coverage.organizationId !== organizationId) continue;
    const target = coverageTarget(coverage);
    if (target?.kind !== "object") continue;
    const policy = await ctx.db.get(coverage.policyId);
    if (coverageState(coverage, policy, now) === "in_force") return coverage;
  }
  return null;
}

/**
 * Create auto-claim draft for transit damage. The claimed amount is the sum of
 * the objects' in-force cover when it is recorded in one currency; otherwise
 * staff enter the amount.
 */
export const createAutoClaimForTransitDamage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    loanId: v.id("loans"),
    collectionIds: v.array(v.id("collections")),
    incidentDescription: v.string(),
    conditionDisputeId: v.optional(v.id("conditionDisputes")),
    actorUserId: v.id("users"),
  },
  returns: v.union(v.id("insuranceClaims"), v.null()),
  handler: async (ctx, args) => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .take(MAX_POLICY_CLAIMS);
    const policy = candidates.find(
      (candidate) =>
        (candidate.policyType === "transit" ||
          candidate.policyType === "loan" ||
          candidate.policyType === "blanket") &&
        effectivePolicyStatus(candidate, now) === "active",
    );
    if (!policy) {
      return null;
    }

    const covered = new CurrencyTotalsBuilder();
    for (const collectionId of args.collectionIds) {
      const coverage = await inForceObjectCoverage(
        ctx,
        args.organizationId,
        collectionId,
        now,
      );
      if (coverage) covered.add(coverage.currency, coverage.coveredValue);
    }
    const totals = covered.build();
    const single =
      totals.byCurrency.length === 1 && totals.currencyNotRecordedCount === 0
        ? totals.byCurrency[0]
        : undefined;
    const mixed =
      totals.byCurrency.length > 1 || totals.currencyNotRecordedCount > 0;

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q
          .eq("userId", args.actorUserId)
          .eq("organizationId", args.organizationId),
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this organization");
    }

    const claimNumber = await generateNextClaimNumber(ctx, args.organizationId);

    const [claimId, coordinatorUserIds] = await Promise.all([
      ctx.db.insert("insuranceClaims", {
        organizationId: args.organizationId,
        policyId: policy._id,
        claimNumber,
        collectionIds: args.collectionIds,
        loanId: args.loanId,
        incidentDate: now,
        incidentType: "transit",
        incidentDescription: args.incidentDescription,
        claimedAmount: single?.total ?? 0,
        currency: single?.currency ?? policy.currency,
        status: "draft",
        reportedDate: now,
        isAutoClaim: true,
        autoClaimSource: "loan_return_damage",
        conditionDisputeId: args.conditionDisputeId,
        internalNotes: mixed
          ? "Auto-generated claim based on condition change detected during loan return. Covered values are recorded in more than one currency or without a currency; enter the claimed amount."
          : "Auto-generated claim based on condition change detected during loan return.",
        createdBy: args.actorUserId,
        createdAt: now,
      }),
      getUserIdsWithPermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
    ]);

    await Promise.all(
      coordinatorUserIds.map((userId) =>
        ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: args.organizationId,
          userId,
          type: "insurance_auto_claim",
          title: "Auto-Generated Insurance Claim",
          message: `A draft insurance claim (${claimNumber}) has been created for transit damage detected during loan return. Please review and submit.`,
          relatedEntityType: "insuranceClaim",
          relatedEntityId: claimId,
        }),
      ),
    );

    return claimId;
  },
});

// ============================================================================
// Appraisal Enforcement
// ============================================================================

/**
 * Link an appraisal to an object coverage. The appraisal must belong to the
 * covered object in the same organization, must not be superseded, and must
 * be in the coverage's currency.
 */
export const linkAppraisalToCoverage = mutation({
  args: {
    coverageId: v.id("insuranceCoverages"),
    appraisalId: v.id("appraisals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const coverage = await ctx.db.get(args.coverageId);
    if (!coverage) {
      throw valuationError("REFERENCE_NOT_FOUND", "Coverage not found");
    }

    await requirePermission(
      ctx,
      coverage.organizationId,
      "organization.manage_settings",
    );

    const appraisal = await ctx.db.get(args.appraisalId);
    const target = coverageTarget(coverage);
    if (
      !appraisal ||
      appraisal.organizationId !== coverage.organizationId ||
      target?.kind !== "object" ||
      appraisal.collectionId !== target.collectionId
    ) {
      throw valuationError(
        "APPRAISAL_NOT_FOR_COVERED_OBJECT",
        "The appraisal does not belong to the covered object",
      );
    }
    if (appraisal.supersededBy !== undefined) {
      throw valuationError(
        "APPRAISAL_SUPERSEDED",
        "Superseded appraisals stay in the history; link the superseding appraisal",
      );
    }
    const coverageCurrency = normalizeCurrency(coverage.currency);
    if (
      coverageCurrency !== null &&
      normalizeCurrency(appraisal.currency) !== coverageCurrency
    ) {
      throw valuationError(
        "APPRAISAL_CURRENCY_MISMATCH",
        "The appraisal is recorded in a different currency from the coverage",
      );
    }

    await ctx.db.patch(args.coverageId, {
      appraisalId: args.appraisalId,
      appraisalDate: appraisal.appraisalDate,
      appraisalWarning: undefined,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: coverage.organizationId,
      userId,
      action: "linked_appraisal",
      entityType: "insuranceCoverage",
      entityId: args.coverageId,
      changes: { appraisalId: args.appraisalId },
    });

    return null;
  },
});

/**
 * Check the current insurance valuation for an object, optionally in one
 * currency. Valuations over two years old are flagged for renewal; over three
 * years old, or past `validUntil`, they no longer support coverage.
 */
export const checkAppraisalForCoverage = query({
  args: {
    collectionId: v.id("collections"),
    now: v.number(),
    currency: v.optional(v.string()),
  },
  returns: v.object({
    hasAppraisal: v.boolean(),
    appraisalValid: v.boolean(),
    appraisalId: v.optional(v.id("appraisals")),
    appraisalDate: v.optional(v.number()),
    appraisalValue: v.optional(v.number()),
    appraisalCurrency: v.optional(v.string()),
    appraisalAgeDays: v.optional(v.number()),
    warning: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const missingCollection = {
      hasAppraisal: false,
      appraisalValid: false,
      warning: "Collection not found",
    };

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return missingCollection;
    }

    try {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.read",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return missingCollection;
      }
      throw error;
    }

    const current = await currentValuationFor(
      ctx,
      args.collectionId,
      "insurance",
      args.currency,
    );
    if (!current) {
      return {
        hasAppraisal: false,
        appraisalValid: false,
        warning: "No appraisal on file",
      };
    }

    const ageDays = appraisalAgeDays(current, args.now);
    const pastValidUntil =
      current.validUntil !== undefined && current.validUntil < args.now;
    const appraisalValid =
      appraisalExpiresAt(current, INSURANCE_APPRAISAL_MAX_AGE_MS) >= args.now;

    let warning: string | undefined;
    if (!appraisalValid) {
      warning = pastValidUntil
        ? "Appraisal is past its valid-until date"
        : `Appraisal is ${Math.floor(ageDays / 365)} years old and may be stale`;
    } else if (appraisalExpiresAt(current, VALUATION_MAX_AGE_MS) < args.now) {
      warning = "Appraisal is over 2 years old and should be updated soon";
    }

    return {
      hasAppraisal: true,
      appraisalValid,
      appraisalId: current._id,
      appraisalDate: current.appraisalDate,
      appraisalValue: current.value,
      appraisalCurrency: current.currency,
      appraisalAgeDays: ageDays,
      warning,
    };
  },
});

/**
 * Object coverages in force whose current insurance valuation, in the
 * coverage's currency, is missing or older than the allowed age.
 */
const staleCoverageValidator = v.object({
  _id: v.id("insuranceCoverages"),
  policyId: v.id("insurancePolicies"),
  policyNumber: v.string(),
  collectionId: v.id("collections"),
  collectionTitle: v.optional(v.string()),
  coveredValue: v.number(),
  currency: v.optional(v.string()),
  appraisalId: v.optional(v.id("appraisals")),
  appraisalDate: v.optional(v.number()),
  appraisalAgeDays: v.optional(v.number()),
  issue: v.union(
    v.literal("missing"),
    v.literal("stale"),
    v.literal("currency_not_recorded"),
  ),
});

export const getCoveragesWithStaleAppraisals = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
    appraisalMaxAgeDays: v.optional(v.number()),
  },
  returns: v.array(staleCoverageValidator),
  handler: async (ctx, args) => {
    const maxAgeMs =
      args.appraisalMaxAgeDays !== undefined
        ? Math.max(args.appraisalMaxAgeDays, 0) * DAY_MS
        : INSURANCE_APPRAISAL_MAX_AGE_MS;
    const results: Array<Infer<typeof staleCoverageValidator>> = [];
    const policies = new Map<
      Id<"insurancePolicies">,
      Doc<"insurancePolicies"> | null
    >();

    const activeCoverages = ctx.db
      .query("insuranceCoverages")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", ctx.organizationId).eq("status", "active"),
      );
    for await (const coverage of activeCoverages) {
      const target = coverageTarget(coverage);
      if (target?.kind !== "object") continue;
      if (!policies.has(coverage.policyId)) {
        policies.set(coverage.policyId, await ctx.db.get(coverage.policyId));
      }
      const policy = policies.get(coverage.policyId) ?? null;
      if (coverageState(coverage, policy, args.now) !== "in_force") continue;

      const collection = await ctx.db.get(target.collectionId);
      const base = {
        _id: coverage._id,
        policyId: coverage.policyId,
        policyNumber: policy?.policyNumber ?? "",
        collectionId: target.collectionId,
        collectionTitle: collection?.title,
        coveredValue: coverage.coveredValue,
        currency: normalizeCurrency(coverage.currency) ?? undefined,
      };
      if (base.currency === undefined) {
        results.push({ ...base, issue: "currency_not_recorded" as const });
        continue;
      }
      const appraisal = await currentValuationFor(
        ctx,
        target.collectionId,
        "insurance",
        base.currency,
      );
      if (!appraisal) {
        results.push({ ...base, issue: "missing" as const });
        continue;
      }
      if (appraisalExpiresAt(appraisal, maxAgeMs) < args.now) {
        results.push({
          ...base,
          appraisalId: appraisal._id,
          appraisalDate: appraisal.appraisalDate,
          appraisalAgeDays: appraisalAgeDays(appraisal, args.now),
          issue: "stale" as const,
        });
      }
    }

    return results;
  },
});
