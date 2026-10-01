import { ConvexError, type Infer, v } from "convex/values";

export const accountErrorCodeValidator = v.union(
  v.literal("UNAUTHENTICATED"),
  v.literal("INVALID_EMAIL"),
  v.literal("EMAIL_IN_USE"),
  v.literal("EMAIL_UNCHANGED"),
  v.literal("EMAIL_SEND_THROTTLED"),
  v.literal("INVALID_CODE"),
  v.literal("EMAIL_CODE_EXPIRED"),
  v.literal("NO_PENDING_EMAIL_CHANGE"),
  v.literal("MULTIPLE_EMAIL_ACCOUNTS"),
  v.literal("INVALID_PHONE"),
  v.literal("INVALID_NEW_PASSWORD"),
  v.literal("PASSWORD_UNCHANGED"),
  v.literal("PASSWORD_UNAVAILABLE"),
  v.literal("PASSWORD_RATE_LIMITED"),
  v.literal("ACCOUNT_CHANGED"),
);

export const accountErrorResultValidator = v.object({
  status: v.literal("error"),
  code: accountErrorCodeValidator,
});

type AccountErrorCode = Infer<typeof accountErrorCodeValidator>;
export type AccountErrorResult = { status: "error"; code: AccountErrorCode };

const ACCOUNT_ERROR_CODES: readonly AccountErrorCode[] = [
  "UNAUTHENTICATED",
  "INVALID_EMAIL",
  "EMAIL_IN_USE",
  "EMAIL_UNCHANGED",
  "EMAIL_SEND_THROTTLED",
  "INVALID_CODE",
  "EMAIL_CODE_EXPIRED",
  "NO_PENDING_EMAIL_CHANGE",
  "MULTIPLE_EMAIL_ACCOUNTS",
  "INVALID_PHONE",
  "INVALID_NEW_PASSWORD",
  "PASSWORD_UNCHANGED",
  "PASSWORD_UNAVAILABLE",
  "PASSWORD_RATE_LIMITED",
  "ACCOUNT_CHANGED",
];

export function expectedAccountError(
  error: unknown,
): AccountErrorResult | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !(
      error instanceof ConvexError ||
      ("name" in error && error.name === "ConvexError")
    ) ||
    !("data" in error)
  ) {
    return null;
  }
  let data: unknown = error.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = ACCOUNT_ERROR_CODES.find((candidate) => candidate === data.code);
  return code ? { status: "error", code } : null;
}
