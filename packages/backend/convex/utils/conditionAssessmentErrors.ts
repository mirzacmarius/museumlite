import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for condition assessment problems staff can resolve. Clients
 * map them to translated copy; `message` is English for logs only.
 */
export const CONDITION_ASSESSMENT_ERROR_CODES = [
  /** The object already has a draft or an assessment awaiting approval. */
  "ASSESSMENT_ALREADY_OPEN",
  /** Only a draft can be edited or submitted. */
  "ASSESSMENT_NOT_DRAFT",
  /** Only an assessment awaiting approval can be accepted or rejected. */
  "ASSESSMENT_NOT_SUBMITTED",
  /** The object or an evidence photo is gone; reject and record a new one. */
  "ASSESSMENT_EVIDENCE_UNAVAILABLE",
] as const;

export type ConditionAssessmentErrorCode =
  (typeof CONDITION_ASSESSMENT_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ConditionAssessmentErrorData = {
  code: ConditionAssessmentErrorCode;
  message: string;
};

export function conditionAssessmentError(
  code: ConditionAssessmentErrorCode,
  message: string,
): ConvexError<ConditionAssessmentErrorData> {
  return new ConvexError({ code, message });
}

/** Reads a condition assessment failure from a thrown error; null otherwise. */
export function conditionAssessmentErrorFromError(
  error: unknown,
): ConditionAssessmentErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const code = CONDITION_ASSESSMENT_ERROR_CODES.find(
    (candidate) => candidate === record.code,
  );
  if (!code) return null;
  return {
    code,
    message: typeof record.message === "string" ? record.message : code,
  };
}
