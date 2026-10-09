import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { isOrganizationModuleEnabled } from "@v1/backend/convex/utils/capabilities";
import {
  type FeatureId,
  hasFeatureTierAccess,
  type IntegrationId,
  type ModuleId,
  type SubscriptionTier,
} from "@v1/backend/convex/utils/featurePolicy";
import { useOrganization } from "@/components/organization-provider";

export type { FeatureId, IntegrationId, ModuleId, SubscriptionTier };

/**
 * Single-dimension checks for surfaces outside the capability matrix (object
 * detail tabs, collection-type modules). Destinations in the matrix use
 * `useCapabilities` instead.
 */
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

  const hasModule = (moduleId: ModuleId) =>
    isOrganizationModuleEnabled(
      { enabledModules, enabledIntegrations },
      moduleId,
    );

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
