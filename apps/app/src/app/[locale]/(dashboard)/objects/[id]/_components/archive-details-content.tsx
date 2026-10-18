"use client";

import { ArchiveDetailsAlerts } from "./archive-details-alerts";
import { ArchiveDetailsSections } from "./archive-details-sections";
import { ArchiveDetailsSummaryCards } from "./archive-details-summary-cards";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"archive">;

interface ArchiveDetailsContentProps {
  details: DetailsDoc;
}

export function ArchiveDetailsContent({ details }: ArchiveDetailsContentProps) {
  return (
    <div className="space-y-8">
      <ArchiveDetailsSummaryCards details={details} />
      <ArchiveDetailsAlerts details={details} />
      <ArchiveDetailsSections details={details} />
    </div>
  );
}
