"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import { ArrowRightLeft } from "lucide-react";

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
  const analytics = useQuery(
    api.dashboard.getAnalytics,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  if (analytics === undefined) {
    return <KpiCard title="Active Loans" value="—" loading />;
  }

  return (
    <KpiCard
      title="Active Loans"
      value={analytics.loans.active}
      icon={ArrowRightLeft}
    />
  );
}
