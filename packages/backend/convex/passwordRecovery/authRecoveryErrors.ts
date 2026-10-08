import { ConvexError } from "convex/values";

/**
 * Public auth failure codes. Each one is returned for every account state
 * (existing, unknown, other provider, locked out), so a response never
 * reveals whether a password account exists for an email.
 */
export type AuthRecoveryErrorCode =
  | "InvalidCredentials"
  | "InvalidCode"
  | "TooManyCodeRequests"
  | "SignUpUnavailable";

export function authRecoveryError(code: AuthRecoveryErrorCode) {
  return new ConvexError({ code });
}

/** Rebuild structured errors crossing nested Convex calls at the public boundary. */
export function normalizeAuthRecoveryError(error: unknown): unknown {
  if (!(error instanceof ConvexError)) return error;
  let payload: unknown = error.data;
  for (let depth = 0; depth < 4 && typeof payload === "string"; depth += 1) {
    try {
      payload = JSON.parse(payload);
    } catch {
      return error;
    }
  }
  if (payload && typeof payload === "object" && "code" in payload) {
    const { code } = payload;
    if (
      code === "InvalidCredentials" ||
      code === "InvalidCode" ||
      code === "TooManyCodeRequests" ||
      code === "SignUpUnavailable"
    )
      return authRecoveryError(code);
  }
  return error;
}
