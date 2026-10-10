"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { FindingDetailClient } from "./_components/finding-detail-client";

export default function DocumentationFindingPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <FindingDetailClient findingId={params.id} />
      </Suspense>
    </div>
  );
}
