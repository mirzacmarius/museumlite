import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { polar } from "./subscriptions";
import {
  BILLING_PLAN_DEFINITIONS,
  toDatabaseProduct,
} from "./utils/polarBilling";

// Create Polar products, the Convex Polar component will sync them
// back to the database via webhook.
export default internalAction(async (ctx) => {
  const products = await polar.sdk.products.list({
    isArchived: false,
  });
  const existingProducts = products?.result?.items ?? [];

  let createdCount = 0;

  const createResults = await Promise.all(
    BILLING_PLAN_DEFINITIONS.map(async (plan) => {
      const existing = existingProducts.find(
        (product) =>
          product.name === plan.name &&
          product.recurringInterval === plan.interval,
      );

      if (existing) {
        return false;
      }

      await polar.sdk.products.create({
        name: plan.name,
        description: plan.description,
        recurringInterval: plan.interval,
        prices: [
          {
            priceAmount: plan.priceAmount,
            amountType: "fixed",
          },
        ],
      });
      return true;
    }),
  );
  createdCount = createResults.filter(Boolean).length;

  if (createdCount === 0) {
    console.info("🏃‍♂️ Billing products already exist. Skipping creation.");
  } else {
    console.info(`📦 Created ${createdCount} Polar billing product(s).`);
  }

  const refreshedProducts = await polar.sdk.products.list({
    isArchived: false,
  });
  const items = refreshedProducts.result?.items ?? [];
  const componentProducts = await ctx.runQuery(
    components.polar.lib.listProducts,
    {
      includeArchived: true,
    },
  );

  await Promise.all(
    items.map(async (product) => {
      const matchingProducts = componentProducts.filter(
        (item: (typeof componentProducts)[number]) => item.id === product.id,
      );
      const nextProduct = toDatabaseProduct(product);

      if (matchingProducts.length > 1) {
        console.warn(
          `Skipping Convex product sync for ${product.id} because duplicate rows already exist.`,
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
    }),
  );

  console.info(`🔄 Synced ${items.length} billing product(s) into Convex.`);
});
