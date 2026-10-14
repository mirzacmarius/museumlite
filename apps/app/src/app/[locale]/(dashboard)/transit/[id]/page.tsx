import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { TransitDetailClient } from "./transit-detail-client";

export default async function TransitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TransitDetailClient transitRecordId={id as Id<"transitRecords">} />;
}
