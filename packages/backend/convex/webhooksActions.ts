import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  type AttemptResult,
  classifyAttempt,
  signedDeliveryHeaders,
  WEBHOOK_REQUEST_TIMEOUT_MS,
} from "./utils/webhookDelivery";

/**
 * Sends one claimed attempt. Stale, duplicate or replayed runs are rejected by
 * `claimAttempt` before any request leaves.
 */
export const attemptDelivery = internalAction({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(
      internal.webhookDeliveries.claimAttempt,
      args,
    );
    if (claim.kind !== "send") {
      return null;
    }

    const startedAt = Date.now();
    const headers = await signedDeliveryHeaders({
      secret: claim.secret,
      body: claim.body,
      eventType: claim.eventType,
      deliveryId: args.deliveryId,
      timestamp: Math.floor(startedAt / 1000),
    });
    const result = await postWithTimeout(claim.url, headers, claim.body);

    await ctx.runMutation(internal.webhookDeliveries.recordAttemptResult, {
      ...args,
      ...classifyAttempt(result),
      startedAt,
      durationMs: Date.now() - startedAt,
    });
    return null;
  },
});

/**
 * Entry point of jobs scheduled by the pre-durable emitter. Such jobs may
 * still be queued during the deploy; they are recorded like a new emit.
 */
export const deliver = internalAction({
  args: {
    organizationId: v.id("organizations"),
    event: v.string(),
    data: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.webhookDeliveries.recordLegacyEvent, {
      organizationId: args.organizationId,
      event: args.event,
      data:
        typeof args.data === "object" &&
        args.data !== null &&
        !Array.isArray(args.data)
          ? (args.data as Record<string, unknown>)
          : {},
    });
    return null;
  },
});

async function postWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    WEBHOOK_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
    return { kind: "response", status: response.status };
  } catch {
    return controller.signal.aborted
      ? { kind: "timeout" }
      : { kind: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
