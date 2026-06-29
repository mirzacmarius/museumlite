"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useScopedI18n } from "@/locales/client";

export function KpiOverdue() {
  const { currentOrganizationId } = useOrganization();
  const { hasFeature } = useFeatureAccess();

  if (!hasFeature("reporting")) {
    return null;
  }

  return (
    <PermissionGate permission="collections.read">
      <KpiOverdueContent organizationId={currentOrganizationId} />
    </PermissionGate>
  );
}

function KpiOverdueContent({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const t = useScopedI18n("loans.kpis");
  const now = useClientNow();
  const operationalKpis = useQuery(
    api.dashboard.getOperationalKpis,
    organizationId && now !== undefined
      ? {
          organizationId: organizationId as Id<"organizations">,
          now,
        }
      : "skip",
  );

  if (operationalKpis === undefined) {
    return <KpiCard title={t("overdueLoans")} value="—" loading />;
  }

  return (
    <KpiCard
      title={t("overdueLoans")}
      value={operationalKpis.loans.overdue}
      icon={AlertCircle}
      changeType={operationalKpis.loans.overdue > 0 ? "negative" : "neutral"}
    />
  );
}
