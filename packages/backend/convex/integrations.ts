import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
  },
] as const;

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

/**
 * Enable an integration for an organization
 */
export const enable = mutation({
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

    // Validate integration exists
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

    // Check if already enabled
    if (enabledIntegrations.includes(args.integrationId)) {
      return null;
    }

    // Add to enabled integrations
    await ctx.db.patch(args.organizationId, {
      settings: {
        ...currentSettings,
        enabledIntegrations: [...enabledIntegrations, args.integrationId],
      },
    });

    // If enabling library integration, create default settings
    if (args.integrationId === "library") {
      await createDefaultLibrarySettings(ctx, args.organizationId, userId);
    }

    return null;
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

/**
 * Helper function to create default library settings
 */
async function createDefaultLibrarySettings(
  ctx: any,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  // Check if settings already exist
  const existingSettings = await ctx.db
    .query("librarySettings")
    .withIndex("by_organization", (q: any) =>
      q.eq("organizationId", organizationId),
    )
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
