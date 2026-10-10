import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for provenance problems staff can resolve. Clients map these
 * to translated copy; `message` is English for logs only.
 */
export const PROVENANCE_ERROR_CODES = [
  "PROVENANCE_OBJECT_NOT_FOUND",
  "PROVENANCE_OBJECT_WITHDRAWN",
  "PROVENANCE_CLAIM_NOT_FOUND",
  "PROVENANCE_CLAIM_SUPERSEDED",
  "PROVENANCE_STATEMENT_REQUIRED",
  "PROVENANCE_PARTY_NAME_REQUIRED",
  "PROVENANCE_PARTY_INVALID",
  "PROVENANCE_DATE_INVALID",
  "PROVENANCE_DATE_ORDER_INVALID",
  "PROVENANCE_TEXT_TOO_LONG",
  "PROVENANCE_CONTRADICTION_INVALID",
  "PROVENANCE_EVIDENCE_REQUIRED",
  "PROVENANCE_EVIDENCE_INVALID",
  "PROVENANCE_EVIDENCE_LIMIT",
  "PROVENANCE_EVIDENCE_NOT_FOUND",
  "PROVENANCE_EVIDENCE_RETRACTED",
  "PROVENANCE_REASON_REQUIRED",
  "PROVENANCE_REVIEW_NOTE_REQUIRED",
] as const;

export type ProvenanceErrorCode = (typeof PROVENANCE_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ProvenanceErrorData = {
  code: ProvenanceErrorCode;
  message: string;
};

export function provenanceError(
  code: ProvenanceErrorCode,
  message: string,
): ConvexError<ProvenanceErrorData> {
  return new ConvexError({ code, message });
}

/** Reads a provenance error from a thrown error; null for any other failure. */
export function provenanceErrorFromError(
  error: unknown,
): ProvenanceErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = PROVENANCE_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message =
    "message" in data && typeof data.message === "string" ? data.message : code;
  return { code, message };
}
