"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { NaturalHistoryDetailSections } from "./natural-history-detail-sections";
import { NaturalHistorySummaryCards } from "./natural-history-summary-cards";

type NaturalHistoryDetails = NonNullable<
  FunctionReturnType<typeof api.naturalHistoryDetails.get>
>;

interface NaturalHistoryDetailsContentProps {
  details: NaturalHistoryDetails;
}

export function NaturalHistoryDetailsContent({
  details,
}: NaturalHistoryDetailsContentProps) {
  return (
    <div className="space-y-8">
      <NaturalHistorySummaryCards details={details} />
      <NaturalHistoryDetailSections details={details} />
    </div>
  );
}
