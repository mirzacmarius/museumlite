import type { Product } from "@polar-sh/sdk/models/components/product.js";
import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  type DatabaseProductRecord,
  type SubscriptionRecordSource,
  toDatabaseProduct,
  toDatabaseSubscription,
} from "./polarBilling";

export async function syncPolarProduct(
  ctx: ActionCtx,
  product: Product,
): Promise<void> {
  const existingProducts = await ctx.runQuery(
    components.polar.lib.listProducts,
    {
      includeArchived: true,
    },
  );
  const matchingProducts = existingProducts.filter(
    (item: (typeof existingProducts)[number]) => item.id === product.id,
  );
  const nextProduct: DatabaseProductRecord = toDatabaseProduct(product);

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

export async function syncPolarSubscription(
  ctx: ActionCtx,
  subscription: SubscriptionRecordSource,
): Promise<void> {
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
