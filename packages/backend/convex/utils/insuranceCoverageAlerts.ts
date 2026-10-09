import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { CurrencyTotalsBuilder, currencyTotalsValidator } from "./currency";
import {
  collectInForceCoverage,
  coverageState,
  effectivePolicyStatus,
} from "./insuranceCoverage";
import { computeOpenClaims, countInsurableObjects } from "./insuranceStats";
import {
  appraisalExpiresAt,
  INSURANCE_APPRAISAL_MAX_AGE_MS,
  valuationGroupKey,
} from "./valuation";

type AlertsCtx = Pick<QueryCtx, "db">;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_WINDOW_DAYS = 90;
const EXPIRED_POLICY_ROWS = 20;

export const coverageAlertsValidator = v.object({
  inForceValue: currencyTotalsValidator,
  expiringPolicies: v.array(
    v.object({
      _id: v.id("insurancePolicies"),
      policyNumber: v.string(),
      carrier: v.string(),
      currency: v.optional(v.string()),
      expirationDate: v.number(),
      daysUntilExpiry: v.number(),
      coverageCount: v.number(),
      coveredValue: currencyTotalsValidator,
      severity: v.union(
        v.literal("critical"),
        v.literal("warning"),
        v.literal("info"),
      ),
    }),
  ),
  expiredPolicies: v.array(
    v.object({
      _id: v.id("insurancePolicies"),
      policyNumber: v.string(),
      carrier: v.string(),
      expirationDate: v.number(),
      coverageCount: v.number(),
    }),
  ),
  expiredPoliciesCount: v.number(),
  uncoveredStats: v.object({
    totalObjects: v.number(),
    coveredObjects: v.number(),
    uncoveredObjects: v.number(),
    coveragePercentage: v.number(),
  }),
  coveragesNeedingReview: v.number(),
  pendingClaimsCount: v.number(),
  staleAppraisalCount: v.number(),
  disputedClaimsCount: v.number(),
});

export type CoverageAlertsResult = Infer<typeof coverageAlertsValidator>;

async function policyCoverages(
  ctx: AlertsCtx,
  policy: Doc<"insurancePolicies">,
  now: number,
) {
  let inForce = 0;
  let recorded = 0;
  const value = new CurrencyTotalsBuilder();
  for (const status of ["active", "pending", "expired"] as const) {
    const coverages = ctx.db
      .query("insuranceCoverages")
      .withIndex("by_policy_and_status", (q) =>
        q.eq("policyId", policy._id).eq("status", status),
      );
    for await (const coverage of coverages) {
      recorded += 1;
      if (coverageState(coverage, policy, now) !== "in_force") continue;
      inForce += 1;
      value.add(coverage.currency, coverage.coveredValue);
    }
  }
  return { inForce, recorded, value: value.build() };
}

/**
 * Current insurance valuations past their three-year age or `validUntil`.
 * Superseded and replaced appraisals are history, not stale valuations.
 */
async function countStaleInsuranceValuations(
  ctx: AlertsCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const latest = new Map<string, Doc<"appraisals">>();
  const appraisals = ctx.db
    .query("appraisals")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    );
  for await (const appraisal of appraisals) {
    if (appraisal.appraisalType !== "insurance") continue;
    if (appraisal.supersededBy !== undefined) continue;
    const key = `${appraisal.collectionId}|${valuationGroupKey(appraisal)}`;
    const existing = latest.get(key);
    if (
      !existing ||
      appraisal.appraisalDate > existing.appraisalDate ||
      (appraisal.appraisalDate === existing.appraisalDate &&
        appraisal._creationTime > existing._creationTime)
    ) {
      latest.set(key, appraisal);
    }
  }
  let stale = 0;
  for (const appraisal of latest.values()) {
    if (appraisalExpiresAt(appraisal, INSURANCE_APPRAISAL_MAX_AGE_MS) < now) {
      stale += 1;
    }
  }
  return stale;
}

export async function computeCoverageAlerts(
  ctx: AlertsCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<CoverageAlertsResult> {
  const expiringBefore = now + EXPIRING_WINDOW_DAYS * MS_PER_DAY;
  const expiringPolicies: CoverageAlertsResult["expiringPolicies"] = [];
  const expiredPolicies: CoverageAlertsResult["expiredPolicies"] = [];
  let expiredPoliciesCount = 0;

  const policies = ctx.db
    .query("insurancePolicies")
    .withIndex("by_organization_and_expirationDate", (q) =>
      q
        .eq("organizationId", organizationId)
        .lte("expirationDate", expiringBefore),
    )
    .order("desc");
  for await (const policy of policies) {
    const status = effectivePolicyStatus(policy, now);
    if (status === "expired") {
      expiredPoliciesCount += 1;
      if (expiredPolicies.length < EXPIRED_POLICY_ROWS) {
        const coverages = await policyCoverages(ctx, policy, now);
        expiredPolicies.push({
          _id: policy._id,
          policyNumber: policy.policyNumber,
          carrier: policy.carrier,
          expirationDate: policy.expirationDate,
          coverageCount: coverages.recorded,
        });
      }
      continue;
    }
    if (status !== "active") continue;
    const coverages = await policyCoverages(ctx, policy, now);
    const daysUntilExpiry = Math.ceil(
      (policy.expirationDate - now) / MS_PER_DAY,
    );
    expiringPolicies.push({
      _id: policy._id,
      policyNumber: policy.policyNumber,
      carrier: policy.carrier,
      currency: policy.currency,
      expirationDate: policy.expirationDate,
      daysUntilExpiry,
      coverageCount: coverages.inForce,
      coveredValue: coverages.value,
      severity:
        daysUntilExpiry <= 7
          ? "critical"
          : daysUntilExpiry <= 30
            ? "warning"
            : "info",
    });
  }

  const coverage = await collectInForceCoverage(ctx, organizationId, now);
  const [objects, claims, staleAppraisalCount] = await Promise.all([
    countInsurableObjects(ctx, organizationId, coverage),
    computeOpenClaims(ctx, organizationId),
    countStaleInsuranceValuations(ctx, organizationId, now),
  ]);

  let disputedClaimsCount = 0;
  const claimRows = ctx.db
    .query("insuranceClaims")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    );
  for await (const claim of claimRows) {
    if (claim.isDisputed && claim.disputeStatus !== "resolved") {
      disputedClaimsCount += 1;
    }
  }

  return {
    inForceValue: coverage.value,
    expiringPolicies: expiringPolicies.sort(
      (a, b) => a.daysUntilExpiry - b.daysUntilExpiry,
    ),
    expiredPolicies,
    expiredPoliciesCount,
    uncoveredStats: {
      totalObjects: objects.totalObjects,
      coveredObjects: objects.coveredObjects,
      uncoveredObjects: objects.totalObjects - objects.coveredObjects,
      coveragePercentage:
        objects.totalObjects > 0
          ? Math.round((objects.coveredObjects / objects.totalObjects) * 100)
          : 0,
    },
    coveragesNeedingReview: coverage.needsReviewCount,
    pendingClaimsCount: claims.openClaimsCount,
    staleAppraisalCount,
    disputedClaimsCount,
  };
}
