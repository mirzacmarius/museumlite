"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ArchiveDetailsAlerts } from "./archive-details-alerts";
import { ArchiveDetailsSections } from "./archive-details-sections";
import { ArchiveDetailsSummaryCards } from "./archive-details-summary-cards";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

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
