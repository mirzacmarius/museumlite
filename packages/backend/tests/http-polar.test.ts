import { convexTest } from "convex-test";
import { Webhook } from "standardwebhooks";
import { beforeAll, describe, expect, test, vi } from "vitest";
import polarSchema from "../../../node_modules/@convex-dev/polar/src/component/schema";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

const TEST_WEBHOOK_SECRET = "test-polar-webhook-secret";

const polarModules = Object.fromEntries(
  Object.entries(
    import.meta.glob(
      "../../../node_modules/@convex-dev/polar/src/component/**/*.{ts,js}",
    ),
  ).filter(([path]) => !path.endsWith(".d.ts")),
);

vi.hoisted(() => {
  process.env.POLAR_WEBHOOK_SECRET = "test-polar-webhook-secret";
});

function createTestContext() {
  const t = convexTest(schema, modules);
  t.registerComponent("polar", polarSchema, polarModules);
  return t;
}

function encodeBase64(value: string) {
  return btoa(value);
}

function signPolarWebhookPayload(body: string, webhookId: string) {
  const webhook = new Webhook(encodeBase64(TEST_WEBHOOK_SECRET));
  const timestamp = new Date();
  const signature = webhook.sign(webhookId, timestamp, body);

  return {
    "webhook-id": webhookId,
    "webhook-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "webhook-signature": signature,
  };
}

function buildSubscriptionUpdatedEvent(organizationId: Id<"organizations">) {
  const now = new Date().toISOString();

  return {
    type: "subscription.updated",
    data: {
      id: "sub_http_test",
      customerId: "cus_http_test",
      productId: "prod_pro_monthly",
      priceId: "price_pro_monthly",
      checkoutId: null,
      amount: 2900,
      currency: "usd",
      recurringInterval: "month",
      status: "active",
      createdAt: now,
      modifiedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
      cancelAtPeriodEnd: false,
      startedAt: now,
      endedAt: null,
      metadata: {
        organizationId,
        tier: "pro",
      },
      product: {
        name: "Pro",
        description: "Pro plan for growing collections.",
      },
    },
  };
}

async function createBillingOrganization(
  t: ReturnType<typeof convexTest<typeof schema>>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Polar Webhook Org",
      slug: `polar-webhook-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "free",
    });
  });
}

describe("POST /polar/events", () => {
  beforeAll(() => {
    process.env.POLAR_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });

  test("returns 403 when webhook signature is invalid", async () => {
    const t = createTestContext();
    const organizationId = await createBillingOrganization(t);
    const body = JSON.stringify(buildSubscriptionUpdatedEvent(organizationId));

    const response = await t.fetch("/polar/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": "evt_invalid_signature",
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
        "webhook-signature": "v1,invalidsignature",
      },
      body,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  test("returns 403 when required webhook headers are missing", async () => {
    const t = createTestContext();
    const organizationId = await createBillingOrganization(t);
    const body = JSON.stringify(buildSubscriptionUpdatedEvent(organizationId));

    const response = await t.fetch("/polar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  test("accepts a valid signed subscription payload and updates billing state", async () => {
    const t = createTestContext();
    const organizationId = await createBillingOrganization(t);
    const webhookId = `evt_${Math.random().toString(36).slice(2, 10)}`;
    const body = JSON.stringify(buildSubscriptionUpdatedEvent(organizationId));
    const headers = signPolarWebhookPayload(body, webhookId);

    const response = await t.fetch("/polar/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("Accepted");

    const [webhookEvent, organization, subscription] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db
          .query("polarWebhookEvents")
          .withIndex("by_webhook_id", (q) => q.eq("webhookId", webhookId))
          .unique();
      }),
      t.run(async (ctx) => ctx.db.get(organizationId)),
      t.run(async (ctx) => {
        return await ctx.db
          .query("organizationSubscriptions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .first();
      }),
    ]);

    expect(webhookEvent?.eventType).toBe("subscription.updated");
    expect(organization?.subscriptionTier).toBe("pro");
    expect(subscription?.subscriptionId).toBe("sub_http_test");
    expect(subscription?.status).toBe("active");
  });
});
