import type { Product } from "@polar-sh/sdk/models/components/product.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { env } from "./env";

const http = httpRouter();

function isValidIsoTimestamp(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return false;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    ,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  const offsetHour = Number(offsetHourText ?? 0);
  const offsetMinute = Number(offsetMinuteText ?? 0);
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    daysInMonth !== undefined &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

auth.addHttpRoutes(http);

function encodeBase64(value: string) {
  return btoa(value);
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toOptionalIsoString(
  value: string | Date | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  return toIsoString(value);
}

function serializeWebhookSubscription(
  subscription: Subscription,
  webhookId: string,
  eventType: string,
) {
  return {
    webhookId,
    eventType,
    id: subscription.id,
    customerId: subscription.customerId,
    productId: subscription.productId,
    productName: subscription.product.name,
    productDescription: subscription.product.description,
    priceId: subscription.priceId,
    checkoutId: subscription.checkoutId,
    amount: subscription.amount,
    currency: subscription.currency,
    recurringInterval: subscription.recurringInterval,
    status: subscription.status,
    createdAt: toIsoString(subscription.createdAt),
    modifiedAt: toOptionalIsoString(subscription.modifiedAt),
    currentPeriodStart: toIsoString(subscription.currentPeriodStart),
    currentPeriodEnd: toOptionalIsoString(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    startedAt: toOptionalIsoString(subscription.startedAt),
    endedAt: toOptionalIsoString(subscription.endedAt),
    metadata: subscription.metadata,
    organizationId:
      typeof subscription.metadata?.organizationId === "string"
        ? subscription.metadata.organizationId
        : undefined,
  };
}

const billingWebhook = httpAction(async (ctx, request) => {
  if (!request.body) {
    return new Response("Missing request body", { status: 400 });
  }

  const [{ Webhook, WebhookVerificationError }, body] = await Promise.all([
    import("standardwebhooks"),
    request.text(),
  ]);
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };
  const webhookId = headers["webhook-id"];

  try {
    const webhook = new Webhook(encodeBase64(env.POLAR_WEBHOOK_SECRET));
    const event = webhook.verify(body, headers) as {
      type: string;
      data: Product | Subscription;
    };

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.active":
      case "subscription.revoked":
      case "subscription.uncanceled": {
        if (!("customerId" in event.data)) {
          return new Response("Invalid webhook payload", { status: 400 });
        }
        await ctx.runAction(
          internal.subscriptions.applyBillingSubscriptionEvent,
          serializeWebhookSubscription(event.data, webhookId, event.type),
        );
        break;
      }
      case "product.created":
      case "product.updated": {
        if (!("prices" in event.data)) {
          return new Response("Invalid webhook payload", { status: 400 });
        }
        await ctx.runAction(internal.subscriptions.applyBillingProductEvent, {
          webhookId,
          eventType: event.type,
          product: event.data,
        });
        break;
      }
      default:
        break;
    }

    return new Response("Accepted", { status: 202 });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.error(error);
      return new Response("Forbidden", { status: 403 });
    }
    throw error;
  }
});

http.route({
  path: "/polar/events",
  method: "POST",
  handler: billingWebhook,
});

const listObjects = httpAction(async (ctx, request) => {
  const unauthorized = () =>
    new Response(JSON.stringify({ error: "invalid_api_key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized();
  }

  const apiKey = authHeader.slice("Bearer ".length).trim();
  if (!apiKey) {
    return unauthorized();
  }

  const validation = await ctx.runMutation(internal.apiKeys.validate, {
    apiKey,
  });

  if (!validation.valid || !validation.permissions.includes("read")) {
    return unauthorized();
  }

  const objects = await ctx.runQuery(internal.collections.listForApi, {
    organizationId: validation.organizationId,
  });

  return new Response(JSON.stringify({ data: objects }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

const receiveEnvironmentalReading = httpAction(async (ctx, request) => {
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(401, { error: "invalid_device_credential" });
  }
  const credential = authorization.slice("Bearer ".length).trim();
  if (!credential || credential.length > 256) {
    return json(401, { error: "invalid_device_credential" });
  }
  const noteError = async (
    error:
      | "Invalid payload"
      | "Invalid measurement"
      | "Measurement out of range",
  ) =>
    ctx.runMutation(internal.environmentalDevices.noteIngestionError, {
      credential,
      error,
    });
  const invalid = async (
    status: number,
    errorCode: string,
    healthError:
      | "Invalid payload"
      | "Invalid measurement"
      | "Measurement out of range",
  ) => {
    const rateLimited = await noteError(healthError);
    return rateLimited
      ? json(429, { error: "rate_limit_exceeded" })
      : json(status, { error: errorCode });
  };
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .includes("application/json")
  ) {
    return invalid(400, "invalid_content_type", "Invalid payload");
  }
  if (!request.body) {
    return invalid(400, "invalid_payload", "Invalid payload");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > 4096) {
      await reader.cancel();
      return invalid(413, "payload_too_large", "Invalid payload");
    }
    chunks.push(chunk.value);
  }
  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const bodyText = new TextDecoder().decode(bodyBytes);

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return invalid(400, "invalid_payload", "Invalid payload");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid(400, "invalid_payload", "Invalid payload");
  }
  const payload = body as Record<string, unknown>;
  const temperature = payload.temperature;
  const humidity = payload.humidity;
  if (
    typeof payload.readingId !== "string" ||
    !payload.readingId.trim() ||
    payload.readingId !== payload.readingId.trim() ||
    payload.readingId.length > 128 ||
    typeof payload.probeId !== "string" ||
    !payload.probeId.trim() ||
    payload.probeId !== payload.probeId.trim() ||
    payload.probeId.length > 100 ||
    (typeof payload.timestamp !== "number" &&
      typeof payload.timestamp !== "string") ||
    (typeof payload.timestamp === "string" &&
      !isValidIsoTimestamp(payload.timestamp)) ||
    typeof temperature !== "object" ||
    temperature === null ||
    Array.isArray(temperature) ||
    typeof humidity !== "object" ||
    humidity === null ||
    Array.isArray(humidity)
  ) {
    return invalid(400, "invalid_payload", "Invalid payload");
  }
  const timestamp =
    typeof payload.timestamp === "number"
      ? payload.timestamp
      : Date.parse(payload.timestamp);
  const temp = temperature as Record<string, unknown>;
  const humid = humidity as Record<string, unknown>;
  if (
    !Number.isFinite(timestamp) ||
    typeof temp.value !== "number" ||
    !Number.isFinite(temp.value) ||
    typeof humid.value !== "number" ||
    !Number.isFinite(humid.value) ||
    (temp.unit !== "C" &&
      temp.unit !== "°C" &&
      temp.unit !== "F" &&
      temp.unit !== "°F") ||
    (humid.unit !== "%" && humid.unit !== "percent")
  ) {
    return invalid(400, "invalid_measurement", "Invalid measurement");
  }
  const normalizedTemperature =
    temp.unit === "F" || temp.unit === "°F"
      ? ((temp.value - 32) * 5) / 9
      : temp.value;
  const now = Date.now();
  if (
    normalizedTemperature < -100 ||
    normalizedTemperature > 100 ||
    humid.value < 0 ||
    humid.value > 100 ||
    timestamp > now + 300_000 ||
    timestamp < now - 90 * 24 * 60 * 60 * 1000
  ) {
    return invalid(400, "measurement_out_of_range", "Measurement out of range");
  }
  const result = await ctx.runMutation(internal.environmentalDevices.ingest, {
    credential,
    readingId: payload.readingId,
    probeId: payload.probeId,
    observedAt: timestamp,
    temperature: normalizedTemperature,
    humidity: humid.value,
  });
  if (!result.accepted) {
    return json(result.rateLimited ? 429 : result.conflict ? 409 : 401, {
      accepted: result.duplicate,
      duplicate: result.duplicate,
      error: result.rateLimited
        ? "rate_limit_exceeded"
        : result.conflict
          ? "reading_id_conflict"
          : "invalid_reading_or_device",
    });
  }
  return json(result.duplicate ? 200 : 202, {
    accepted: true,
    duplicate: result.duplicate,
  });
});

http.route({
  path: "/v1/environmental-readings",
  method: "POST",
  handler: receiveEnvironmentalReading,
});

http.route({
  path: "/v1/objects",
  method: "GET",
  handler: listObjects,
});

export default http;
