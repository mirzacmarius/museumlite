import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for conservation treatment workflow refusals staff can
 * resolve. Clients map these to translated copy; `message` is English for
 * logs only.
 */
export const CONSERVATION_ERROR_CODES = [
  /** Approval and completion need a baseline assessment of the object. */
  "TREATMENT_BASELINE_REQUIRED",
  /** Completion needs an outcome assessment of the object. */
  "TREATMENT_OUTCOME_REQUIRED",
  /** Completion needs the outcome assessment to be accepted. */
  "TREATMENT_OUTCOME_NOT_ACCEPTED",
  /** The treatment moved to another status since the page was loaded. */
  "TREATMENT_STATUS_CHANGED",
] as const;

export type ConservationErrorCode = (typeof CONSERVATION_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ConservationErrorData = {
  code: ConservationErrorCode;
  message: string;
};

export function conservationError(
  code: ConservationErrorCode,
  message: string,
): ConvexError<ConservationErrorData> {
  return new ConvexError({ code, message });
}

/** Reads a conservation refusal from a thrown error; null for any other failure. */
export function conservationErrorFromError(
  error: unknown,
): ConservationErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = CONSERVATION_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message =
    "message" in data && typeof data.message === "string" ? data.message : code;
  return { code, message };
}
