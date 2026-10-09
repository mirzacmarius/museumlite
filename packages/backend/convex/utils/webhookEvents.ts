import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  MAX_WEBHOOKS_PER_ORGANIZATION,
  maxAttemptsFor,
  randomToken,
  serializeWebhookBody,
  WEBHOOK_PAYLOAD_VERSION,
  type WebhookEventType,
} from "./webhookDelivery";

/**
 * Records the event and one delivery per subscribed active endpoint in the
 * caller's transaction. Nothing is stored when no endpoint subscribes.
 */
export async function emitWebhookEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const webhooks = await ctx.db
    .query("webhooks")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(MAX_WEBHOOKS_PER_ORGANIZATION);
  const subscribers = webhooks.filter(
    (webhook) => webhook.isActive && webhook.events.includes(event),
  );
  if (subscribers.length === 0) {
    return;
  }

  await recordWebhookEvent(ctx, {
    organizationId,
    type: event,
    data,
    webhooks: subscribers,
  });
}

/**
 * Captures the payload once, creates a pending delivery per endpoint and
 * schedules a single dispatch, so the caller's transaction schedules one
 * function per event however many endpoints subscribe.
 */
export async function recordWebhookEvent(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    type: string;
    data: Record<string, unknown>;
    webhooks: Array<Doc<"webhooks">>;
  },
): Promise<Array<Id<"webhookDeliveries">>> {
  const now = Date.now();
  const eventId = randomToken("evt");
  const eventDocId = await ctx.db.insert("webhookEvents", {
    organizationId: args.organizationId,
    eventId,
    type: args.type,
    payloadVersion: WEBHOOK_PAYLOAD_VERSION,
    body: serializeWebhookBody({
      eventId,
      type: args.type,
      createdAt: now,
      data: args.data,
    }),
  });

  const deliveryIds = await Promise.all(
    args.webhooks.map((webhook) =>
      ctx.db.insert("webhookDeliveries", {
        organizationId: args.organizationId,
        webhookId: webhook._id,
        eventId: eventDocId,
        eventType: args.type,
        status: "pending",
        attemptCount: 0,
        seriesStartAttempt: 0,
        maxAttempts: maxAttemptsFor(args.type),
        nextAttemptAt: now,
        retryCount: 0,
      }),
    ),
  );
  await ctx.scheduler.runAfter(0, internal.webhookDeliveries.dispatchEvent, {
    eventId: eventDocId,
  });
  return deliveryIds;
}
