"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  renderNotificationDigestEmail,
  renderNotificationEmail,
} from "./email/senders";
import { postWithTimeout } from "./utils/deliveryLedger";
import {
  classifyProviderResponse,
  notificationEmailChannel,
  providerRequest,
} from "./utils/notificationEmailChannel";

/**
 * Sends one claimed email attempt. Stale, duplicate or replayed runs are
 * rejected by `claimAttempt` before anything is rendered or sent.
 */
export const attemptDelivery = internalAction({
  args: {
    deliveryId: v.id("notificationEmailDeliveries"),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(
      internal.notificationEmails.claimAttempt,
      args,
    );
    if (claim.kind !== "send") {
      return null;
    }

    const startedAt = Date.now();
    const channel = notificationEmailChannel();
    if (channel.kind === "unavailable") {
      await ctx.runMutation(internal.notificationEmails.recordAttemptResult, {
        ...args,
        startedAt,
        durationMs: 0,
        outcome: "failed_transient",
        errorCode: "channel_unavailable",
      });
      return null;
    }
    const email =
      claim.content.kind === "digest"
        ? await renderNotificationDigestEmail(
            { ...claim.content, email: claim.to },
            claim.locale,
          )
        : await renderNotificationEmail(
            { ...claim.content, email: claim.to },
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

    await ctx.runMutation(internal.notificationEmails.recordAttemptResult, {
      ...args,
      ...classifyProviderResponse(result),
      startedAt,
      durationMs: Date.now() - startedAt,
    });
    return null;
  },
});
