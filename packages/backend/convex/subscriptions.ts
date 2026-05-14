import { Polar } from "@convex-dev/polar";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalMutation,
  query,
} from "./_generated/server";
import {
  hasActiveSubscriptionAccess,
  inferSubscriptionTierFromProductName,
  toDatabaseProduct,
  type SubscriptionRecordSource,
  toDatabaseSubscription,
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

const billingProductValidator = v.object({
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

async function upsertComponentSubscription(
  ctx: ActionCtx,
  subscription: SubscriptionRecordSource | null,
) {
  if (!subscription) {
    return;
  }

  const existingSubscriptions = await ctx.runQuery(
    components.polar.lib.listCustomerSubscriptions,
    {
      customerId: subscription.customerId,
    },
  );
  const existing = existingSubscriptions.find(
    (item: (typeof existingSubscriptions)[number]) =>
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

async function upsertComponentProduct(
  ctx: ActionCtx,
  product: Awaited<ReturnType<typeof polar.sdk.products.get>>,
) {
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
      `Skipping Polar component product sync for ${product.id} because duplicate rows already exist.`,
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
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    const isEntitled = hasActiveSubscriptionAccess({
      status: args.status,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodEnd: args.currentPeriodEnd ?? null,
    });

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

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const membership = memberships.find(
      (item) => item.organizationId === args.organizationId,
    );

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
      isEntitled: hasActiveSubscriptionAccess({
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd,
      }),
    };
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

export const syncBillingProducts = action({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const products = await polar.sdk.products.list({
      isArchived: false,
    });
    const items = products.result?.items ?? [];

    await Promise.all(
      items.map((product) => upsertComponentProduct(ctx, product)),
    );

    return { count: items.length };
  },
});

export const listBillingProducts = action({
  args: {},
  returns: v.array(billingProductValidator),
  handler: async () => {
    const products = await polar.sdk.products.list({
      isArchived: false,
    });
    const items = products.result?.items ?? [];

    return items.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      recurringInterval: product.recurringInterval ?? null,
      prices: product.prices.map((price) => ({
        priceAmount:
          price.amountType === "fixed"
            ? price.priceAmount ?? undefined
            : undefined,
      })),
    }));
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
    const currentSubscription =
      await getActiveOrganizationSubscriptionFromPolar(ctx, {
        userId,
        organizationId: args.organizationId,
        email: currentUser?.email,
      });
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

    const updatedSubscription = await polar.sdk.subscriptions.update({
      id: currentSubscription.id,
      subscriptionUpdate: {
        productId: args.productId,
      },
    });

    await upsertComponentSubscription(ctx, updatedSubscription);

    await ctx.runMutation(
      internal.subscriptions.upsertOrganizationSubscription,
      {
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
      },
    );

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

export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  listAllProducts,
} = polar.api();

export const { generateCheckoutLink, generateCustomerPortalUrl } =
  polar.checkoutApi();
