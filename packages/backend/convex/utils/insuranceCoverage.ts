import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { type CurrencyTotals, CurrencyTotalsBuilder } from "./currency";
import { valuationError } from "./valuationErrors";

/**
 * Insurance coverage rules shared by insurance reads, alerts and the daily
 * status reconciliation.
 *
 * A coverage insures exactly one typed target (an object, a loan or an
 * exhibition) in its own currency for an interval inside its policy period.
 * Legacy rows that name several targets are not treated as cover until a
 * person resolves them through the legacy coverage review queue.
 */

export const coverageTargetKindValidator = v.union(
  v.literal("object"),
  v.literal("loan"),
  v.literal("exhibition"),
);

export type CoverageTargetKind = Infer<typeof coverageTargetKindValidator>;

export const coverageTargetValidator = v.union(
  v.object({ kind: v.literal("object"), collectionId: v.id("collections") }),
  v.object({ kind: v.literal("loan"), loanId: v.id("loans") }),
  v.object({
    kind: v.literal("exhibition"),
    exhibitionId: v.id("exhibitions"),
  }),
);

export type CoverageTarget = Infer<typeof coverageTargetValidator>;

type TargetFields = Pick<
  Doc<"insuranceCoverages">,
  "targetType" | "collectionId" | "loanId" | "exhibitionId"
>;

export function recordedTargets(
  coverage: Pick<TargetFields, "collectionId" | "loanId" | "exhibitionId">,
): CoverageTarget[] {
  const targets: CoverageTarget[] = [];
  if (coverage.collectionId) {
    targets.push({ kind: "object", collectionId: coverage.collectionId });
  }
  if (coverage.loanId) targets.push({ kind: "loan", loanId: coverage.loanId });
  if (coverage.exhibitionId) {
    targets.push({ kind: "exhibition", exhibitionId: coverage.exhibitionId });
  }
  return targets;
}

/**
 * The coverage's single target, or null for a legacy row that names several
 * targets without a reviewed choice.
 */
export function coverageTarget(coverage: TargetFields): CoverageTarget | null {
  const targets = recordedTargets(coverage);
  if (coverage.targetType) {
    return (
      targets.find((target) => target.kind === coverage.targetType) ?? null
    );
  }
  return targets.length === 1 ? (targets[0] ?? null) : null;
}

export function needsTargetReview(coverage: TargetFields) {
  return (
    coverageTarget(coverage) === null && recordedTargets(coverage).length > 1
  );
}

/** Stored fields for a coverage of exactly this target. */
export function targetFields(target: CoverageTarget) {
  switch (target.kind) {
    case "object":
      return {
        targetType: "object" as const,
        collectionId: target.collectionId,
      };
    case "loan":
      return { targetType: "loan" as const, loanId: target.loanId };
    case "exhibition":
      return {
        targetType: "exhibition" as const,
        exhibitionId: target.exhibitionId,
      };
  }
}

export function targetId(target: CoverageTarget): string {
  switch (target.kind) {
    case "object":
      return target.collectionId;
    case "loan":
      return target.loanId;
    case "exhibition":
      return target.exhibitionId;
  }
}

type ReadCtx = Pick<QueryCtx, "db">;

/** Display label and owning organization of a target; null when missing. */
export async function describeTarget(ctx: ReadCtx, target: CoverageTarget) {
  switch (target.kind) {
    case "object": {
      const object = await ctx.db.get(target.collectionId);
      return object
        ? {
            organizationId: object.organizationId,
            label: object.title,
            reference: object.accessionNumber,
          }
        : null;
    }
    case "loan": {
      const loan = await ctx.db.get(target.loanId);
      return loan
        ? {
            organizationId: loan.organizationId,
            label: loan.lenderBorrowerName,
            reference: loan.loanNumber,
          }
        : null;
    }
    case "exhibition": {
      const exhibition = await ctx.db.get(target.exhibitionId);
      return exhibition
        ? {
            organizationId: exhibition.organizationId,
            label: exhibition.title,
            reference: undefined,
          }
        : null;
    }
  }
}

type PolicyDates = Pick<
  Doc<"insurancePolicies">,
  "status" | "effectiveDate" | "expirationDate"
>;

/**
 * The policy's status at `now`. Cancelled, suspended and expired policies
 * keep their recorded status; otherwise the policy period decides.
 */
export function effectivePolicyStatus(
  policy: PolicyDates,
  now: number,
): Doc<"insurancePolicies">["status"] {
  if (
    policy.status === "cancelled" ||
    policy.status === "suspended" ||
    policy.status === "expired"
  ) {
    return policy.status;
  }
  if (now > policy.expirationDate) return "expired";
  if (now < policy.effectiveDate) return "pending";
  return "active";
}

export function coverageInterval(
  coverage: Pick<Doc<"insuranceCoverages">, "effectiveDate" | "expirationDate">,
  policy: Pick<Doc<"insurancePolicies">, "effectiveDate" | "expirationDate">,
) {
  return {
    start: coverage.effectiveDate ?? policy.effectiveDate,
    end: coverage.expirationDate ?? policy.expirationDate,
  };
}

/** A coverage interval defaults to the policy period and must lie inside it. */
export function requireCoveragePeriod(
  policy: Pick<Doc<"insurancePolicies">, "effectiveDate" | "expirationDate">,
  effectiveDate: number | undefined,
  expirationDate: number | undefined,
) {
  const { start, end } = coverageInterval(
    { effectiveDate, expirationDate },
    policy,
  );
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw valuationError(
      "INVALID_COVERAGE_PERIOD",
      "Coverage must end on or after it starts",
    );
  }
  if (start < policy.effectiveDate || end > policy.expirationDate) {
    throw valuationError(
      "COVERAGE_OUTSIDE_POLICY_PERIOD",
      "Coverage dates must fall inside the policy period",
    );
  }
}

export async function requireTargetInOrganization(
  ctx: ReadCtx,
  target: CoverageTarget,
  organizationId: Id<"organizations">,
) {
  const described = await describeTarget(ctx, target);
  if (!described || described.organizationId !== organizationId) {
    throw valuationError(
      "COVERAGE_TARGET_NOT_FOUND",
      "The covered object, loan or exhibition was not found in this organization",
    );
  }
  return described;
}

export const coverageStateValidator = v.union(
  v.literal("in_force"),
  v.literal("not_started"),
  v.literal("expired"),
  v.literal("policy_inactive"),
  v.literal("removed"),
  v.literal("needs_review"),
);

export type CoverageState = Infer<typeof coverageStateValidator>;

export function coverageState(
  coverage: Doc<"insuranceCoverages">,
  policy: Doc<"insurancePolicies"> | null,
  now: number,
): CoverageState {
  if (coverage.status === "removed") return "removed";
  if (coverageTarget(coverage) === null) return "needs_review";
  if (!policy) return "policy_inactive";
  const policyStatus = effectivePolicyStatus(policy, now);
  if (policyStatus === "cancelled" || policyStatus === "suspended") {
    return "policy_inactive";
  }
  const { start, end } = coverageInterval(coverage, policy);
  if (
    coverage.status === "expired" ||
    policyStatus === "expired" ||
    now > end
  ) {
    return "expired";
  }
  if (
    coverage.status === "pending" ||
    policyStatus === "pending" ||
    now < start
  ) {
    return "not_started";
  }
  return "in_force";
}

/** Objects read per covered loan or exhibition when deriving covered objects. */
export const MAX_TARGET_MEMBERS = 500;

async function objectsCoveredThrough(
  ctx: ReadCtx,
  target: CoverageTarget,
): Promise<Id<"collections">[]> {
  switch (target.kind) {
    case "object":
      return [target.collectionId];
    case "loan": {
      const items = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", target.loanId))
        .take(MAX_TARGET_MEMBERS);
      return items
        .filter((item) => item.custodyStatus !== "returned")
        .map((item) => item.collectionId);
    }
    case "exhibition": {
      const members = await ctx.db
        .query("exhibitionObjects")
        .withIndex("by_exhibition", (q) =>
          q.eq("exhibitionId", target.exhibitionId),
        )
        .take(MAX_TARGET_MEMBERS);
      return members
        .filter((member) => member.status !== "returned")
        .map((member) => member.collectionId);
    }
  }
}

export interface InForceCoverage {
  /** Objects covered directly or as members of a covered loan or exhibition. */
  coveredObjectIds: Set<Id<"collections">>;
  /** Value of coverages in force at `now`, per currency. */
  value: CurrencyTotals;
  inForceCount: number;
  needsReviewCount: number;
}

/** Coverage in force across an organization at `now`. */
export async function collectInForceCoverage(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<InForceCoverage> {
  const policies = new Map<
    Id<"insurancePolicies">,
    Doc<"insurancePolicies"> | null
  >();
  const coveredObjectIds = new Set<Id<"collections">>();
  const value = new CurrencyTotalsBuilder();
  let inForceCount = 0;
  let needsReviewCount = 0;

  for (const status of ["active", "pending"] as const) {
    const coverages = ctx.db
      .query("insuranceCoverages")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const coverage of coverages) {
      if (!policies.has(coverage.policyId)) {
        const policy = await ctx.db.get(coverage.policyId);
        policies.set(
          coverage.policyId,
          policy?.organizationId === organizationId ? policy : null,
        );
      }
      const state = coverageState(
        coverage,
        policies.get(coverage.policyId) ?? null,
        now,
      );
      if (state === "needs_review") {
        needsReviewCount += 1;
        continue;
      }
      if (state !== "in_force") continue;
      const target = coverageTarget(coverage);
      if (!target) continue;
      inForceCount += 1;
      value.add(coverage.currency, coverage.coveredValue);
      for (const collectionId of await objectsCoveredThrough(ctx, target)) {
        coveredObjectIds.add(collectionId);
      }
    }
  }

  return {
    coveredObjectIds,
    value: value.build(),
    inForceCount,
    needsReviewCount,
  };
}
