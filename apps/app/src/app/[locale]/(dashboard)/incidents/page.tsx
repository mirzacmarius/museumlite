"use client";

import { Suspense } from "react";
import { CapabilityGuard } from "@/components/capability-guard";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { IncidentsPageClient } from "./_components/incidents-page-client";

export default function IncidentsPage() {
  const t = useScopedI18n("incidents");
  const { currentOrganizationId, isLoading } = useOrganization();

  if (isLoading || !currentOrganizationId) {
    return <DashboardListPageSkeleton layout="list" />;
  }

  return (
    <CapabilityGuard capability="incidents" featureName={t("title")}>
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <IncidentsPageClient organizationId={currentOrganizationId} />
      </Suspense>
    </CapabilityGuard>
  );
}
