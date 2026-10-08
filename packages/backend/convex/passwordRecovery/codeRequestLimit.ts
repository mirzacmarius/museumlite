import type { RunMutationCtx } from "@convex-dev/rate-limiter";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { authRecoveryError } from "./authRecoveryErrors";

export const codeRequestReserved = Symbol("codeRequestReserved");

export function hasCodeRequestReservation(ctx: object): boolean {
  return codeRequestReserved in ctx && ctx[codeRequestReserved] === true;
}

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
  ctx: RunMutationCtx & Pick<MutationCtx, "scheduler">,
  email: string,
  flow: CodeRequestFlow,
): Promise<void> {
  const key = `${flow}:${email.trim().toLowerCase()}`;
  const status = await limiter.limit(ctx, "authCodeRequests", { key });
  if (!status.ok) throw authRecoveryError("TooManyCodeRequests");
  const requestedAt = Date.now();
  const refillTime =
    (CODE_REQUEST_BURST / CODE_REQUESTS_PER_WINDOW) * CODE_REQUEST_WINDOW_MS;
  await ctx.scheduler.runAfter(
    refillTime,
    internal.passwordRecovery.codeRequestLimit.expireBucket,
    { key, requestedAt },
  );
}

/** Delete an idle bucket only after it would have fully refilled anyway. */
export const expireBucket = internalMutation({
  args: { key: v.string(), requestedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { key, requestedAt }) => {
    const state = await limiter.getValue(ctx, "authCodeRequests", { key });
    if (state.ts <= requestedAt)
      await limiter.reset(ctx, "authCodeRequests", { key });
    return null;
  },
});
