"use client";

import { Suspense } from "react";
import { CapabilityGuard } from "@/components/capability-guard";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { RequestsPageClient } from "./_components/requests-page-client";

export default function ReproductionRequestsPage() {
  const t = useScopedI18n("reproductionRequests");
  const { currentOrganizationId, isLoading } = useOrganization();

  if (isLoading || !currentOrganizationId) {
    return <DashboardListPageSkeleton layout="list" />;
  }

  return (
    <CapabilityGuard
      capability="reproduction_requests"
      featureName={t("title")}
    >
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <RequestsPageClient organizationId={currentOrganizationId} />
      </Suspense>
    </CapabilityGuard>
  );
}
