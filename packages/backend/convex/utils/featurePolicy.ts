export const SUBSCRIPTION_TIERS = ["free", "pro", "enterprise"] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const FEATURE_IDS = [
  "loans",
  "exhibitions",
  "conservation",
  "reporting",
  "compliance",
  "public_portal",
  "installations",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export const MODULE_IDS = [
  "library",
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "accounts",
  "coins_stamps",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export const INTEGRATION_IDS = ["library"] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export interface TierLimits {
  objects: number | null;
  mediaBytes: number | null;
  users: number | null;
  exportsPerMonth: number | null;
}

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

export const FEATURE_REQUIREMENTS: Record<FeatureId, SubscriptionTier> = {
  loans: "pro",
  exhibitions: "pro",
  conservation: "pro",
  reporting: "pro",
  public_portal: "pro",
  installations: "pro",
  compliance: "enterprise",
};

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
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

export function normalizeSubscriptionTier(
  tier: SubscriptionTier | null | undefined,
): SubscriptionTier {
  return tier ?? "free";
}

export function hasTierAccess(
  tier: SubscriptionTier | null | undefined,
  requiredTier: SubscriptionTier,
): boolean {
  return (
    TIER_ORDER[normalizeSubscriptionTier(tier)] >= TIER_ORDER[requiredTier]
  );
}

export function hasFeatureTierAccess(
  tier: SubscriptionTier | null | undefined,
  featureId: FeatureId,
): boolean {
  return hasTierAccess(tier, FEATURE_REQUIREMENTS[featureId]);
}

export function getFeatureRequiredTier(featureId: FeatureId): SubscriptionTier {
  return FEATURE_REQUIREMENTS[featureId];
}

export function getTierLimits(tier: SubscriptionTier | null | undefined) {
  return TIER_LIMITS[normalizeSubscriptionTier(tier)];
}
