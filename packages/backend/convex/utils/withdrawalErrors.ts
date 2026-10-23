import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Stable codes for Withdrawals (Remove item) staff can correct. Clients map
 * these to translated copy; `message` is English for logs only.
 */
export const WITHDRAWAL_CODES = [
  /** A Withdrawal, single or bulk, needs a reason. */
  "WITHDRAWAL_REASON_REQUIRED",
] as const;

export type WithdrawalCode = (typeof WITHDRAWAL_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type WithdrawalErrorData = {
  code: WithdrawalCode;
  message: string;
};

const MESSAGES: Record<WithdrawalCode, string> = {
  WITHDRAWAL_REASON_REQUIRED: "Reason is required",
};

export function withdrawalError(
  code: WithdrawalCode,
): ConvexError<WithdrawalErrorData> {
  return new ConvexError({ code, message: MESSAGES[code] });
}

/** Reads a Withdrawal refusal from a thrown error; null for any other failure. */
export function withdrawalErrorFromError(
  error: unknown,
): WithdrawalErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = WITHDRAWAL_CODES.find((candidate) => candidate === data.code);
  if (!code) return null;
  return { code, message: MESSAGES[code] };
}
