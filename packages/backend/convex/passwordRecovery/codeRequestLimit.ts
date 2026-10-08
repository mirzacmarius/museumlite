import type { RunMutationCtx } from "@convex-dev/rate-limiter";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { authRecoveryError } from "./authRecoveryErrors";

export const CODE_REQUESTS_PER_WINDOW = 5;
export const CODE_REQUEST_BURST = 10;
export const CODE_REQUEST_WINDOW_MS = 15 * MINUTE;

const limiter = new RateLimiter(components.rateLimiter, {
  authCodeRequests: {
    kind: "token bucket",
    rate: CODE_REQUESTS_PER_WINDOW,
    capacity: CODE_REQUEST_BURST,
    period: CODE_REQUEST_WINDOW_MS,
  },
});

export type CodeRequestFlow =
  | "password-verification"
  | "reset"
  | "otp"
  | "magic-link"
  | "password-link";

export function codeRequestFlow(
  provider: string,
  hasPasswordAccount: boolean,
): CodeRequestFlow {
  if (provider === "resend-otp-password-reset") return "reset";
  if (provider === "resend-otp")
    return hasPasswordAccount ? "password-verification" : "otp";
  return provider === "magic-link" ? "magic-link" : "password-link";
}

/** Count before code creation, using the same bucket for known and unknown emails. */
export async function enforceCodeRequestLimit(
  ctx: RunMutationCtx,
  email: string,
  flow: CodeRequestFlow,
): Promise<void> {
  const status = await limiter.limit(ctx, "authCodeRequests", {
    key: `${flow}:${email.trim().toLowerCase()}`,
  });
  if (!status.ok) throw authRecoveryError("TooManyCodeRequests");
}
