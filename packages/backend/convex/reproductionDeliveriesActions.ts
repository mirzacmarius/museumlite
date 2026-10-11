"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { renderReproductionDeliveryEmail } from "./email/senders";
import { postWithTimeout } from "./utils/deliveryLedger";
import {
  classifyProviderResponse,
  notificationEmailChannel,
  providerRequest,
} from "./utils/notificationEmailChannel";
import { LICENSED_DERIVATIVE_PATH } from "./utils/reproductionDelivery";

/**
 * Sends one claimed attempt of a requester's email. Stale, duplicate or
 * replayed runs are rejected by `claimAttempt` before anything is sent.
 */
export const attemptDelivery = internalAction({
  args: { deliveryId: v.id("reproductionDeliveries"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(
      internal.reproductionDeliveries.claimAttempt,
      args,
    );
    if (claim.kind !== "send") return null;

    const startedAt = Date.now();
    const channel = notificationEmailChannel();
    // Read at call time, like the channel, so configuration applies at once.
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (channel.kind === "unavailable" || !siteUrl) {
      await ctx.runMutation(internal.reproductionDeliveries.recordAttemptResult, {
        ...args,
        startedAt,
        durationMs: 0,
        outcome: "failed_transient",
        errorCode: "channel_unavailable",
      });
      return null;
    }
    const downloadUrl = new URL(
      `${LICENSED_DERIVATIVE_PATH}${claim.token}`,
      siteUrl,
    ).toString();
    const email = await renderReproductionDeliveryEmail(
      { ...claim.content, downloadUrl },
      claim.locale,
    );
    const request = providerRequest(
      channel,
      { to: claim.to, ...email },
      claim.idempotencyKey,
    );
    const result = await postWithTimeout(
      request.url,
      { headers: request.headers, body: request.body },
      { readJson: true },
    );
    await ctx.runMutation(internal.reproductionDeliveries.recordAttemptResult, {
      ...args,
      ...classifyProviderResponse(result),
      startedAt,
      durationMs: Date.now() - startedAt,
    });
    return null;
  },
});
