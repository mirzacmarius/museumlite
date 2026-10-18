"use client";

import { NaturalHistoryDetailSections } from "./natural-history-detail-sections";
import { NaturalHistorySummaryCards } from "./natural-history-summary-cards";
import type { TypeDetailsRecord } from "./types";

type NaturalHistoryDetails = TypeDetailsRecord<"natural_history">;

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
