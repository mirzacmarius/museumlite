"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import { Truck } from "lucide-react";

export function KpiInTransit() {
  const { currentOrganizationId } = useOrganization();

  return (
    <PermissionGate permission="loans.read">
      <KpiInTransitContent organizationId={currentOrganizationId} />
    </PermissionGate>
  );
}

function KpiInTransitContent({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const transitStats = useQuery(
    api.transit.getTransitStats,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  if (transitStats === undefined) {
    return <KpiCard title="In Transit" value="—" loading />;
  }

  return (
    <KpiCard title="In Transit" value={transitStats.inTransit} icon={Truck} />
  );
}
