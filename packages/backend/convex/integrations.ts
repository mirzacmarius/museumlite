import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { env } from "./env";
import { polar } from "./subscriptions";
import { requirePermission } from "./utils/permissions";

// Available integrations in the system
export const AVAILABLE_INTEGRATIONS = [
  {
    id: "library",
    name: "Library Management",
    description:
      "Complete library management system with catalog, patrons, circulation, holds, fines, and acquisitions.",
    icon: "BookOpen",
    features: [
      "Book & media catalog with ISBN lookup",
      "Patron management with library cards",
      "Circulation (checkout/checkin/renewals)",
      "Hold queue management",
      "Fine tracking & payments",
      "Acquisition requests workflow",
      "Serial subscriptions",
      "Reports & statistics",
    ],
    requiresSubscription: true,
  },
] as const;

// Integration IDs that require a paid subscription
export const PAID_INTEGRATIONS = ["library"] as const;

export type IntegrationId = (typeof AVAILABLE_INTEGRATIONS)[number]["id"];

/**
 * Get list of available integrations
 */
export const listAvailable = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.string(),
      icon: v.string(),
      features: v.array(v.string()),
      requiresSubscription: v.boolean(),
    }),
  ),
  handler: async () => {
    return AVAILABLE_INTEGRATIONS.map((integration) => ({
      ...integration,
      features: [...integration.features],
    }));
  },
});

/**
 * Get enabled integrations for an organization
 */
export const getEnabled = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      return [];
    }
    return org.settings?.enabledIntegrations ?? [];
  },
});

/**
 * Check if a specific integration is enabled
 */
export const isEnabled = query({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      return false;
    }
    const enabledIntegrations = org.settings?.enabledIntegrations ?? [];
    return enabledIntegrations.includes(args.integrationId);
  },
});

const enableResultValidator = v.union(
  v.object({ ok: v.literal(true) }),
  v.object({
    ok: v.literal(false),
    reason: v.union(
      v.literal("subscription_required"),
      v.literal("already_enabled"),
    ),
  }),
);

export const enable = mutation({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
  },
  returns: enableResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const validIntegration = AVAILABLE_INTEGRATIONS.find(
      (i) => i.id === args.integrationId,
    );
    if (!validIntegration) {
      throw new Error(`Invalid integration: ${args.integrationId}`);
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const currentSettings = org.settings ?? {};
    const enabledIntegrations = currentSettings.enabledIntegrations ?? [];

    if (enabledIntegrations.includes(args.integrationId)) {
      return { ok: false as const, reason: "already_enabled" as const };
    }

    // Check if integration requires subscription
    if (
      PAID_INTEGRATIONS.includes(
        args.integrationId as (typeof PAID_INTEGRATIONS)[number],
      )
    ) {
      const subscription = await ctx.db
        .query("integrationSubscriptions")
        .withIndex("by_organization_and_integration", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("integrationId", args.integrationId),
        )
        .first();

      const isEntitled =
        subscription &&
        (subscription.status === "active" ||
          (subscription.cancelAtPeriodEnd &&
            subscription.currentPeriodEnd > Date.now()));

      if (!isEntitled) {
        return { ok: false as const, reason: "subscription_required" as const };
      }
    }

    await ctx.db.patch(args.organizationId, {
      settings: {
        ...currentSettings,
        enabledIntegrations: [...enabledIntegrations, args.integrationId],
      },
    });

    if (args.integrationId === "library") {
      await createDefaultLibrarySettings(ctx, args.organizationId, userId);
    }

    return { ok: true as const };
  },
});

/**
 * Disable an integration for an organization
 */
export const disable = mutation({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const currentSettings = org.settings ?? {};
    const enabledIntegrations = currentSettings.enabledIntegrations ?? [];

    // Remove from enabled integrations
    const updatedIntegrations = enabledIntegrations.filter(
      (id) => id !== args.integrationId,
    );

    await ctx.db.patch(args.organizationId, {
      settings: {
        ...currentSettings,
        enabledIntegrations: updatedIntegrations,
      },
    });

    return null;
  },
});

async function createDefaultLibrarySettings(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  _userId: Id<"users">,
) {
  const existingSettings = await ctx.db
    .query("librarySettings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  if (existingSettings) {
    return;
  }

  // Create default settings
  await ctx.db.insert("librarySettings", {
    organizationId,
    defaultLoanPeriodDays: 14,
    defaultRenewalLimit: 2,
    renewalPeriodDays: 14,
    maxRenewalsAllowed: 2,
    finePerDayDefault: 0.25,
    maxFinePerItem: 10,
    gracePeriodDays: 1,
    fineThresholdForBlock: 25,
    holdExpirationDays: 7,
    maxHoldsPerPatron: 10,
    cardNumberPrefix: "LIB",
    cardNumberLength: 10,
    autoGenerateCardNumbers: true,
    classificationSystem: "dewey",
    dueDateReminderDays: 3,
    overdueNoticeDays: [1, 7, 14, 30],
    createdAt: Date.now(),
  });

  // Create default membership types
  await ctx.db.insert("membershipTypes", {
    organizationId,
    name: "Standard",
    description: "Standard library membership",
    borrowingLimit: 10,
    holdLimit: 5,
    loanPeriodDays: 14,
    renewalLimit: 2,
    finePerDay: 0.25,
    gracePeriodDays: 1,
    isDefault: true,
    createdAt: Date.now(),
  });

  await ctx.db.insert("membershipTypes", {
    organizationId,
    name: "Student",
    description: "Student membership with extended limits",
    borrowingLimit: 15,
    holdLimit: 8,
    loanPeriodDays: 21,
    renewalLimit: 3,
    finePerDay: 0.1,
    gracePeriodDays: 3,
    isDefault: false,
    createdAt: Date.now(),
  });

  await ctx.db.insert("membershipTypes", {
    organizationId,
    name: "Senior",
    description: "Senior citizen membership",
    borrowingLimit: 10,
    holdLimit: 5,
    loanPeriodDays: 21,
    renewalLimit: 3,
    finePerDay: 0.1,
    gracePeriodDays: 3,
    isDefault: false,
    createdAt: Date.now(),
  });

  await ctx.db.insert("membershipTypes", {
    organizationId,
    name: "Staff",
    description: "Library staff membership",
    borrowingLimit: 50,
    holdLimit: 20,
    loanPeriodDays: 30,
    renewalLimit: 5,
    finePerDay: 0,
    gracePeriodDays: 7,
    isDefault: false,
    createdAt: Date.now(),
  });
}

export const isIntegrationSubscribed = query({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (
      !PAID_INTEGRATIONS.includes(
        args.integrationId as (typeof PAID_INTEGRATIONS)[number],
      )
    ) {
      return true;
    }

    const subscription = await ctx.db
      .query("integrationSubscriptions")
      .withIndex("by_organization_and_integration", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("integrationId", args.integrationId),
      )
      .first();

    if (!subscription) {
      return false;
    }

    return (
      subscription.status === "active" ||
      (subscription.cancelAtPeriodEnd &&
        subscription.currentPeriodEnd > Date.now())
    );
  },
});

const subscriptionInfoValidator = v.union(
  v.null(),
  v.object({
    subscriptionId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("incomplete"),
    ),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.number(),
    isEntitled: v.boolean(),
  }),
);

export const getSubscription = query({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
  },
  returns: subscriptionInfoValidator,
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("integrationSubscriptions")
      .withIndex("by_organization_and_integration", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("integrationId", args.integrationId),
      )
      .first();

    if (!subscription) {
      return null;
    }

    const isEntitled =
      subscription.status === "active" ||
      (subscription.cancelAtPeriodEnd &&
        subscription.currentPeriodEnd > Date.now());

    return {
      subscriptionId: subscription.subscriptionId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      isEntitled,
    };
  },
});

export const requiresSubscription = query({
  args: {
    integrationId: v.string(),
  },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    return PAID_INTEGRATIONS.includes(
      args.integrationId as (typeof PAID_INTEGRATIONS)[number],
    );
  },
});

export const createCheckoutLink = action({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
    successUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (_ctx, args) => {
    const productIdMap: Record<string, string> = {
      library: env.INTEGRATION_PRODUCT_LIBRARY,
    };
    const productId = productIdMap[args.integrationId];
    if (!productId) {
      throw new Error(
        `No product configured for integration: ${args.integrationId}`,
      );
    }

    const accessToken = env.POLAR_ORGANIZATION_TOKEN;

    const isProduction = process.env.POLAR_MODE === "production";
    const baseUrl = isProduction
      ? "https://api.polar.sh"
      : "https://sandbox-api.polar.sh";

    const response = await fetch(`${baseUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [productId],
        success_url: args.successUrl,
        metadata: {
          organizationId: args.organizationId,
          integrationId: args.integrationId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create checkout: ${errorText}`);
    }

    const data = (await response.json()) as { url?: string };
    if (!data.url) {
      throw new Error("Checkout URL missing from response");
    }

    return { url: data.url };
  },
});

const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("canceled"),
  v.literal("past_due"),
  v.literal("unpaid"),
  v.literal("incomplete"),
);

export const upsertIntegrationSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    integrationId: v.string(),
    productId: v.string(),
    subscriptionId: v.string(),
    customerId: v.string(),
    status: subscriptionStatusValidator,
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.number(),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationSubscriptions")
      .withIndex("by_organization_and_integration", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("integrationId", args.integrationId),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        productId: args.productId,
        subscriptionId: args.subscriptionId,
        customerId: args.customerId,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodEnd: args.currentPeriodEnd,
        metadata: args.metadata,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("integrationSubscriptions", {
        organizationId: args.organizationId,
        integrationId: args.integrationId,
        productId: args.productId,
        subscriptionId: args.subscriptionId,
        customerId: args.customerId,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodEnd: args.currentPeriodEnd,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

const subscriptionStatusMap = {
  active: "active",
  canceled: "canceled",
  past_due: "past_due",
  unpaid: "unpaid",
  incomplete: "incomplete",
} as const;

export const backfillIntegrationSubscriptions = internalAction({
  args: {
    integrationId: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    processedOrganizations: v.number(),
    created: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const organizations = await ctx.runQuery(
      internal.organizations.listOrganizationsForBackfill,
      {},
    );

    const integrations = args.integrationId
      ? [args.integrationId]
      : [...PAID_INTEGRATIONS];

    let processedOrganizations = 0;
    let created = 0;
    let skipped = 0;

    for (const organization of organizations) {
      const enabledIntegrations = organization.enabledIntegrations;
      const enabledTargets = integrations.filter((integrationId) =>
        enabledIntegrations.includes(integrationId),
      );

      if (enabledTargets.length === 0) {
        continue;
      }

      processedOrganizations += 1;

      const userIds = await ctx.runQuery(
        internal.organizations.listOrganizationUserIds,
        { organizationId: organization._id },
      );

      for (const integrationId of enabledTargets) {
        const existing = await ctx.runQuery(api.integrations.getSubscription, {
          organizationId: organization._id,
          integrationId,
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        const productId =
          process.env[`INTEGRATION_PRODUCT_${integrationId.toUpperCase()}`];
        if (!productId) {
          skipped += 1;
          continue;
        }

        let matched = false;

        for (const userId of userIds) {
          const subscription = await polar.getCurrentSubscription(ctx, {
            userId,
          });
          if (!subscription) {
            continue;
          }

          if (subscription.productId !== productId) {
            continue;
          }

          const currentPeriodEnd = subscription.currentPeriodEnd
            ? Date.parse(subscription.currentPeriodEnd)
            : 0;

          const status =
            subscriptionStatusMap[
              subscription.status as keyof typeof subscriptionStatusMap
            ] ?? "incomplete";

          if (!args.dryRun) {
            await ctx.runMutation(
              internal.integrations.upsertIntegrationSubscription,
              {
                organizationId: organization._id,
                integrationId,
                productId: subscription.productId,
                subscriptionId: subscription.id,
                customerId: subscription.customerId,
                status,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                currentPeriodEnd,
                metadata: subscription.metadata ?? {},
              },
            );
          }

          created += 1;
          matched = true;
          break;
        }

        if (!matched) {
          skipped += 1;
        }
      }
    }

    return { processedOrganizations, created, skipped };
  },
});
