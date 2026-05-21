"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import { ArrowRightLeft } from "lucide-react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

export function KpiActiveLoans() {
  const { currentOrganizationId } = useOrganization();

  return (
    <PermissionGate permission="organization.view_analytics">
      <KpiActiveLoansContent organizationId={currentOrganizationId} />
    </PermissionGate>
  );
}

function KpiActiveLoansContent({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const t = useScopedI18n("loans.kpis");
  const analytics = useQuery(
    api.dashboard.getAnalytics,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  if (analytics === undefined) {
    return <KpiCard title={t("activeLoans")} value="—" loading />;
  }

  return (
    <KpiCard
      title={t("activeLoans")}
      value={analytics.loans.active}
      icon={ArrowRightLeft}
    />
  );
}
