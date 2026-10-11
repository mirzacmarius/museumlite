import type { Doc, Id } from "../_generated/dataModel";
import { DELIVERY_MAX_ATTEMPTS } from "./deliveryLedger";

/** Events with a wired emit point; only these are advertised to endpoints. */
export const WEBHOOK_EVENT_TYPES = [
  "collection.created",
  "loan.approved",
  "media.uploaded",
  "reproduction_request.decided",
  "reproduction_request.ended",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export const WEBHOOK_TEST_EVENT = "test";

export const WEBHOOK_PAYLOAD_VERSION = 1;
export const MAX_WEBHOOKS_PER_ORGANIZATION = 50;
export const WEBHOOK_TEST_MAX_ATTEMPTS = 1;
/** Success timestamps closer together than this are not rewritten. */
export const WEBHOOK_LAST_TRIGGERED_RESOLUTION_MS = 60_000;

export function isSupportedWebhookEvent(
  event: string,
): event is WebhookEventType {
  return WEBHOOK_EVENT_TYPES.some((supported) => supported === event);
}

export function isHttpsWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.length > 0 &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

export function maxAttemptsFor(eventType: string) {
  return eventType === WEBHOOK_TEST_EVENT
    ? WEBHOOK_TEST_MAX_ATTEMPTS
    : DELIVERY_MAX_ATTEMPTS;
}

export type EndpointIneligibility =
  | "endpoint_deleted"
  | "endpoint_disabled"
  | "endpoint_unsubscribed"
  | "endpoint_insecure";

/**
 * Why an endpoint may not receive `eventType` for `organizationId` right now,
 * or null when it may. Test events ignore subscriptions.
 */
export function endpointIneligibility(
  webhook: Doc<"webhooks"> | null,
  organizationId: Id<"organizations">,
  eventType: string,
): EndpointIneligibility | null {
  if (!webhook || webhook.organizationId !== organizationId) {
    return "endpoint_deleted";
  }
  if (!webhook.isActive) return "endpoint_disabled";
  if (eventType !== WEBHOOK_TEST_EVENT && !webhook.events.includes(eventType)) {
    return "endpoint_unsubscribed";
  }
  if (!isHttpsWebhookUrl(webhook.url)) return "endpoint_insecure";
  return null;
}

export function serializeWebhookBody(event: {
  eventId: string;
  type: string;
  createdAt: number;
  data: Record<string, unknown>;
}) {
  return JSON.stringify({
    id: event.eventId,
    event: event.type,
    version: WEBHOOK_PAYLOAD_VERSION,
    timestamp: event.createdAt,
    data: event.data,
  });
}

export function randomToken(prefix: string, byteLength = 12) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return `${prefix}_${toHex(bytes)}`;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function hmacSha256Hex(secret: string, content: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(content),
  );
  return toHex(new Uint8Array(signature));
}

/**
 * `X-ML-Signature` keeps the original body-only scheme so existing receivers
 * still verify. `X-ML-Signature-V2` also binds the delivery id and send time,
 * so receivers can reject replays outside their tolerance window.
 */
export async function signedDeliveryHeaders(args: {
  secret: string;
  body: string;
  eventType: string;
  deliveryId: string;
  timestamp: number;
}): Promise<Record<string, string>> {
  const [bodySignature, v2Signature] = await Promise.all([
    hmacSha256Hex(args.secret, args.body),
    hmacSha256Hex(
      args.secret,
      `${args.deliveryId}.${args.timestamp}.${args.body}`,
    ),
  ]);
  return {
    "Content-Type": "application/json",
    "X-ML-Event": args.eventType,
    "X-ML-Delivery": args.deliveryId,
    "X-ML-Timestamp": String(args.timestamp),
    "X-ML-Signature": `sha256=${bodySignature}`,
    "X-ML-Signature-V2": `v2=${v2Signature}`,
  };
}
