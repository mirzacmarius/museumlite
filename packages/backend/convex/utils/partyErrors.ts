import { ConvexError } from "convex/values";

/**
 * Stable codes for party link and review failures that staff can resolve.
 * Clients map these to translated copy; `message` is English for logs only.
 */
export const PARTY_ERROR_CODES = [
  "PARTY_NOT_FOUND",
  "PARTY_ARCHIVED",
  "PARTY_ROLE_NOT_ALLOWED",
  "PARTY_RECORD_LOCKED",
  "PARTY_TARGET_NOT_FOUND",
  "PARTY_NAME_REQUIRED",
  "PARTY_DATES_INVALID",
  "PARTY_LINK_NOT_FOUND",
  "PARTY_LINK_ALREADY_SUPERSEDED",
  "DUPLICATE_REVIEW_NOT_FOUND",
  "DUPLICATE_REVIEW_ALREADY_RESOLVED",
] as const;

export type PartyErrorCode = (typeof PARTY_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type PartyErrorData = { code: PartyErrorCode; message: string };

export function partyError(
  code: PartyErrorCode,
  message: string,
): ConvexError<PartyErrorData> {
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

/** Reads a party error from a thrown error; null for any other failure. */
export function partyErrorFromError(error: unknown): PartyErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = PARTY_ERROR_CODES.find((candidate) => candidate === data.code);
  if (!code) return null;
  const message =
    "message" in data && typeof data.message === "string" ? data.message : code;
  return { code, message };
}
