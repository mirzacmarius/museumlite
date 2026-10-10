import {
  type AttemptResult,
  type ClassifiedAttempt,
  classifyAttempt,
} from "./deliveryLedger";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const FIXTURE_SENDER = "MuseumLite <notifications@example.test>";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * How this deployment sends notification email. `fixture` posts Resend-shaped
 * requests to a loopback test endpoint and is only for tests and local QA.
 */
export type NotificationEmailChannel =
  | { kind: "provider"; url: string; apiKey: string; from: string }
  | { kind: "fixture"; url: string; from: string }
  | { kind: "unavailable" };

export type NotificationEmailChannelKind = NotificationEmailChannel["kind"];

function loopbackUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Read at call time so a configuration change applies to the next attempt. */
export function notificationEmailChannel(): NotificationEmailChannel {
  const fixtureUrl = process.env.NOTIFICATION_EMAIL_FIXTURE_URL;
  const sender = process.env.RESEND_SENDER_EMAIL_AUTH;
  if (fixtureUrl) {
    const url = loopbackUrl(fixtureUrl);
    return url
      ? { kind: "fixture", url, from: sender || FIXTURE_SENDER }
      : { kind: "unavailable" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && sender) {
    return { kind: "provider", url: RESEND_EMAILS_URL, apiKey, from: sender };
  }
  return { kind: "unavailable" };
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * The provider deduplicates requests with the same idempotency key for 24
 * hours, so a resent attempt whose first result was lost is not delivered
 * twice.
 */
export function providerRequest(
  channel: Exclude<NotificationEmailChannel, { kind: "unavailable" }>,
  email: OutgoingEmail,
  idempotencyKey: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (channel.kind === "provider") {
    headers.Authorization = `Bearer ${channel.apiKey}`;
  }
  return {
    url: channel.url,
    headers,
    body: JSON.stringify({
      from: channel.from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  };
}

function errorName(body: unknown) {
  return typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof body.name === "string"
    ? body.name
    : null;
}

function messageId(body: unknown) {
  return typeof body === "object" &&
    body !== null &&
    "id" in body &&
    typeof body.id === "string"
    ? body.id
    : undefined;
}

/**
 * The shared attempt rules, plus the provider's own signal: a 409 because
 * another request with the same idempotency key is still running is retried.
 */
export function classifyProviderResponse(
  result: AttemptResult,
): ClassifiedAttempt & { providerMessageId?: string } {
  if (
    result.kind === "response" &&
    result.status === 409 &&
    errorName(result.body) === "concurrent_idempotent_requests"
  ) {
    return {
      outcome: "failed_transient",
      responseStatus: 409,
      errorCode: "http_error",
    };
  }
  const classified = classifyAttempt(result);
  return classified.outcome === "succeeded" && result.kind === "response"
    ? { ...classified, providerMessageId: messageId(result.body) }
    : classified;
}
