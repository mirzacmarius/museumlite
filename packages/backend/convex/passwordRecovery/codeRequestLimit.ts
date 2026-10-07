import type { EmailConfig } from "@convex-dev/auth/server";
import type { RunMutationCtx } from "@convex-dev/rate-limiter";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { authRecoveryError } from "./authRecoveryErrors";

export const CODE_REQUESTS_PER_WINDOW = 5;
export const CODE_REQUEST_WINDOW_MS = 15 * MINUTE;

const limiter = new RateLimiter(components.rateLimiter, {
  authCodeRequests: {
    kind: "fixed window",
    rate: CODE_REQUESTS_PER_WINDOW,
    period: CODE_REQUEST_WINDOW_MS,
  },
});

/**
 * Counts one emailed auth code (sign-in code, verification or password reset)
 * against the email address. The limit is keyed only by the normalized email,
 * so it applies identically whether or not an account exists.
 */
export async function enforceCodeRequestLimit(
  ctx: RunMutationCtx | undefined,
  email: string,
): Promise<void> {
  if (ctx === undefined) {
    throw new Error("Auth code requests require a Convex action context");
  }
  const status = await limiter.limit(ctx, "authCodeRequests", {
    key: email.trim().toLowerCase(),
  });
  if (!status.ok) {
    throw authRecoveryError("TooManyCodeRequests");
  }
}

type VerificationRequest = Parameters<
  EmailConfig["sendVerificationRequest"]
>[0];

/**
 * Wraps an email provider sender so every send is counted against the limit.
 * Convex Auth passes the action context as the second argument.
 */
export function withCodeRequestLimit(
  send: (params: VerificationRequest) => Promise<void>,
) {
  return async (params: VerificationRequest, ctx?: RunMutationCtx) => {
    // Convex Auth passes the action context. Direct sender tests call this
    // with the email payload only, and those calls do not count.
    if (ctx !== undefined) {
      await enforceCodeRequestLimit(ctx, params.identifier);
    }
    await send(params);
  };
}
