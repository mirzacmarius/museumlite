"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { EntryDetailClient } from "./_components/entry-detail-client";

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="size-full overflow-y-auto">
      <EntryDetailClient entryId={params.id as Id<"objectEntries">} />
    </div>
  );
}
