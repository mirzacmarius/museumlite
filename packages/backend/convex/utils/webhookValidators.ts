import { type Infer, v } from "convex/values";

/**
 * `pending` waits for its next attempt. The other states are terminal until an
 * administrator retries: `failed_transient` used up its attempts on retryable
 * failures, `failed_permanent` was refused by the receiver or is unsendable,
 * and `cancelled` was never sent because the endpoint was revoked.
 */
export const webhookDeliveryStatus = v.union(
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed_transient"),
  v.literal("failed_permanent"),
  v.literal("cancelled"),
);
export type WebhookDeliveryStatus = Infer<typeof webhookDeliveryStatus>;

/** Sanitized failure reasons; receiver error text is never stored. */
export const webhookDeliveryErrorCode = v.union(
  v.literal("http_error"),
  v.literal("timeout"),
  v.literal("network_error"),
  v.literal("attempt_lost"),
  v.literal("endpoint_deleted"),
  v.literal("endpoint_disabled"),
  v.literal("endpoint_insecure"),
  v.literal("endpoint_unsubscribed"),
);
export type WebhookDeliveryErrorCode = Infer<typeof webhookDeliveryErrorCode>;

export const webhookAttemptOutcome = v.union(
  v.literal("succeeded"),
  v.literal("failed_transient"),
  v.literal("failed_permanent"),
);
export type WebhookAttemptOutcome = Infer<typeof webhookAttemptOutcome>;

export const webhookEventFields = {
  organizationId: v.id("organizations"),
  /** Public event id sent in the payload; stable across attempts and retries. */
  eventId: v.string(),
  type: v.string(),
  payloadVersion: v.number(),
  /** Exact JSON body captured when the event was emitted. */
  body: v.string(),
};

export const webhookDeliveryFields = {
  organizationId: v.id("organizations"),
  webhookId: v.id("webhooks"),
  eventId: v.id("webhookEvents"),
  eventType: v.string(),
  status: webhookDeliveryStatus,
  /** Attempts sent across every attempt series; never decreases. */
  attemptCount: v.number(),
  /** `attemptCount` when the current series began (0, or at a manual retry). */
  seriesStartAttempt: v.number(),
  /** Attempts allowed in the current series. */
  maxAttempts: v.number(),
  /** Due time of the next attempt, or lease expiry while one is in flight. */
  nextAttemptAt: v.optional(v.number()),
  inFlightSince: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  lastResponseStatus: v.optional(v.number()),
  lastErrorCode: v.optional(webhookDeliveryErrorCode),
  retryCount: v.number(),
  lastRetriedBy: v.optional(v.id("users")),
  completedAt: v.optional(v.number()),
};

export const webhookDeliveryAttemptFields = {
  organizationId: v.id("organizations"),
  deliveryId: v.id("webhookDeliveries"),
  attemptNumber: v.number(),
  startedAt: v.number(),
  durationMs: v.number(),
  outcome: webhookAttemptOutcome,
  responseStatus: v.optional(v.number()),
  errorCode: v.optional(webhookDeliveryErrorCode),
};
