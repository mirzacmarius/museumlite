import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { countIndexedQuery } from "./indexedCounts";
import { computeInsuranceStats } from "./insuranceStats";

type AlertsCtx = Pick<QueryCtx, "db">;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CoverageAlertsResult = {
  expiringPolicies: Array<{
    _id: Id<"insurancePolicies">;
    policyNumber: string;
    carrier: string;
    expirationDate: number;
    daysUntilExpiry: number;
    coverageCount: number;
    totalCoveredValue: number;
    severity: "critical" | "warning" | "info";
  }>;
  uncoveredStats: {
    totalObjects: number;
    coveredObjects: number;
    uncoveredObjects: number;
    coveragePercentage: number;
  };
  expiredPoliciesCount: number;
  pendingClaimsCount: number;
  staleAppraisalCount: number;
  disputedClaimsCount: number;
};

async function countActiveCollections(
  ctx: AlertsCtx,
  organizationId: Id<"organizations">,
) {
  return countIndexedQuery(
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active"),
      ),
  );
}

async function countCoveredCollectionIds(
  ctx: AlertsCtx,
  organizationId: Id<"organizations">,
) {
  const coveredObjectIds = new Set<Id<"collections">>();
  const activeCoverages = ctx.db
    .query("insuranceCoverages")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    );
  for await (const coverage of activeCoverages) {
    if (coverage.collectionId) {
      coveredObjectIds.add(coverage.collectionId);
    }
  }
  return coveredObjectIds.size;
}

export async function computeCoverageAlerts(
  ctx: AlertsCtx,
  organizationId: Id<"organizations">,
): Promise<CoverageAlertsResult> {
  const now = Date.now();
  const in90Days = now + 90 * MS_PER_DAY;
  const threeYearsAgo = now - 3 * 365 * MS_PER_DAY;

  const expiringPoliciesQuery = ctx.db
    .query("insurancePolicies")
    .withIndex("by_organization_and_expirationDate", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("expirationDate", now)
        .lte("expirationDate", in90Days),
    );

  const expiringPolicies: CoverageAlertsResult["expiringPolicies"] = [];
  for await (const policy of expiringPoliciesQuery) {
    if (policy.status !== "active") {
      continue;
    }

    let coverageCount = 0;
    let totalCoveredValue = 0;
    const coverages = ctx.db
      .query("insuranceCoverages")
      .withIndex("by_policy_and_status", (q) =>
        q.eq("policyId", policy._id).eq("status", "active"),
      );
    for await (const coverage of coverages) {
      coverageCount += 1;
      totalCoveredValue += coverage.coveredValue;
    }

    const daysUntilExpiry = Math.ceil(
      (policy.expirationDate - now) / MS_PER_DAY,
    );
    let severity: "critical" | "warning" | "info" = "info";
    if (daysUntilExpiry <= 7) {
      severity = "critical";
    } else if (daysUntilExpiry <= 30) {
      severity = "warning";
    }

    expiringPolicies.push({
      _id: policy._id,
      policyNumber: policy.policyNumber,
      carrier: policy.carrier,
      expirationDate: policy.expirationDate,
      daysUntilExpiry,
      coverageCount,
      totalCoveredValue,
      severity,
    });
  }

  const [totalObjects, coveredObjects, expiredPoliciesCount, stats] =
    await Promise.all([
      countActiveCollections(ctx, organizationId),
      countCoveredCollectionIds(ctx, organizationId),
      countIndexedQuery(
        ctx.db
          .query("insurancePolicies")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", organizationId).eq("status", "expired"),
          ),
      ),
      computeInsuranceStats(ctx, organizationId),
    ] as const);

  const uncoveredObjects = totalObjects - coveredObjects;
  const coveragePercentage =
    totalObjects > 0 ? Math.round((coveredObjects / totalObjects) * 100) : 0;

  let disputedClaimsCount = 0;
  const claims = ctx.db
    .query("insuranceClaims")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    );
  for await (const claim of claims) {
    if (claim.isDisputed && claim.disputeStatus !== "resolved") {
      disputedClaimsCount += 1;
    }
  }

  let staleAppraisalCount = 0;
  const appraisals = ctx.db
    .query("appraisals")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    );
  for await (const appraisal of appraisals) {
    if (appraisal.appraisalDate < threeYearsAgo) {
      staleAppraisalCount += 1;
    }
  }

  return {
    expiringPolicies: expiringPolicies.sort(
      (a, b) => a.daysUntilExpiry - b.daysUntilExpiry,
    ),
    uncoveredStats: {
      totalObjects,
      coveredObjects,
      uncoveredObjects,
      coveragePercentage,
    },
    expiredPoliciesCount,
    pendingClaimsCount: stats.openClaimsCount,
    staleAppraisalCount,
    disputedClaimsCount,
  };
}
