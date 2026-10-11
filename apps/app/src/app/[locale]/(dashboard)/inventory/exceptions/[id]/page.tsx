"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { ExceptionDetailClient } from "./_components/exception-detail-client";

export default function InventoryExceptionPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <ExceptionDetailClient exceptionId={params.id} />
      </Suspense>
    </div>
  );
}
