import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { polar } from "./subscriptions";
import { BILLING_PLAN_DEFINITIONS } from "./utils/polarBilling";

// Create Polar products, the Convex Polar component will sync them
// back to the database via webhook.
export default internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
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

    const { count } = await ctx.runAction(
      internal.subscriptions.syncAllCatalogProducts,
      {},
    );

    console.info(`🔄 Synced ${count} billing product(s) into Convex.`);
    return null;
  },
});
