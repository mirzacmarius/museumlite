import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { countIndexedQuery } from "./indexedCounts";

type StatsCtx = Pick<QueryCtx, "db">;

const OPEN_CLAIM_STATUSES = ["draft", "submitted", "under_review"] as const;

export type InsuranceStats = {
  totalPolicies: number;
  activePolicies: number;
  totalCoverageValue: number;
  totalCoveredItems: number;
  uncoveredItemsCount: number;
  openClaimsCount: number;
  totalClaimedAmount: number;
  expiringIn30Days: number;
};

export async function computeInsuranceStats(
  ctx: StatsCtx,
  organizationId: Id<"organizations">,
): Promise<InsuranceStats> {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  const [totalPolicies, activePolicies] = await Promise.all([
    countIndexedQuery(
      ctx.db
        .query("insurancePolicies")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        ),
    ),
    countIndexedQuery(
      ctx.db
        .query("insurancePolicies")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        ),
    ),
  ] as const);

  let totalCoverageValue = 0;
  const coveredObjectIds = new Set<Id<"collections">>();
  const activeCoverages = ctx.db
    .query("insuranceCoverages")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    );
  for await (const coverage of activeCoverages) {
    totalCoverageValue += coverage.coveredValue;
    if (coverage.collectionId) {
      coveredObjectIds.add(coverage.collectionId);
    }
  }

  let uncoveredItemsCount = 0;
  const activeCollections = ctx.db
    .query("collections")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    );
  for await (const collection of activeCollections) {
    if (!coveredObjectIds.has(collection._id)) {
      uncoveredItemsCount += 1;
    }
  }

  let openClaimsCount = 0;
  let totalClaimedAmount = 0;
  for (const status of OPEN_CLAIM_STATUSES) {
    const openClaims = ctx.db
      .query("insuranceClaims")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const claim of openClaims) {
      openClaimsCount += 1;
      totalClaimedAmount += claim.claimedAmount;
    }
  }

  let expiringIn30Days = 0;
  const expiringPolicies = ctx.db
    .query("insurancePolicies")
    .withIndex("by_organization_and_expirationDate", (q) =>
      q
        .eq("organizationId", organizationId)
        .gte("expirationDate", now)
        .lte("expirationDate", in30Days),
    );
  for await (const policy of expiringPolicies) {
    if (policy.status === "active") {
      expiringIn30Days += 1;
    }
  }

  return {
    totalPolicies,
    activePolicies,
    totalCoverageValue,
    totalCoveredItems: coveredObjectIds.size,
    uncoveredItemsCount,
    openClaimsCount,
    totalClaimedAmount,
    expiringIn30Days,
  };
}
