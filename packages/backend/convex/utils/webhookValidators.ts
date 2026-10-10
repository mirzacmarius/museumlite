import { type Infer, v } from "convex/values";
import {
  deliveryAttemptLedgerFields,
  deliveryLedgerFields,
} from "./deliveryLedger";

/** Sanitized failure reasons; receiver error text is never stored. */
export const webhookDeliveryErrorCode = v.union(
  v.literal("http_error"),
  v.literal("timeout"),
  v.literal("network_error"),
  v.literal("attempt_lost"),
  v.literal("event_expired"),
  v.literal("endpoint_deleted"),
  v.literal("endpoint_disabled"),
  v.literal("endpoint_insecure"),
  v.literal("endpoint_unsubscribed"),
);
export type WebhookDeliveryErrorCode = Infer<typeof webhookDeliveryErrorCode>;

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
  ...deliveryLedgerFields,
  lastErrorCode: v.optional(webhookDeliveryErrorCode),
};

export const webhookDeliveryAttemptFields = {
  organizationId: v.id("organizations"),
  deliveryId: v.id("webhookDeliveries"),
  ...deliveryAttemptLedgerFields,
  errorCode: v.optional(webhookDeliveryErrorCode),
};
