import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { env } from "./env";
import { polar } from "./subscriptions";

const http = httpRouter();

auth.addHttpRoutes(http);

// biome-ignore lint/suspicious/noExplicitAny: Polar component type issue
polar.registerRoutes(http as any);

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
  path: "/integrations/polar/webhook",
  method: "POST",
  handler: integrationWebhook,
});

export default http;
