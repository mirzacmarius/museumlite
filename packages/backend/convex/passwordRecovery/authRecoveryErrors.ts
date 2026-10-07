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
