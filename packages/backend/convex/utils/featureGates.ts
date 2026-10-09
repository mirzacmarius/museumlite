import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  type FeatureId,
  getFeatureRequiredTier,
  getTierLimits as getPolicyTierLimits,
  hasFeatureTierAccess,
  type IntegrationId,
  type ModuleId,
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "./featurePolicy";
import {
  type CollectionType,
  getCollectionTypeModuleRequirement,
} from "./moduleCatalog";

export type { FeatureId, IntegrationId, ModuleId, SubscriptionTier };

function getTier(org: Doc<"organizations">): SubscriptionTier {
  return normalizeSubscriptionTier(org.subscriptionTier);
}

function hasOrganizationFeatureAccess(
  org: Doc<"organizations">,
  featureId: FeatureId,
): boolean {
  return hasFeatureTierAccess(getTier(org), featureId);
}

function hasOrganizationModuleEnabled(
  org: Doc<"organizations">,
  moduleId: ModuleId,
): boolean {
  const enabledModules = org.settings?.enabledModules ?? [];
  if (enabledModules.includes(moduleId)) {
    return true;
  }

  const enabledIntegrations = org.settings?.enabledIntegrations ?? [];
  return moduleId === "library" && enabledIntegrations.includes("library");
}

async function getOrganization(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }
  return org;
}

export async function hasFeatureAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  featureId: FeatureId,
) {
  const org = await getOrganization(ctx, organizationId);
  return hasOrganizationFeatureAccess(org, featureId);
}

export async function requireFeatureAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  featureId: FeatureId,
) {
  const org = await getOrganization(ctx, organizationId);
  if (!hasOrganizationFeatureAccess(org, featureId)) {
    const requiredTier = getFeatureRequiredTier(featureId);
    throw new Error(`Feature requires ${requiredTier} tier`);
  }
}

export async function hasModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  moduleId: ModuleId,
) {
  const org = await getOrganization(ctx, organizationId);
  return hasOrganizationModuleEnabled(org, moduleId);
}

export async function requireModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  moduleId: ModuleId,
) {
  const org = await getOrganization(ctx, organizationId);
  if (!hasOrganizationModuleEnabled(org, moduleId)) {
    throw new Error(`Module not enabled: ${moduleId}`);
  }
}

/**
 * Objects of a module-backed collection type exist only while that module is
 * enabled. Clients map the stable `code` to translated copy.
 */
export async function requireCollectionTypeModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  collectionType: CollectionType | undefined,
) {
  const requiredModule = getCollectionTypeModuleRequirement(collectionType);
  if (!requiredModule) return;

  if (!(await hasModuleEnabled(ctx, organizationId, requiredModule))) {
    throw new ConvexError({
      code: "COLLECTION_TYPE_MODULE_DISABLED",
      message: "Collection type requires enabled module",
    });
  }
}

export async function hasIntegrationEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  integrationId: IntegrationId,
) {
  const org = await getOrganization(ctx, organizationId);
  const enabledIntegrations = org.settings?.enabledIntegrations ?? [];
  return enabledIntegrations.includes(integrationId);
}

export async function requireIntegrationEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  integrationId: IntegrationId,
) {
  const org = await getOrganization(ctx, organizationId);
  const enabledIntegrations = org.settings?.enabledIntegrations ?? [];
  if (!enabledIntegrations.includes(integrationId)) {
    throw new Error(`Integration not enabled: ${integrationId}`);
  }
}

export async function enforceObjectQuota(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const org = await getOrganization(ctx, organizationId);
  const { objects } = getPolicyTierLimits(getTier(org));
  if (objects === null) return;

  const existing = await ctx.db
    .query("collections")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  if (existing.length >= objects) {
    throw new Error("Object limit reached for current tier");
  }
}

export async function enforceMediaQuota(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  incomingBytes: number,
) {
  const org = await getOrganization(ctx, organizationId);
  const { mediaBytes } = getPolicyTierLimits(getTier(org));
  if (mediaBytes === null) return;

  const mediaFiles = await ctx.db
    .query("mediaFiles")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const usedBytes = mediaFiles.reduce(
    (total, file) => total + file.fileSize,
    0,
  );
  if (usedBytes + incomingBytes > mediaBytes) {
    throw new Error("Media storage limit reached for current tier");
  }
}

export async function enforceUserQuota(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const org = await getOrganization(ctx, organizationId);
  const { users } = getPolicyTierLimits(getTier(org));
  if (users === null) return;

  const members = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  if (members.length >= users) {
    throw new Error("User limit reached for current tier");
  }
}

function getMonthStart(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export async function enforceExportQuota(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const org = await getOrganization(ctx, organizationId);
  const { exportsPerMonth } = getPolicyTierLimits(getTier(org));
  if (exportsPerMonth === null) return;

  const periodStart = getMonthStart(Date.now());
  const existing = await ctx.db
    .query("exportUsage")
    .withIndex("by_organization_and_period", (q) =>
      q.eq("organizationId", organizationId).eq("periodStart", periodStart),
    )
    .first();

  const currentCount = existing?.count ?? 0;
  if (currentCount >= exportsPerMonth) {
    throw new Error("Export limit reached for current tier");
  }
}

export async function recordExportUsage(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const periodStart = getMonthStart(Date.now());
  const existing = await ctx.db
    .query("exportUsage")
    .withIndex("by_organization_and_period", (q) =>
      q.eq("organizationId", organizationId).eq("periodStart", periodStart),
    )
    .first();

  if (!existing) {
    await ctx.db.insert("exportUsage", {
      organizationId,
      periodStart,
      count: 1,
    });
    return;
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

export function getTierLimits(tier: SubscriptionTier) {
  return getPolicyTierLimits(tier);
}
