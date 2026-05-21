import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "../tests/testSetup";
import { hasActiveSubscriptionAccess } from "./utils/polarBilling";

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
