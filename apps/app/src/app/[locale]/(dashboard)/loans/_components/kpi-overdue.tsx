"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import { AlertCircle } from "lucide-react";

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
  const operationalKpis = useQuery(
    api.dashboard.getOperationalKpis,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  if (operationalKpis === undefined) {
    return <KpiCard title="Overdue Loans" value="—" loading />;
  }

  return (
    <KpiCard
      title="Overdue Loans"
      value={operationalKpis.loans.overdue}
      icon={AlertCircle}
      changeType={operationalKpis.loans.overdue > 0 ? "negative" : "neutral"}
    />
  );
}
