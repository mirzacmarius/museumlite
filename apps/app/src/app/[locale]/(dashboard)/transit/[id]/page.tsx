import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Suspense } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { TransitDetailClient } from "./transit-detail-client";

type TransitDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function TransitDetailPage({ params }: TransitDetailPageProps) {
  return (
    <Suspense
      fallback={
        <DashboardListPageSkeleton
          layout="list"
          filtersCount={0}
          actionsCount={0}
        />
      }
    >
      <TransitDetail params={params} />
    </Suspense>
  );
}

async function TransitDetail({ params }: TransitDetailPageProps) {
  const { id } = await params;
  return <TransitDetailClient transitRecordId={id as Id<"transitRecords">} />;
}
