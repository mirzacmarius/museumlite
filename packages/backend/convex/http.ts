import type { Product } from "@polar-sh/sdk/models/components/product.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { env } from "./env";

const http = httpRouter();

auth.addHttpRoutes(http);

function encodeBase64(value: string) {
  return btoa(value);
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
    createdAt: subscription.createdAt.toISOString(),
    modifiedAt: subscription.modifiedAt?.toISOString() ?? null,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    startedAt: subscription.startedAt?.toISOString() ?? null,
    endedAt: subscription.endedAt?.toISOString() ?? null,
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

const integrationWebhook = httpAction(async (ctx, request) => {
  const { Webhook } = await import("standardwebhooks");

  const webhookSecret =
    env.POLAR_INTEGRATIONS_WEBHOOK_SECRET ?? env.POLAR_WEBHOOK_SECRET;

  const body = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  let payload: {
    type: string;
    data: {
      id: string;
      product_id: string;
      customer_id: string;
      status: string;
      cancel_at_period_end: boolean;
      current_period_end: string;
      metadata?: Record<string, unknown>;
    };
  };

  try {
    const wh = new Webhook(webhookSecret);
    payload = wh.verify(body, headers) as typeof payload;
  } catch {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  const isSubscriptionEvent =
    payload.type === "subscription.created" ||
    payload.type === "subscription.updated" ||
    payload.type === "subscription.canceled";

  if (!isSubscriptionEvent) {
    return new Response("OK", { status: 200 });
  }

  const metadata = payload.data.metadata;
  if (!metadata?.organizationId || !metadata?.integrationId) {
    return new Response("OK", { status: 200 });
  }

  const statusMap: Record<
    string,
    "active" | "canceled" | "past_due" | "unpaid" | "incomplete"
  > = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    unpaid: "unpaid",
    incomplete: "incomplete",
  };

  const status = statusMap[payload.data.status] ?? "incomplete";

  await ctx.runMutation(internal.integrations.upsertIntegrationSubscription, {
    organizationId: metadata.organizationId as Id<"organizations">,
    integrationId: metadata.integrationId as string,
    productId: payload.data.product_id,
    subscriptionId: payload.data.id,
    customerId: payload.data.customer_id,
    status,
    cancelAtPeriodEnd: payload.data.cancel_at_period_end,
    currentPeriodEnd: new Date(payload.data.current_period_end).getTime(),
    metadata,
  });

  return new Response("OK", { status: 200 });
});

http.route({
  path: "/polar/events",
  method: "POST",
  handler: billingWebhook,
});

http.route({
  path: "/integrations/polar/webhook",
  method: "POST",
  handler: integrationWebhook,
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

http.route({
  path: "/v1/objects",
  method: "GET",
  handler: listObjects,
});

export default http;
