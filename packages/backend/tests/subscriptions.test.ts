import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

async function createUser(
  t: ReturnType<typeof convexTest<typeof schema>>,
  email?: string,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      ...(email ? { email } : {}),
    });
  });
}

async function createOrganization(
  t: ReturnType<typeof convexTest<typeof schema>>,
  tier: "free" | "pro" | "enterprise" = "free",
  ownerUserId?: Awaited<ReturnType<typeof createUser>>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Billing Org",
      slug: `billing-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: tier,
      ...(ownerUserId ? { ownerUserId } : {}),
    });
  });
}

describe("organization subscriptions", () => {
  test("active subscription upgrades the organization tier", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await createOrganization(t);

    await t.mutation(internal.subscriptions.upsertOrganizationSubscription, {
      organizationId,
      tier: "pro",
      productId: "prod_pro_monthly",
      productName: "Pro",
      productDescription:
        "Advanced workflows and reporting for growing collections.",
      subscriptionId: "sub_active",
      customerId: "cus_active",
      recurringInterval: "month",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 86_400_000,
      metadata: {
        organizationId,
        tier: "pro",
      },
    });

    const [organization, subscription] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(organizationId);
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("organizationSubscriptions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .first();
      }),
    ]);
    expect(organization?.subscriptionTier).toBe("pro");
    expect(subscription?.productId).toBe("prod_pro_monthly");
    expect(subscription?.status).toBe("active");
  });

  test("billing email helper returns the owner email when available", async () => {
    const t = convexTest(schema, modules);
    const ownerUserId = await createUser(t, "owner@example.com");
    const organizationId = await createOrganization(t, "free", ownerUserId);

    const billingEmail = await t.query(
      internal.subscriptions.getOrganizationBillingEmail,
      { organizationId },
    );

    expect(billingEmail).toEqual({ email: "owner@example.com" });
  });

  test("billing email helper returns null without an owner email", async () => {
    const t = convexTest(schema, modules);
    const ownerUserId = await createUser(t);
    const organizationId = await createOrganization(t, "free", ownerUserId);

    const billingEmail = await t.query(
      internal.subscriptions.getOrganizationBillingEmail,
      { organizationId },
    );

    expect(billingEmail).toBeNull();
  });

  test("billing email helper returns null without an owner", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await createOrganization(t);

    const billingEmail = await t.query(
      internal.subscriptions.getOrganizationBillingEmail,
      { organizationId },
    );

    expect(billingEmail).toBeNull();
  });

  test("canceling at period end keeps the paid tier until access expires", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await createOrganization(t, "pro");

    await t.mutation(internal.subscriptions.upsertOrganizationSubscription, {
      organizationId,
      tier: "pro",
      productId: "prod_pro_monthly",
      productName: "Pro",
      productDescription:
        "Advanced workflows and reporting for growing collections.",
      subscriptionId: "sub_canceling",
      customerId: "cus_canceling",
      recurringInterval: "month",
      status: "canceled",
      cancelAtPeriodEnd: true,
      currentPeriodStart: Date.now() - 86_400_000,
      currentPeriodEnd: Date.now() + 86_400_000,
      metadata: {
        organizationId,
        tier: "pro",
      },
    });

    const organization = await t.run(async (ctx) => {
      return await ctx.db.get(organizationId);
    });

    expect(organization?.subscriptionTier).toBe("pro");
  });

  test("ended subscriptions downgrade the organization to free", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await createOrganization(t, "enterprise");

    await t.mutation(internal.subscriptions.upsertOrganizationSubscription, {
      organizationId,
      tier: "enterprise",
      productId: "prod_enterprise_yearly",
      productName: "Enterprise",
      productDescription:
        "Unlimited capacity and premium controls for larger teams.",
      subscriptionId: "sub_ended",
      customerId: "cus_ended",
      recurringInterval: "year",
      status: "canceled",
      cancelAtPeriodEnd: false,
      currentPeriodStart: Date.now() - 172_800_000,
      currentPeriodEnd: Date.now() - 86_400_000,
      metadata: {
        organizationId,
        tier: "enterprise",
      },
    });

    const organization = await t.run(async (ctx) => {
      return await ctx.db.get(organizationId);
    });

    expect(organization?.subscriptionTier).toBe("free");
  });
});
