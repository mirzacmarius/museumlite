"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { AccessionsPageSkeleton } from "../../accessions-page-skeleton";
import { EntryDetailClient } from "./_components/entry-detail-client";

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<AccessionsPageSkeleton />}>
        <EntryDetailClient entryId={params.id as Id<"objectEntries">} />
      </Suspense>
    </div>
  );
}
