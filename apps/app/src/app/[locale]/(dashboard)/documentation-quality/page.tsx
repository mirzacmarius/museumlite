"use client";

import { Suspense } from "react";
import { CapabilityGuard } from "@/components/capability-guard";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { QualityPageClient } from "./_components/quality-page-client";

export default function DocumentationQualityPage() {
  const t = useScopedI18n("documentationQuality");
  const { currentOrganizationId, isLoading } = useOrganization();

  if (isLoading || !currentOrganizationId) {
    return <DashboardListPageSkeleton layout="list" />;
  }

  return (
    <CapabilityGuard
      capability="documentation_quality"
      featureName={t("title")}
    >
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <QualityPageClient organizationId={currentOrganizationId} />
      </Suspense>
    </CapabilityGuard>
  );
}
