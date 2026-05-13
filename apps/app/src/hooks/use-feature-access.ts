import { useOrganization } from "@/components/organization-provider";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type FeatureId,
  type IntegrationId,
  type ModuleId,
  type SubscriptionTier,
  hasFeatureTierAccess,
} from "@v1/backend/convex/utils/featurePolicy";

export type { FeatureId, IntegrationId, ModuleId, SubscriptionTier };

export function useFeatureAccess() {
  const { currentOrganization, organizations } = useOrganization();
  const tier = currentOrganization?.subscriptionTier ?? "free";
  const enabledModules = currentOrganization?.settings?.enabledModules ?? [];
  const enabledIntegrations =
    currentOrganization?.settings?.enabledIntegrations ?? [];

  const hasFeature = (
    featureId: FeatureId,
    organizationId?: Id<"organizations">,
  ) => {
    const scopedTier =
      (organizationId
        ? organizations.find((org) => org._id === organizationId)
            ?.subscriptionTier
        : currentOrganization?.subscriptionTier) ?? "free";
    return hasFeatureTierAccess(scopedTier, featureId);
  };

  const hasModule = (moduleId: ModuleId) => {
    return (
      enabledModules.includes(moduleId) ||
      (moduleId === "library" && enabledIntegrations.includes("library"))
    );
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
