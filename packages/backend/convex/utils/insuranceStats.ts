import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  type CurrencyTotals,
  CurrencyTotalsBuilder,
  currencyTotalsValidator,
} from "./currency";
import {
  collectInForceCoverage,
  effectivePolicyStatus,
  type InForceCoverage,
} from "./insuranceCoverage";

type StatsCtx = Pick<QueryCtx, "db">;

const OPEN_CLAIM_STATUSES = ["draft", "submitted", "under_review"] as const;
/** Objects in the institution's care that need insurance cover. */
const INSURABLE_OBJECT_STATUSES = ["active", "loaned"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export const insuranceStatsValidator = v.object({
  totalPolicies: v.number(),
  activePolicies: v.number(),
  inForceCoverageValue: currencyTotalsValidator,
  totalCoveredItems: v.number(),
  uncoveredItemsCount: v.number(),
  coveragesNeedingReview: v.number(),
  openClaimsCount: v.number(),
  openClaimAmounts: currencyTotalsValidator,
  expiringIn30Days: v.number(),
});

export interface InsuranceStats {
  totalPolicies: number;
  activePolicies: number;
  inForceCoverageValue: CurrencyTotals;
  totalCoveredItems: number;
  uncoveredItemsCount: number;
  coveragesNeedingReview: number;
  openClaimsCount: number;
  openClaimAmounts: CurrencyTotals;
  expiringIn30Days: number;
}

/** Insurable objects and how many of them have cover in force. */
export async function countInsurableObjects(
  ctx: StatsCtx,
  organizationId: Id<"organizations">,
  coverage: InForceCoverage,
) {
  let totalObjects = 0;
  let coveredObjects = 0;
  for (const status of INSURABLE_OBJECT_STATUSES) {
    const objects = ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const object of objects) {
      totalObjects += 1;
      if (coverage.coveredObjectIds.has(object._id)) coveredObjects += 1;
    }
  }
  return { totalObjects, coveredObjects };
}

export async function computeOpenClaims(
  ctx: StatsCtx,
  organizationId: Id<"organizations">,
) {
  let openClaimsCount = 0;
  const amounts = new CurrencyTotalsBuilder();
  for (const status of OPEN_CLAIM_STATUSES) {
    const openClaims = ctx.db
      .query("insuranceClaims")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const claim of openClaims) {
      openClaimsCount += 1;
      amounts.add(claim.currency, claim.claimedAmount);
    }
  }
  return { openClaimsCount, openClaimAmounts: amounts.build() };
}

export async function computeInsuranceStats(
  ctx: StatsCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<InsuranceStats> {
  const in30Days = now + 30 * DAY_MS;

  let totalPolicies = 0;
  let activePolicies = 0;
  let expiringIn30Days = 0;
  const policies = ctx.db
    .query("insurancePolicies")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    );
  for await (const policy of policies) {
    totalPolicies += 1;
    if (effectivePolicyStatus(policy, now) !== "active") continue;
    activePolicies += 1;
    if (policy.expirationDate <= in30Days) expiringIn30Days += 1;
  }

  const coverage = await collectInForceCoverage(ctx, organizationId, now);
  const [objects, claims] = await Promise.all([
    countInsurableObjects(ctx, organizationId, coverage),
    computeOpenClaims(ctx, organizationId),
  ]);

  return {
    totalPolicies,
    activePolicies,
    inForceCoverageValue: coverage.value,
    totalCoveredItems: objects.coveredObjects,
    uncoveredItemsCount: objects.totalObjects - objects.coveredObjects,
    coveragesNeedingReview: coverage.needsReviewCount,
    openClaimsCount: claims.openClaimsCount,
    openClaimAmounts: claims.openClaimAmounts,
    expiringIn30Days,
  };
}
