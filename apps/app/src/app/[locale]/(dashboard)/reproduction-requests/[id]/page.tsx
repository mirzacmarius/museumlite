"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { RequestDetailClient } from "./_components/request-detail-client";

export default function ReproductionRequestPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <RequestDetailClient requestId={params.id} />
      </Suspense>
    </div>
  );
}
