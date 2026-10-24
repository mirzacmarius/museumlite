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

const PRIVATE_HOST_NAMES = new Set(["localhost", "ip6-localhost"]);
const PRIVATE_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".arpa"];

function isPrivateIpv4(host: string): boolean {
  const octets = host.split(".");
  if (octets.length !== 4) return false;
  const [a, b] = octets.map((octet) =>
    /^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN,
  );
  if (octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255))
    return false;
  if (a === undefined || b === undefined) return false;
  // Unspecified, loopback, private, carrier-grade NAT, link-local (cloud
  // metadata lives there), multicast and reserved ranges.
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** The eight 16-bit groups of an IPv6 address, or null when malformed. */
function ipv6Groups(address: string): number[] | null {
  let text = address;
  // A trailing dotted IPv4 part fills the last two groups.
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted?.[1] && dotted[2]) {
    const octets = dotted[2].split(".").map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string | undefined) =>
    part ? part.split(":") : ([] as string[]);
  const head = parse(halves[0]);
  const tail = parse(halves[1]);
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function embeddedIpv4(high: number, low: number): string {
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isPrivateIpv6(host: string): boolean {
  const groups = ipv6Groups(host.replace(/^\[|\]$/g, "").toLowerCase());
  // Refuse what cannot be read rather than guess.
  if (!groups) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] =
    groups;
  const zeroUpTo = (count: number) =>
    groups.slice(0, count).every((group) => group === 0);
  // Unspecified, loopback and the deprecated IPv4-compatible block (::/96).
  if (zeroUpTo(6)) return true;
  // IPv4-mapped (::ffff:0:0/96) and IPv4-translated (::ffff:0:0:0/96).
  if (
    (zeroUpTo(5) && g5 === 0xffff) ||
    (zeroUpTo(4) && g4 === 0xffff && g5 === 0)
  )
    return isPrivateIpv4(embeddedIpv4(g6, g7));
  // NAT64: the well-known prefix carries an IPv4 address; local-use
  // prefixes (64:ff9b:1::/48) only reach private networks.
  if (g0 === 0x64 && g1 === 0xff9b) {
    if (g2 === 1) return true;
    if (g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0)
      return isPrivateIpv4(embeddedIpv4(g6, g7));
  }
  // 6to4 (2002::/16) embeds an IPv4 address in the next two groups.
  if (g0 === 0x2002) return isPrivateIpv4(embeddedIpv4(g1, g2));
  return (
    // Discard-only (100::/64) and documentation (2001:db8::/32) ranges.
    (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) ||
    (g0 === 0x2001 && g1 === 0xdb8) ||
    // Unique local (fc00::/7), link-local (fe80::/10), the retired
    // site-local block (fec0::/10) and multicast (ff00::/8).
    (g0 & 0xfe00) === 0xfc00 ||
    (g0 & 0xffc0) === 0xfe80 ||
    (g0 & 0xffc0) === 0xfec0 ||
    (g0 & 0xff00) === 0xff00
  );
}

/** Loopback, private and internal hosts never receive a webhook. */
export function isPrivateWebhookHost(hostname: string): boolean {
  // A fully qualified name may end in dots; `localhost.` is still local.
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (host.startsWith("[") || host.includes(":")) return isPrivateIpv6(host);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIpv4(host);
  return (
    PRIVATE_HOST_NAMES.has(host) ||
    PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    !host.includes(".")
  );
}

/**
 * Whether `url` is an HTTPS address on a public host, without credentials.
 * Endpoints that fail this are refused when saved and skipped at delivery.
 */
export function isPublicHttpsWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.length > 0 &&
      parsed.username === "" &&
      parsed.password === "" &&
      !isPrivateWebhookHost(parsed.hostname)
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
  if (!isPublicHttpsWebhookUrl(webhook.url)) return "endpoint_insecure";
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
