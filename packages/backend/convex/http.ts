import type { Product } from "@polar-sh/sdk/models/components/product.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { httpRouter } from "convex/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { auth } from "./auth";
import { env } from "./env";
import {
  inferSubscriptionTierFromProductName,
  toDatabaseProduct,
  toDatabaseSubscription,
} from "./utils/polarBilling";

const http = httpRouter();

auth.addHttpRoutes(http);

function normalizeSubscriptionStatus(
  status: string,
): "active" | "canceled" | "past_due" | "unpaid" | "incomplete" {
  switch (status) {
    case "active":
    case "canceled":
    case "past_due":
    case "unpaid":
    case "incomplete":
      return status;
    default:
      return "incomplete";
  }
}

function encodeBase64(value: string) {
  return btoa(value);
}

async function upsertPolarProduct(ctx: ActionCtx, product: Product) {
  const existingProducts = await ctx.runQuery(
    components.polar.lib.listProducts,
    {
      includeArchived: true,
    },
  );
  const matchingProducts = existingProducts.filter(
    (item: (typeof existingProducts)[number]) => item.id === product.id,
  );
  const nextProduct = toDatabaseProduct(product);

  if (matchingProducts.length > 1) {
    console.warn(
      `Skipping Polar webhook product sync for ${product.id} because duplicate rows already exist.`,
    );
    return;
  }

  if (matchingProducts.length === 1) {
    await ctx.runMutation(components.polar.lib.updateProduct, {
      product: nextProduct,
    });
    return;
  }

  await ctx.runMutation(components.polar.lib.createProduct, {
    product: nextProduct,
  });
}

async function upsertPolarSubscription(
  ctx: ActionCtx,
  subscription: Subscription,
) {
  const customerSubscriptions = await ctx.runQuery(
    components.polar.lib.listCustomerSubscriptions,
    {
      customerId: subscription.customerId,
    },
  );
  const existing = customerSubscriptions.find(
    (item: (typeof customerSubscriptions)[number]) =>
      item.id === subscription.id,
  );
  const nextSubscription = toDatabaseSubscription(subscription);

  if (existing) {
    await ctx.runMutation(components.polar.lib.updateSubscription, {
      subscription: nextSubscription,
    });
    return;
  }

  await ctx.runMutation(components.polar.lib.createSubscription, {
    subscription: nextSubscription,
  });
}

async function syncOrganizationBillingFromSubscription(
  ctx: ActionCtx,
  subscription: Subscription,
) {
  const organizationId = subscription.metadata?.organizationId;
  if (typeof organizationId !== "string") {
    return;
  }

  const tier =
    (subscription.metadata?.tier === "enterprise"
      ? "enterprise"
      : subscription.metadata?.tier === "pro"
        ? "pro"
        : null) ??
    inferSubscriptionTierFromProductName(subscription.product.name);

  if (!tier) {
    return;
  }

  const currentPeriodStart = Date.parse(
    subscription.currentPeriodStart.toISOString(),
  );
  const currentPeriodEnd = subscription.currentPeriodEnd
    ? Date.parse(subscription.currentPeriodEnd.toISOString())
    : undefined;

  await ctx.runMutation(internal.subscriptions.upsertOrganizationSubscription, {
    organizationId: organizationId as Id<"organizations">,
    tier,
    productId: subscription.productId,
    productName: subscription.product.name,
    productDescription: subscription.product.description,
    subscriptionId: subscription.id,
    customerId: subscription.customerId,
    recurringInterval: subscription.recurringInterval ?? undefined,
    status: normalizeSubscriptionStatus(subscription.status),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodStart,
    currentPeriodEnd,
    metadata: subscription.metadata,
  });
}

const billingWebhook = httpAction(async (ctx, request) => {
  const { Webhook, WebhookVerificationError } = await import(
    "standardwebhooks"
  );

  if (!request.body) {
    return new Response("Missing request body", { status: 400 });
  }

  const body = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

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
        await upsertPolarSubscription(ctx, event.data);
        await syncOrganizationBillingFromSubscription(ctx, event.data);
        break;
      }
      case "product.created":
      case "product.updated": {
        if (!("prices" in event.data)) {
          return new Response("Invalid webhook payload", { status: 400 });
        }
        await upsertPolarProduct(ctx, event.data);
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

export default http;
