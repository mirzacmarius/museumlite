import { ConvexError, v } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Accession lifecycle. `withdrawn` is an intake a reviewer took out of active
 * review: retained and restorable, never a disposal. `rejected` is legacy only.
 */
export const accessionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("withdrawn"),
);

export const accessionReviewDecisionValidator = v.object({
  decision: v.union(
    v.literal("returned_to_draft"),
    v.literal("withdrawn"),
    v.literal("restored"),
  ),
  reason: v.string(),
  decidedBy: v.id("users"),
  decidedAt: v.number(),
  /** Workflow step the intake was at when the decision was made. */
  fromStep: v.number(),
});

/**
 * Stable codes for accession review decisions staff can resolve. Clients map
 * these to translated copy; `message` is English for logs only.
 */
export const ACCESSION_REVIEW_CODES = [
  "NOT_IN_REVIEW",
  "NOT_A_DRAFT",
  "NOT_WITHDRAWN",
  "REASON_REQUIRED",
  "REASON_TOO_LONG",
  "NOT_PERMITTED",
  /** Required source verification is missing and no exception reason was given. */
  "SOURCE_VERIFICATION_REQUIRED",
] as const;

export const MAX_REVIEW_REASON_LENGTH = 2000;

interface AccessionReviewState {
  status: typeof accessionStatusValidator.type;
  workflowStep?: number;
}

/** Submitted and awaiting a reviewer; Draft (step 0) is not under review. */
export function isAwaitingReview(accession: AccessionReviewState) {
  return accession.status === "pending" && accession.workflowStep !== 0;
}

/** Trimmed reviewer reason; refuses blank and overlong reasons. */
export function requireReviewReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw accessionReviewError("REASON_REQUIRED", "A reason is required");
  }
  if (trimmed.length > MAX_REVIEW_REASON_LENGTH) {
    throw accessionReviewError(
      "REASON_TOO_LONG",
      `A reason must be at most ${MAX_REVIEW_REASON_LENGTH} characters`,
    );
  }
  return trimmed;
}

export type AccessionReviewCode = (typeof ACCESSION_REVIEW_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type AccessionReviewErrorData = {
  code: AccessionReviewCode;
  message: string;
};

export function accessionReviewError(
  code: AccessionReviewCode,
  message: string,
): ConvexError<AccessionReviewErrorData> {
  return new ConvexError({ code, message });
}

/** Reads an accession review error from a thrown error; null for any other failure. */
export function accessionReviewErrorFromError(
  error: unknown,
): AccessionReviewErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = ACCESSION_REVIEW_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message = "message" in data ? data.message : undefined;
  return { code, message: typeof message === "string" ? message : code };
}
