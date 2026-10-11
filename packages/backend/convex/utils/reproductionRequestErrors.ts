import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for Reproduction request failures staff can resolve. Clients
 * map these to translated copy; `message` is English for logs only.
 */
export const REPRODUCTION_ERROR_CODES = [
  "REQUEST_NOT_FOUND",
  "OBJECT_UNAVAILABLE",
  "IMAGE_NOT_ELIGIBLE",
  "IMAGE_SOURCE_UNVERIFIED",
  "REQUESTER_EMAIL_MISSING",
  "PURPOSE_REQUIRED",
  "TEXT_TOO_LONG",
  "REQUEST_NOT_OPEN",
  "EVIDENCE_NOT_FOUND",
  "EVIDENCE_DOCUMENT_INVALID",
  "EVIDENCE_REQUIRED",
  "DERIVATIVE_IN_PROGRESS",
  "DERIVATIVE_NOT_READY",
  "TERMS_NOT_PUBLISHED",
  "TERMS_OUTDATED",
  "TERMS_TEXT_REQUIRED",
  "EXPIRY_INVALID",
  "REASON_REQUIRED",
  "GRANT_NOT_ACTIVE",
  "DELIVERY_NOT_RETRYABLE",
  "EMAIL_CHANNEL_UNAVAILABLE",
] as const;

export type ReproductionErrorCode = (typeof REPRODUCTION_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ReproductionErrorData = {
  code: ReproductionErrorCode;
  message: string;
};

export function reproductionError(
  code: ReproductionErrorCode,
  message: string,
): ConvexError<ReproductionErrorData> {
  const error = new ConvexError({ code, message });
  error.message = message;
  return error;
}

/** Reads a Reproduction request error code; null for any other failure. */
export function reproductionErrorCodeFromError(
  error: unknown,
): ReproductionErrorCode | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  return (
    REPRODUCTION_ERROR_CODES.find((candidate) => candidate === data.code) ??
    null
  );
}
