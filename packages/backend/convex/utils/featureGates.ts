import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type SubscriptionTier = "free" | "pro" | "enterprise";
export type FeatureId =
  | "loans"
  | "exhibitions"
  | "conservation"
  | "reporting"
  | "compliance"
  | "public_portal"
  | "installations";

export type ModuleId =
  | "library"
  | "fine_art"
  | "wine"
  | "automotive"
  | "natural_history"
  | "archive"
  | "accounts";

export type IntegrationId = "library";

type TierLimits = {
  objects: number | null;
  mediaBytes: number | null;
  users: number | null;
  exportsPerMonth: number | null;
};

const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

const FEATURE_REQUIREMENTS: Record<FeatureId, SubscriptionTier> = {
  loans: "pro",
  exhibitions: "pro",
  conservation: "pro",
  reporting: "pro",
  public_portal: "free",
  installations: "pro",
  compliance: "enterprise",
};

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    objects: 100,
    mediaBytes: 1 * 1024 * 1024 * 1024,
    users: 3,
    exportsPerMonth: 10,
  },
  pro: {
    objects: 500,
    mediaBytes: 10 * 1024 * 1024 * 1024,
    users: 10,
    exportsPerMonth: 100,
  },
  enterprise: {
    objects: null,
    mediaBytes: null,
    users: null,
    exportsPerMonth: null,
  },
};

function getTier(org: Doc<"organizations">): SubscriptionTier {
  return org.subscriptionTier ?? "free";
}

function hasTierAccess(
  org: Doc<"organizations">,
  featureId: FeatureId,
): boolean {
  const tier = getTier(org);
  const requiredTier = FEATURE_REQUIREMENTS[featureId];
  return TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
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
  return hasTierAccess(org, featureId);
}

export async function requireFeatureAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  featureId: FeatureId,
) {
  const org = await getOrganization(ctx, organizationId);
  if (!hasTierAccess(org, featureId)) {
    const requiredTier = FEATURE_REQUIREMENTS[featureId];
    throw new Error(`Feature requires ${requiredTier} tier`);
  }
}

export async function hasModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  moduleId: ModuleId,
) {
  const org = await getOrganization(ctx, organizationId);
  const enabledModules = org.settings?.enabledModules ?? [];
  return enabledModules.includes(moduleId);
}

export async function requireModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  moduleId: ModuleId,
) {
  const org = await getOrganization(ctx, organizationId);
  const enabledModules = org.settings?.enabledModules ?? [];
  if (!enabledModules.includes(moduleId)) {
    throw new Error(`Module not enabled: ${moduleId}`);
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
  const { objects } = TIER_LIMITS[getTier(org)];
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
  const { mediaBytes } = TIER_LIMITS[getTier(org)];
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
  const { users } = TIER_LIMITS[getTier(org)];
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
  const { exportsPerMonth } = TIER_LIMITS[getTier(org)];
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
  return TIER_LIMITS[tier];
}
