import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Stable codes for objects a loan cannot take. Clients map these to
 * translated copy; `message` is English for logs only.
 */
export const LOAN_OBJECT_CODES = [
  /** Missing, or another organization's: the two are not told apart. */
  "OBJECT_UNAVAILABLE",
  /** Archived, deaccessioned or otherwise out of the active collection. */
  "OBJECT_NOT_ACTIVE",
  /** Already on another pending or active loan. */
  "OBJECT_ON_ACTIVE_LOAN",
  /** Held by an open transfer to another organization (ADR 0019). */
  "OBJECT_IN_TRANSFER",
] as const;

export type LoanObjectCode = (typeof LOAN_OBJECT_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type LoanObjectErrorData = {
  code: LoanObjectCode;
  message: string;
};

const MESSAGES: Record<LoanObjectCode, string> = {
  OBJECT_UNAVAILABLE: "A selected object is not available",
  OBJECT_NOT_ACTIVE: "A selected object is not active",
  OBJECT_ON_ACTIVE_LOAN: "A selected object is already on an active loan",
  OBJECT_IN_TRANSFER:
    "A selected object is being transferred to another organization",
};

export function loanObjectError(
  code: LoanObjectCode,
): ConvexError<LoanObjectErrorData> {
  return new ConvexError({ code, message: MESSAGES[code] });
}

/** Reads a loan object refusal from a thrown error; null for any other failure. */
export function loanObjectErrorFromError(
  error: unknown,
): LoanObjectErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = LOAN_OBJECT_CODES.find((candidate) => candidate === data.code);
  if (!code) return null;
  return { code, message: MESSAGES[code] };
}
