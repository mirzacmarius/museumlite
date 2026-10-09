"use client";

import { FeatureGuard } from "@v1/ui/feature-guard";
import type { ReactNode } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useCapabilities } from "@/hooks/use-capabilities";
import {
  type CapabilityId,
  capabilityGuardReason,
} from "@/lib/capability-access";

interface CapabilityGuardProps {
  capability: CapabilityId;
  featureName: string;
  description?: string;
  children: ReactNode;
  /** Rendered while capability states load; defaults to a page skeleton. */
  loadingFallback?: ReactNode;
}

/**
 * Page guard driven by the capability matrix: renders the page when the
 * capability is available, otherwise explains which dimension is missing.
 * Only administrators get the link to the settings page that resolves it.
 */
export function CapabilityGuard({
  capability,
  featureName,
  description,
  children,
  loadingFallback = <DashboardListPageSkeleton layout="list" />,
}: CapabilityGuardProps) {
  const { stateOf, isAvailable } = useCapabilities();
  const state = stateOf(capability);
  if (!state) return <>{loadingFallback}</>;

  return (
    <FeatureGuard
      featureName={featureName}
      description={description}
      reason={capabilityGuardReason(state)}
      showAction={isAvailable("administration")}
    >
      {children}
    </FeatureGuard>
  );
}
