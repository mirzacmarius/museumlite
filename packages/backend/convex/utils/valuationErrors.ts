import { ConvexError } from "convex/values";

/**
 * Stable codes for valuation and insurance coverage problems staff can fix.
 * Clients map these to translated copy; `message` is English for logs only.
 */
export const VALUATION_ERROR_CODES = [
  "INVALID_CURRENCY",
  "INVALID_AMOUNT",
  "INVALID_DATE",
  "APPRAISER_REQUIRED",
  "REASON_REQUIRED",
  "REFERENCE_NOT_FOUND",
  "APPRAISAL_ALREADY_SUPERSEDED",
  "APPRAISAL_SUPERSEDED",
  "APPRAISAL_NOT_FOR_COVERED_OBJECT",
  "APPRAISAL_CURRENCY_MISMATCH",
  "CURRENT_APPRAISAL_REQUIRED",
  "POLICY_NUMBER_TAKEN",
  "INVALID_POLICY_PERIOD",
  "POLICY_NOT_IN_FORCE",
  "INVALID_COVERAGE_PERIOD",
  "COVERAGE_OUTSIDE_POLICY_PERIOD",
  "COVERAGE_TARGET_NOT_FOUND",
  "COVERAGE_NEEDS_TARGET_REVIEW",
  "LEGACY_REVIEW_RESOLVED",
  "LEGACY_REVIEW_TARGET_INVALID",
] as const;

export type ValuationErrorCode = (typeof VALUATION_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ValuationErrorData = {
  code: ValuationErrorCode;
  message: string;
};

export function valuationError(
  code: ValuationErrorCode,
  message: string,
): ConvexError<ValuationErrorData> {
  return new ConvexError({ code, message });
}

function errorData(error: unknown): unknown {
  if (
    typeof error !== "object" ||
    error === null ||
    !(
      error instanceof ConvexError ||
      ("name" in error && error.name === "ConvexError")
    ) ||
    !("data" in error)
  ) {
    return undefined;
  }
  if (typeof error.data !== "string") return error.data;
  try {
    return JSON.parse(error.data);
  } catch {
    return undefined;
  }
}

/** Reads a valuation error from a thrown error; null for any other failure. */
export function valuationErrorFromError(
  error: unknown,
): ValuationErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = VALUATION_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message = (data as Record<string, unknown>).message;
  return { code, message: typeof message === "string" ? message : code };
}
