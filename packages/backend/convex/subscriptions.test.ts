/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import polarSchema from "../../../node_modules/@convex-dev/polar/src/component/schema";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "../tests/testSetup";
import { hasActiveSubscriptionAccess } from "./utils/polarBilling";

const polarModules = Object.fromEntries(
  Object.entries(
    import.meta.glob(
      "../../../node_modules/@convex-dev/polar/src/component/**/*.{ts,js}",
    ),
  ).filter(([path]) => !path.endsWith(".d.ts")),
);

function createBillingTestContext() {
  const t = convexTest(schema, modules);
  t.registerComponent("polar", polarSchema, polarModules);
  return t;
}

function buildApplyBillingSubscriptionEventPayload(
  organizationId: Id<"organizations"> | string,
  overrides: {
    webhookId?: string;
    eventType?: string;
    subscriptionId?: string;
  } = {},
) {
  const now = new Date().toISOString();

  return {
    webhookId:
      overrides.webhookId ??
      `evt_${Math.random().toString(36).slice(2, 10)}`,
    eventType: overrides.eventType ?? "subscription.updated",
    id: overrides.subscriptionId ?? "sub_apply_billing_test",
    customerId: "cus_apply_billing_test",
    productId: "prod_pro_monthly",
    productName: "Pro",
    productDescription: "Pro plan for growing collections.",
    priceId: "price_pro_monthly",
    checkoutId: null,
    amount: 2900,
    currency: "usd",
    recurringInterval: "month" as const,
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
    organizationId,
  };
}

async function createFreeTierOrganization(
  t: ReturnType<typeof createBillingTestContext>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Apply Billing Event Org",
      slug: `apply-billing-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "free",
    });
  });
}

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

describe("hasActiveSubscriptionAccess", () => {
  test("returns true for active subscriptions", () => {
    expect(
      hasActiveSubscriptionAccess({
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      }),
    ).toBe(true);
  });

  test("returns true for canceled subscriptions still in grace period", () => {
    expect(
      hasActiveSubscriptionAccess({
        status: "canceled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: Date.now() + 60_000,
      }),
    ).toBe(true);
  });

  test("returns false for expired canceled subscriptions", () => {
    expect(
      hasActiveSubscriptionAccess({
        status: "canceled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: Date.now() - 60_000,
      }),
    ).toBe(false);
  });
});

test("upsertOrganizationSubscription persists entitlement and tier", async () => {
  const t = convexTest(schema, modules);

  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Billing Org",
      slug: "billing-org",
      type: "museum",
      subscriptionTier: "free",
    });
  });

  await t.mutation(internal.subscriptions.upsertOrganizationSubscription, {
    organizationId,
    tier: "pro",
    productId: "prod_1",
    productName: "Pro",
    productDescription: "Pro plan",
    subscriptionId: "sub_1",
    customerId: "cus_1",
    recurringInterval: "month",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodStart: Date.now(),
    currentPeriodEnd: Date.now() + 86_400_000,
  });

  const [organization, subscription] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.get(organizationId),
      ctx.db
        .query("organizationSubscriptions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .first(),
    ] as const),
  );

  expect(organization?.subscriptionTier).toBe("pro");
  expect(subscription?.isEntitled).toBe(true);
});

test("claimPolarWebhook rejects duplicate webhook ids", async () => {
  const t = convexTest(schema, modules);

  const first = await t.mutation(internal.subscriptions.claimPolarWebhook, {
    webhookId: "evt_duplicate",
    eventType: "subscription.updated",
  });
  // Sequential: second claim must run after first to assert duplicate rejection.
  const second = await t.mutation(internal.subscriptions.claimPolarWebhook, {
    webhookId: "evt_duplicate",
    eventType: "subscription.updated",
  });

  expect(first).toEqual({ claimed: true });
  expect(second).toEqual({ claimed: false });
});

test("getOrganizationSubscription enforces membership and returns stored entitlement", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, memberUserId, outsiderUserId } = await t.run(
    async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Member Org",
        slug: "member-org",
        type: "museum",
        subscriptionTier: "pro",
      });
      const [memberUserId, outsiderUserId] = await Promise.all([
        ctx.db.insert("users", {
          name: "Member",
          email: "member@example.com",
        }),
        ctx.db.insert("users", {
          name: "Outsider",
          email: "outsider@example.com",
        }),
      ]);
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Member",
        description: "Member role",
        isSystemRole: false,
      });

      await ctx.db.insert("userOrganizations", {
        userId: memberUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });

      await ctx.db.insert("organizationSubscriptions", {
        organizationId,
        tier: "pro",
        productId: "prod_member",
        productName: "Pro",
        productDescription: null,
        subscriptionId: "sub_member",
        customerId: "cus_member",
        recurringInterval: "month",
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 86_400_000,
        isEntitled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { organizationId, memberUserId, outsiderUserId };
    },
  );

  const [outsiderResult, memberResult] = await Promise.all([
    authedForUser(t, outsiderUserId).query(
      api.subscriptions.getOrganizationSubscription,
      { organizationId },
    ),
    authedForUser(t, memberUserId).query(
      api.subscriptions.getOrganizationSubscription,
      { organizationId },
    ),
  ]);

  expect(outsiderResult).toBeNull();
  expect(memberResult?.isEntitled).toBe(true);
  expect(memberResult?.tier).toBe("pro");
});

describe("applyBillingSubscriptionEvent", () => {
  test("subscription.updated updates org tier and persists subscription row", async () => {
    const t = createBillingTestContext();
    const organizationId = await createFreeTierOrganization(t);
    const payload = buildApplyBillingSubscriptionEventPayload(organizationId);

    const result = await t.action(
      internal.subscriptions.applyBillingSubscriptionEvent,
      payload,
    );

    expect(result).toEqual({ processed: true });

    const [organization, subscription, webhookEvent] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(organizationId),
        ctx.db
          .query("organizationSubscriptions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .first(),
        ctx.db
          .query("polarWebhookEvents")
          .withIndex("by_webhook_id", (q) => q.eq("webhookId", payload.webhookId))
          .unique(),
      ] as const),
    );

    expect(organization?.subscriptionTier).toBe("pro");
    expect(subscription?.subscriptionId).toBe(payload.id);
    expect(subscription?.status).toBe("active");
    expect(subscription?.isEntitled).toBe(true);
    expect(webhookEvent?.eventType).toBe("subscription.updated");
  });

  test("rejects duplicate webhook ids without changing billing state", async () => {
    const t = createBillingTestContext();
    const organizationId = await createFreeTierOrganization(t);
    const webhookId = "evt_duplicate_apply_billing";
    const payload = buildApplyBillingSubscriptionEventPayload(organizationId, {
      webhookId,
      subscriptionId: "sub_duplicate_apply_billing",
    });

    const first = await t.action(
      internal.subscriptions.applyBillingSubscriptionEvent,
      payload,
    );
    const second = await t.action(
      internal.subscriptions.applyBillingSubscriptionEvent,
      payload,
    );

    expect(first).toEqual({ processed: true });
    expect(second).toEqual({ processed: false });

    const webhookEvents = await t.run(async (ctx) => {
      return await ctx.db
        .query("polarWebhookEvents")
        .withIndex("by_webhook_id", (q) => q.eq("webhookId", webhookId))
        .collect();
    });

    expect(webhookEvents).toHaveLength(1);
  });

  test("unknown organization id returns processed without tier change", async () => {
    const t = createBillingTestContext();
    const organizationId = await createFreeTierOrganization(t);
    const unknownOrganizationId = await t.run(async (ctx) => {
      const deletedOrganizationId = await ctx.db.insert("organizations", {
        name: "Deleted Org",
        slug: `deleted-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        subscriptionTier: "free",
      });
      await ctx.db.delete(deletedOrganizationId);
      return deletedOrganizationId;
    });
    const payload = buildApplyBillingSubscriptionEventPayload(
      unknownOrganizationId,
      { subscriptionId: "sub_unknown_org_apply_billing" },
    );

    const result = await t.action(
      internal.subscriptions.applyBillingSubscriptionEvent,
      payload,
    );

    expect(result).toEqual({ processed: true });

    const [organization, subscription] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(organizationId),
        ctx.db
          .query("organizationSubscriptions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .first(),
      ] as const),
    );

    expect(organization?.subscriptionTier).toBe("free");
    expect(subscription).toBeNull();
  });
});
