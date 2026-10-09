import type { Doc, Id } from "../_generated/dataModel";
import type {
  WebhookAttemptOutcome,
  WebhookDeliveryErrorCode,
} from "./webhookValidators";

/** Events with a wired emit point; only these are advertised to endpoints. */
export const WEBHOOK_EVENT_TYPES = [
  "collection.created",
  "loan.approved",
  "media.uploaded",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export const WEBHOOK_TEST_EVENT = "test";

export const WEBHOOK_PAYLOAD_VERSION = 1;
export const MAX_WEBHOOKS_PER_ORGANIZATION = 50;
export const WEBHOOK_MAX_ATTEMPTS = 6;
export const WEBHOOK_TEST_MAX_ATTEMPTS = 1;
export const WEBHOOK_REQUEST_TIMEOUT_MS = 10_000;
/** How long a claimed attempt may stay unreported before the sweep retries it. */
export const WEBHOOK_ATTEMPT_LEASE_MS = 2 * 60_000;
/** How late a pending attempt may run before the sweep schedules it again. */
export const WEBHOOK_SWEEP_GRACE_MS = 5 * 60_000;
/** Success timestamps closer together than this are not rewritten. */
export const WEBHOOK_LAST_TRIGGERED_RESOLUTION_MS = 60_000;
export const WEBHOOK_RETENTION_MS = 30 * 24 * 60 * 60_000;

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_FACTOR = 4;
const BACKOFF_CAP_MS = 2 * 60 * 60_000;

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
    : WEBHOOK_MAX_ATTEMPTS;
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

/**
 * Delay before the next attempt after `failedInSeries` consecutive failures:
 * 30s, 2m, 8m, 32m, then 2h, each with +/-20% jitter.
 */
export function retryDelayMs(failedInSeries: number, random = Math.random()) {
  const exponent = Math.max(0, failedInSeries - 1);
  const base = Math.min(
    BACKOFF_BASE_MS * BACKOFF_FACTOR ** exponent,
    BACKOFF_CAP_MS,
  );
  return Math.round(base * (0.8 + 0.4 * random));
}

export type AttemptResult =
  | { kind: "response"; status: number }
  | { kind: "timeout" }
  | { kind: "network_error" };

export interface ClassifiedAttempt {
  outcome: WebhookAttemptOutcome;
  responseStatus?: number;
  errorCode?: WebhookDeliveryErrorCode;
}

/**
 * 2xx succeeds; 408, 429, 5xx, timeouts and network errors are retried.
 * Redirects are not followed and, like other responses, fail permanently.
 */
export function classifyAttempt(result: AttemptResult): ClassifiedAttempt {
  if (result.kind === "timeout") {
    return { outcome: "failed_transient", errorCode: "timeout" };
  }
  if (result.kind === "network_error") {
    return { outcome: "failed_transient", errorCode: "network_error" };
  }
  const { status } = result;
  if (status >= 200 && status < 300) {
    return { outcome: "succeeded", responseStatus: status };
  }
  const retryable = status === 408 || status === 429 || status >= 500;
  return {
    outcome: retryable ? "failed_transient" : "failed_permanent",
    responseStatus: status,
    errorCode: "http_error",
  };
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
