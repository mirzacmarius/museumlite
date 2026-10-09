import type { Doc } from "../_generated/dataModel";
import { VALUATION_MAX_AGE_MS } from "./valuation";

/**
 * Stage-specific disposal policy.
 *
 * A deaccession passes through three separate stages: the decision to
 * dispose, the physical exit of the object, and (for sales only) receipt of
 * proceeds. Each stage has its own evidence. Evidence that can only exist
 * after a later stage (for example a sale receipt) is never demanded before
 * the decision can be authorized.
 */
export const DISPOSAL_POLICY_VERSION = 1;

export type DisposalMethod = Doc<"deaccessions">["method"];

export type DisposalDecisionCheckKey =
  | "reason"
  | "disposition"
  | "valuation"
  | "regulatory_approval";

export interface DisposalDecisionCheck {
  key: DisposalDecisionCheckKey;
  required: boolean;
  passed: boolean;
}

const DECISION_CHECK_LABELS: Record<DisposalDecisionCheckKey, string> = {
  reason: "reason for disposal",
  disposition: "intended disposition (recipient, destination or means)",
  valuation: "current valuation (less than 2 years old)",
  regulatory_approval: "regulatory approval",
};

interface MethodStagePolicy {
  /** A current valuation must be linked before the decision. */
  valuationRequiredForDecision: boolean;
  /** Proceeds are received and verified after the decision. */
  proceedsStage: boolean;
}

const METHOD_STAGE_POLICY: Record<DisposalMethod, MethodStagePolicy> = {
  sale: { valuationRequiredForDecision: true, proceedsStage: true },
  donation: { valuationRequiredForDecision: false, proceedsStage: false },
  transfer: { valuationRequiredForDecision: false, proceedsStage: false },
  destruction: { valuationRequiredForDecision: false, proceedsStage: false },
};

type DeaccessionStageFields = Pick<
  Doc<"deaccessions">,
  | "method"
  | "reason"
  | "disposition"
  | "targetCollectionStatus"
  | "appraisalVerified"
  | "appraisalDate"
  | "regulatoryApprovalRequired"
  | "regulatoryApprovalStatus"
>;

/** Archive and delete requests withdraw a record; they are not disposals. */
export function isDisposalDecision(
  deaccession: Pick<Doc<"deaccessions">, "targetCollectionStatus">,
) {
  return (
    (deaccession.targetCollectionStatus ?? "deaccessioned") === "deaccessioned"
  );
}

export function methodHasProceedsStage(method: DisposalMethod) {
  return METHOD_STAGE_POLICY[method].proceedsStage;
}

/**
 * A decision accepts the valuation linked to it when it is dated, not in the
 * future and within the shared two-year valuation age (`utils/valuation.ts`).
 * Linking refuses superseded appraisals; the linked value and currency are
 * snapshotted on the deaccession so the decision keeps its original evidence.
 */
export function hasCurrentValuation(
  deaccession: Pick<Doc<"deaccessions">, "appraisalVerified" | "appraisalDate">,
  now: number,
) {
  return (
    deaccession.appraisalVerified === true &&
    deaccession.appraisalDate !== undefined &&
    deaccession.appraisalDate <= now &&
    now - deaccession.appraisalDate <= VALUATION_MAX_AGE_MS
  );
}

export function evaluateDisposalDecisionChecks(
  deaccession: DeaccessionStageFields,
  now: number,
): DisposalDecisionCheck[] {
  if (!isDisposalDecision(deaccession)) {
    return [];
  }

  const policy = METHOD_STAGE_POLICY[deaccession.method];
  const regulatoryRequired = deaccession.regulatoryApprovalRequired === true;

  return [
    {
      key: "reason",
      required: true,
      passed: deaccession.reason.trim().length > 0,
    },
    {
      key: "disposition",
      required: true,
      passed: (deaccession.disposition?.trim().length ?? 0) > 0,
    },
    {
      key: "valuation",
      required: policy.valuationRequiredForDecision,
      passed: hasCurrentValuation(deaccession, now),
    },
    {
      key: "regulatory_approval",
      required: regulatoryRequired,
      passed:
        !regulatoryRequired ||
        deaccession.regulatoryApprovalStatus === "approved",
    },
  ];
}

export function getBlockingDecisionChecks(checks: DisposalDecisionCheck[]) {
  return checks.filter((check) => check.required && !check.passed);
}

export function describeBlockingDecisionChecks(
  blocking: DisposalDecisionCheck[],
) {
  return blocking.map((check) => DECISION_CHECK_LABELS[check.key]).join(", ");
}

export type DisposalDecisionBasis =
  | "pending"
  | "rejected"
  | "policy_checked"
  | "authorized_exception"
  | "legacy";

/**
 * Approved decisions recorded before stage checks existed (or written outside
 * the disposal decision path) carry no review snapshot. They are reported as
 * legacy and never rewritten to look policy-checked.
 */
export function resolveDecisionBasis(
  deaccession: Pick<Doc<"deaccessions">, "status" | "decisionReview">,
): DisposalDecisionBasis {
  if (deaccession.status === "pending") return "pending";
  if (deaccession.status === "rejected") return "rejected";
  if (!deaccession.decisionReview) return "legacy";
  return deaccession.decisionReview.exception
    ? "authorized_exception"
    : "policy_checked";
}

export type DisposalExitState =
  | "not_applicable"
  | "awaiting_decision"
  | "outstanding"
  | "recorded";

export function resolveExitState(
  deaccession: Pick<
    Doc<"deaccessions">,
    "status" | "targetCollectionStatus" | "exitRecord"
  >,
): DisposalExitState {
  if (!isDisposalDecision(deaccession) || deaccession.status === "rejected") {
    return "not_applicable";
  }
  if (deaccession.status === "pending") return "awaiting_decision";
  return deaccession.exitRecord ? "recorded" : "outstanding";
}

export type DisposalProceedsState =
  | "not_applicable"
  | "awaiting_decision"
  | "outstanding"
  | "recorded"
  | "verified";

export function resolveProceedsState(
  deaccession: Pick<
    Doc<"deaccessions">,
    | "status"
    | "method"
    | "targetCollectionStatus"
    | "proceedsAmount"
    | "proceedsVerified"
  >,
): DisposalProceedsState {
  if (
    !isDisposalDecision(deaccession) ||
    deaccession.status === "rejected" ||
    !methodHasProceedsStage(deaccession.method)
  ) {
    return "not_applicable";
  }
  if (deaccession.status === "pending") return "awaiting_decision";
  if (deaccession.proceedsVerified === true) return "verified";
  return deaccession.proceedsAmount !== undefined ? "recorded" : "outstanding";
}
