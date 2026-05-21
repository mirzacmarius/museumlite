import { getAuthUserId } from "@convex-dev/auth/server";
import { Polar } from "@convex-dev/polar";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import { ConvexError, v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import {
  syncPolarProduct,
  syncPolarSubscription,
} from "./utils/polarComponentSync";
import {
  hasActiveSubscriptionAccess,
  inferSubscriptionTierFromProductName,
  type SubscriptionRecordSource,
} from "./utils/polarBilling";

export const polar = new Polar(components.polar, {
  getUserInfo: async (ctx): Promise<{ userId: Id<"users">; email: string }> => {
    const user = await ctx.runQuery(api.users.getUser);
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.email) {
      throw new Error("User email is required");
    }
    return {
      userId: user._id,
      email: user.email,
    };
  },
});

const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("canceled"),
  v.literal("past_due"),
  v.literal("unpaid"),
  v.literal("incomplete"),
);

const recurringIntervalValidator = v.optional(
  v.union(v.literal("month"), v.literal("year")),
);

const organizationSubscriptionValidator = v.object({
  organizationId: v.id("organizations"),
  tier: v.union(v.literal("pro"), v.literal("enterprise")),
  productId: v.string(),
  productName: v.string(),
  productDescription: v.union(v.string(), v.null()),
  subscriptionId: v.string(),
  customerId: v.string(),
  recurringInterval: v.union(v.literal("month"), v.literal("year"), v.null()),
  status: subscriptionStatusValidator,
  cancelAtPeriodEnd: v.boolean(),
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.union(v.number(), v.null()),
  isEntitled: v.boolean(),
});

export const billingProductValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  recurringInterval: v.union(v.literal("month"), v.literal("year"), v.null()),
  prices: v.array(
    v.object({
      priceAmount: v.optional(v.number()),
    }),
  ),
});

const polarWebhookSubscriptionValidator = v.object({
  webhookId: v.string(),
  eventType: v.string(),
  id: v.string(),
  customerId: v.string(),
  productId: v.string(),
  productName: v.string(),
  productDescription: v.union(v.string(), v.null()),
  priceId: v.string(),
  checkoutId: v.union(v.string(), v.null()),
  amount: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  recurringInterval: v.union(v.literal("month"), v.literal("year"), v.null()),
  status: v.string(),
  createdAt: v.string(),
  modifiedAt: v.union(v.string(), v.null()),
  currentPeriodStart: v.string(),
  currentPeriodEnd: v.union(v.string(), v.null()),
  cancelAtPeriodEnd: v.boolean(),
  startedAt: v.union(v.string(), v.null()),
  endedAt: v.union(v.string(), v.null()),
  metadata: v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
  organizationId: v.optional(v.string()),
});

interface PolarWebhookSubscriptionPayload {
  webhookId: string;
  eventType: string;
  id: string;
  customerId: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  priceId: string;
  checkoutId: string | null;
  amount: number | null;
  currency: string | null;
  recurringInterval: "month" | "year" | null;
  status: string;
  createdAt: string;
  modifiedAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string | null;
  endedAt: string | null;
  metadata: Record<string, string | number | boolean>;
  organizationId?: string;
}

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

function getTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function mapComponentProductToBillingProduct(
  product: {
    id: string;
    name: string;
    description: string | null;
    recurringInterval: "month" | "year" | null;
    prices: Array<{ priceAmount?: number }>;
  },
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    recurringInterval: product.recurringInterval,
    prices: product.prices.map((price) => ({
      priceAmount: price.priceAmount,
    })),
  };
}

function webhookSubscriptionToRecordSource(
  args: PolarWebhookSubscriptionPayload,
): SubscriptionRecordSource {
  return {
    id: args.id,
    customerId: args.customerId,
    createdAt: args.createdAt,
    modifiedAt: args.modifiedAt,
    productId: args.productId,
    priceId: args.priceId,
    checkoutId: args.checkoutId,
    amount: args.amount,
    currency: args.currency,
    recurringInterval: args.recurringInterval,
    status: args.status,
    currentPeriodStart: args.currentPeriodStart,
    currentPeriodEnd: args.currentPeriodEnd,
    cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    startedAt: args.startedAt,
    endedAt: args.endedAt,
    metadata: args.metadata,
  };
}

async function requireBillingPermission(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
) {
  const canManageBilling = await ctx.runQuery(api.roles.checkPermission, {
    organizationId,
    permissionName: "organization.manage_settings",
  });

  if (!canManageBilling) {
    throw new ConvexError("Not authorized to manage billing");
  }
}

async function ensurePolarCustomer(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    email?: string;
  },
) {
  const existingCustomer = await polar.getCustomerByUserId(ctx, args.userId);
  if (existingCustomer) {
    return existingCustomer;
  }

  if (!args.email) {
    throw new ConvexError("A verified billing email is required");
  }

  const customers = await polar.sdk.customers.list({
    email: args.email,
    limit: 1,
  });
  const matchedCustomer =
    customers.result.items.find(
      (customer) => customer.email.toLowerCase() === args.email?.toLowerCase(),
    ) ?? null;

  if (matchedCustomer) {
    await ctx.runMutation(components.polar.lib.upsertCustomer, {
      userId: args.userId,
      customerId: matchedCustomer.id,
    });

    return {
      id: matchedCustomer.id,
      userId: args.userId,
    };
  }

  const createdCustomer = await polar.sdk.customers.create({
    email: args.email,
    metadata: {
      userId: args.userId,
    },
  });

  await ctx.runMutation(components.polar.lib.upsertCustomer, {
    userId: args.userId,
    customerId: createdCustomer.id,
  });

  return {
    id: createdCustomer.id,
    userId: args.userId,
  };
}

async function getActiveOrganizationSubscriptionFromPolar(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    organizationId: Id<"organizations">;
    email?: string;
  },
) {
  const customer = await ensurePolarCustomer(ctx, {
    userId: args.userId,
    email: args.email,
  });
  const subscriptions = await polar.sdk.subscriptions.list({
    customerId: customer.id,
    active: true,
    limit: 100,
  });

  return (
    subscriptions.result.items.find(
      (subscription) =>
        subscription.metadata?.organizationId === args.organizationId,
    ) ?? null
  );
}

export const resolveOrganizationId = internalQuery({
  args: {
    organizationId: v.string(),
  },
  returns: v.union(v.id("organizations"), v.null()),
  handler: async (ctx, args) => {
    const organizationId = ctx.db.normalizeId(
      "organizations",
      args.organizationId,
    );
    if (!organizationId) {
      return null;
    }

    const organization = await ctx.db.get(organizationId);
    return organization?._id ?? null;
  },
});

export const claimPolarWebhook = internalMutation({
  args: {
    webhookId: v.string(),
    eventType: v.string(),
  },
  returns: v.object({ claimed: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("polarWebhookEvents")
      .withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
      .first();

    if (existing) {
      return { claimed: false };
    }

    await ctx.db.insert("polarWebhookEvents", {
      webhookId: args.webhookId,
      eventType: args.eventType,
      processedAt: Date.now(),
    });

    return { claimed: true };
  },
});

export const upsertOrganizationSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    tier: v.union(v.literal("pro"), v.literal("enterprise")),
    productId: v.string(),
    productName: v.string(),
    productDescription: v.union(v.string(), v.null()),
    subscriptionId: v.string(),
    customerId: v.string(),
    recurringInterval: recurringIntervalValidator,
    status: subscriptionStatusValidator,
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.optional(v.number()),
    metadata: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const existing = await ctx.db
      .query("organizationSubscriptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    const now = Date.now();
    const isEntitled = hasActiveSubscriptionAccess({
      status: args.status,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodEnd: args.currentPeriodEnd ?? null,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        productId: args.productId,
        productName: args.productName,
        productDescription: args.productDescription,
        subscriptionId: args.subscriptionId,
        customerId: args.customerId,
        recurringInterval: args.recurringInterval,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        isEntitled,
        metadata: args.metadata,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("organizationSubscriptions", {
        organizationId: args.organizationId,
        tier: args.tier,
        productId: args.productId,
        productName: args.productName,
        productDescription: args.productDescription,
        subscriptionId: args.subscriptionId,
        customerId: args.customerId,
        recurringInterval: args.recurringInterval,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        isEntitled,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.organizationId, {
      subscriptionTier: isEntitled ? args.tier : "free",
    });

    return null;
  },
});

export const getOrganizationSubscription = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(organizationSubscriptionValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .unique();

    if (!membership) {
      return null;
    }

    const subscription = await ctx.db
      .query("organizationSubscriptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!subscription) {
      return null;
    }

    const currentPeriodEnd = subscription.currentPeriodEnd ?? null;
    const isEntitled =
      subscription.isEntitled ??
      hasActiveSubscriptionAccess({
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd,
      });

    return {
      organizationId: subscription.organizationId,
      tier: subscription.tier,
      productId: subscription.productId,
      productName: subscription.productName ?? subscription.tier,
      productDescription: subscription.productDescription ?? null,
      subscriptionId: subscription.subscriptionId,
      customerId: subscription.customerId,
      recurringInterval: subscription.recurringInterval ?? null,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd,
      isEntitled,
    };
  },
});

export const listCatalogProducts = query({
  args: {},
  returns: v.array(billingProductValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const products = await ctx.runQuery(components.polar.lib.listProducts, {
      includeArchived: false,
    });

    return products.map(mapComponentProductToBillingProduct);
  },
});

export const syncAllCatalogProducts = internalAction({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const products = await polar.sdk.products.list({
      isArchived: false,
    });
    const items = products.result?.items ?? [];

    await Promise.all(
      Array.from(items).map((product) => syncPolarProduct(ctx, product)),
    );

    return { count: items.length };
  },
});

export const applyBillingSubscriptionEvent = internalAction({
  args: polarWebhookSubscriptionValidator,
  returns: v.object({ processed: v.boolean() }),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.subscriptions.claimPolarWebhook, {
      webhookId: args.webhookId,
      eventType: args.eventType,
    });

    if (!claim.claimed) {
      return { processed: false };
    }

    const subscriptionRecord = webhookSubscriptionToRecordSource(args);
    await syncPolarSubscription(ctx, subscriptionRecord);

    const organizationIdString =
      args.organizationId ??
      (typeof args.metadata.organizationId === "string"
        ? args.metadata.organizationId
        : undefined);

    if (!organizationIdString) {
      return { processed: true };
    }

    const organizationId = await ctx.runQuery(
      internal.subscriptions.resolveOrganizationId,
      { organizationId: organizationIdString },
    );

    if (!organizationId) {
      console.warn(
        `Skipping organization billing sync for unknown organization ${organizationIdString}`,
      );
      return { processed: true };
    }

    const tier =
      (args.metadata.tier === "enterprise"
        ? "enterprise"
        : args.metadata.tier === "pro"
          ? "pro"
          : null) ?? inferSubscriptionTierFromProductName(args.productName);

    if (!tier) {
      return { processed: true };
    }

    const currentPeriodStart =
      getTimestamp(args.currentPeriodStart) ?? Date.now();
    const currentPeriodEnd = getTimestamp(args.currentPeriodEnd) ?? undefined;

    await ctx.runMutation(internal.subscriptions.upsertOrganizationSubscription, {
      organizationId,
      tier,
      productId: args.productId,
      productName: args.productName,
      productDescription: args.productDescription,
      subscriptionId: args.id,
      customerId: args.customerId,
      recurringInterval: args.recurringInterval ?? undefined,
      status: normalizeSubscriptionStatus(args.status),
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodStart,
      currentPeriodEnd,
      metadata: args.metadata,
    });

    return { processed: true };
  },
});

export const applyBillingProductEvent = internalAction({
  args: {
    webhookId: v.string(),
    eventType: v.string(),
    product: v.any(),
  },
  returns: v.object({ processed: v.boolean() }),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.subscriptions.claimPolarWebhook, {
      webhookId: args.webhookId,
      eventType: args.eventType,
    });

    if (!claim.claimed) {
      return { processed: false };
    }

    await syncPolarProduct(ctx, args.product as Product);
    return { processed: true };
  },
});

export const createOrganizationCheckoutLink = action({
  args: {
    organizationId: v.id("organizations"),
    productId: v.string(),
    successUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    await requireBillingPermission(ctx, args.organizationId);

    const currentUser = await ctx.runQuery(api.users.getUser, {});
    if (!currentUser?.email) {
      throw new ConvexError("A verified billing email is required");
    }

    const product = await polar.sdk.products.get({
      id: args.productId,
    });
    if (!product || product.isArchived) {
      throw new ConvexError("Billing plan is not available");
    }

    const tier = inferSubscriptionTierFromProductName(product.name);
    if (!tier) {
      throw new ConvexError("Unsupported billing plan");
    }

    const customer = await ensurePolarCustomer(ctx, {
      userId,
      email: currentUser.email,
    });

    const checkout = await polar.sdk.checkouts.create({
      allowDiscountCodes: true,
      customerId: customer.id,
      productId: args.productId,
      successUrl: args.successUrl,
      metadata: {
        organizationId: args.organizationId,
        tier,
      },
    });

    return { url: checkout.url };
  },
});

export const syncOrganizationSubscription = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({ synced: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    await requireBillingPermission(ctx, args.organizationId);

    const currentUser = await ctx.runQuery(api.users.getUser, {});
    const subscription = await getActiveOrganizationSubscriptionFromPolar(ctx, {
      userId,
      organizationId: args.organizationId,
      email: currentUser?.email,
    });

    if (!subscription) {
      return { synced: false };
    }

    const tier =
      inferSubscriptionTierFromProductName(subscription.product.name) ??
      (subscription.metadata?.tier === "enterprise"
        ? "enterprise"
        : subscription.metadata?.tier === "pro"
          ? "pro"
          : null);

    if (!tier) {
      return { synced: false };
    }

    await syncPolarSubscription(ctx, subscription);

    await ctx.runMutation(
      internal.subscriptions.upsertOrganizationSubscription,
      {
        organizationId: args.organizationId,
        tier,
        productId: subscription.productId,
        productName: subscription.product.name,
        productDescription: subscription.product.description,
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        recurringInterval: subscription.recurringInterval ?? undefined,
        status: normalizeSubscriptionStatus(subscription.status),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodStart:
          getTimestamp(subscription.currentPeriodStart.toISOString()) ??
          Date.now(),
        currentPeriodEnd:
          getTimestamp(subscription.currentPeriodEnd?.toISOString() ?? null) ??
          undefined,
        metadata: subscription.metadata,
      },
    );

    return { synced: true };
  },
});

export const changeOrganizationSubscriptionPlan = action({
  args: {
    organizationId: v.id("organizations"),
    productId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    await requireBillingPermission(ctx, args.organizationId);

    const currentUser = await ctx.runQuery(api.users.getUser, {});
    const [currentSubscription, product] = await Promise.all([
      getActiveOrganizationSubscriptionFromPolar(ctx, {
        userId,
        organizationId: args.organizationId,
        email: currentUser?.email,
      }),
      polar.sdk.products.get({
        id: args.productId,
      }),
    ]);
    if (!currentSubscription) {
      throw new ConvexError("Subscription not found");
    }

    if (currentSubscription.metadata?.organizationId !== args.organizationId) {
      throw new ConvexError(
        "Subscription does not belong to this organization",
      );
    }
    if (currentSubscription.productId === args.productId) {
      throw new ConvexError("Subscription already on this plan");
    }
    if (!product || product.isArchived) {
      throw new ConvexError("Billing plan is not available");
    }

    const tier = inferSubscriptionTierFromProductName(product.name);
    if (!tier) {
      throw new ConvexError("Unsupported billing plan");
    }

    const updatedSubscription = await polar.sdk.subscriptions.update({
      id: currentSubscription.id,
      subscriptionUpdate: {
        productId: args.productId,
      },
    });

    await Promise.all([
      syncPolarSubscription(ctx, updatedSubscription),
      ctx.runMutation(internal.subscriptions.upsertOrganizationSubscription, {
        organizationId: args.organizationId,
        tier,
        productId: updatedSubscription.productId,
        productName: product.name,
        productDescription: product.description,
        subscriptionId: updatedSubscription.id,
        customerId: updatedSubscription.customerId,
        recurringInterval: updatedSubscription.recurringInterval ?? undefined,
        status: normalizeSubscriptionStatus(updatedSubscription.status),
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        currentPeriodStart:
          getTimestamp(updatedSubscription.currentPeriodStart.toISOString()) ??
          Date.now(),
        currentPeriodEnd:
          getTimestamp(
            updatedSubscription.currentPeriodEnd?.toISOString() ?? null,
          ) ?? undefined,
        metadata: updatedSubscription.metadata,
      }),
    ]);

    return null;
  },
});

export const createOrganizationCustomerPortalUrl = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    await requireBillingPermission(ctx, args.organizationId);

    const currentUser = await ctx.runQuery(api.users.getUser, {});
    const customer = await ensurePolarCustomer(ctx, {
      userId,
      email: currentUser?.email,
    });

    const session = await polar.sdk.customerSessions.create({
      customerId: customer.id,
    });

    return { url: session.customerPortalUrl };
  },
});
