"use client";

import { FeatureGuard } from "@v1/ui/feature-guard";
import type { ReactNode } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { usePermissions } from "@/components/permission-gate";
import { useCapabilities } from "@/hooks/use-capabilities";
import {
  type CapabilityId,
  capabilityGuardReason,
  sectionCapabilityState,
} from "@/lib/capability-access";

interface CapabilityGuardProps {
  capability: CapabilityId;
  /**
   * Role permission a section of the capability needs on top of the
   * capability's own; a role without it sees the section as unavailable.
   */
  permission?: string;
  featureName: string;
  description?: string;
  children: ReactNode;
  /** Rendered while capability states load; defaults to a page skeleton. */
  loadingFallback?: ReactNode;
}

/**
 * Page or section guard driven by the capability matrix: renders the content when the
 * capability is available, otherwise explains which dimension is missing.
 * Only administrators get the link to the settings page that resolves it.
 */
export function CapabilityGuard({
  capability,
  permission,
  featureName,
  description,
  children,
  loadingFallback = <DashboardListPageSkeleton layout="list" />,
}: CapabilityGuardProps) {
  const { stateOf, isAvailable } = useCapabilities();
  const { hasPermission, isLoading } = usePermissions();
  const state = stateOf(capability);
  if (!state || (permission && isLoading)) return <>{loadingFallback}</>;

  return (
    <FeatureGuard
      featureName={featureName}
      description={description}
      reason={capabilityGuardReason(
        permission
          ? sectionCapabilityState(state, hasPermission(permission))
          : state,
      )}
      showAction={isAvailable("administration")}
    >
      {children}
    </FeatureGuard>
  );
}
