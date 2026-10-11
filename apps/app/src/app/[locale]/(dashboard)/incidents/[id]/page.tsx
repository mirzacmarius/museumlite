"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { IncidentDetailClient } from "./_components/incident-detail-client";

export default function IncidentPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <IncidentDetailClient incidentId={params.id as Id<"incidents">} />
      </Suspense>
    </div>
  );
}
