"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import { Clock } from "lucide-react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

export function KpiPendingApprovals() {
  const { currentOrganizationId } = useOrganization();

  return (
    <PermissionGate permission="organization.view_analytics">
      <KpiPendingApprovalsContent organizationId={currentOrganizationId} />
    </PermissionGate>
  );
}

function KpiPendingApprovalsContent({
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
    return <KpiCard title={t("pendingApprovals")} value="—" loading />;
  }

  return (
    <KpiCard
      title={t("pendingApprovals")}
      value={analytics.loans.pending}
      icon={Clock}
    />
  );
}
