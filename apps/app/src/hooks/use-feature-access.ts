import { useOrganization } from "@/components/organization-provider";

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
  | "archive";

export type IntegrationId = "library";

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
  public_portal: "pro",
  installations: "pro",
  compliance: "enterprise",
};

export function useFeatureAccess() {
  const { currentOrganization } = useOrganization();
  const tier = currentOrganization?.subscriptionTier ?? "free";
  const enabledModules = currentOrganization?.settings?.enabledModules ?? [];
  const enabledIntegrations =
    currentOrganization?.settings?.enabledIntegrations ?? [];

  const hasFeature = (featureId: FeatureId) => {
    const requiredTier = FEATURE_REQUIREMENTS[featureId];
    return TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
  };

  const hasModule = (moduleId: ModuleId) => {
    return enabledModules.includes(moduleId);
  };

  const hasIntegration = (integrationId: IntegrationId) => {
    return enabledIntegrations.includes(integrationId);
  };

  return {
    tier,
    hasFeature,
    hasModule,
    hasIntegration,
    enabledModules,
    enabledIntegrations,
  };
}
