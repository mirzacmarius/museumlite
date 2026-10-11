"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { SessionClient } from "./_components/session-client";

export default function InventorySessionPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<DashboardListPageSkeleton layout="list" />}>
        <SessionClient sessionId={params.id} />
      </Suspense>
    </div>
  );
}
