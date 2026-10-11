"use client";

import { Suspense } from "react";
import { CapabilityGuard } from "@/components/capability-guard";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { InventoryPageClient } from "./_components/inventory-page-client";

export default function InventoryPage() {
  const t = useScopedI18n("inventory");
  const { currentOrganizationId, isLoading } = useOrganization();

  if (isLoading || !currentOrganizationId) {
    return <DashboardListPageSkeleton layout="list" />;
  }

  return (
    <CapabilityGuard capability="inventory" featureName={t("title")}>
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <InventoryPageClient organizationId={currentOrganizationId} />
      </Suspense>
    </CapabilityGuard>
  );
}
