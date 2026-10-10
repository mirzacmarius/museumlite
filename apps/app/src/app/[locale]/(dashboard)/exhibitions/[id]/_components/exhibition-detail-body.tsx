"use client";

import { CaseTaskPanel } from "@/components/case-tasks/case-task-panel";
import { ExhibitionDetailDocumentsPanel } from "./exhibition-detail-documents-panel";
import { ExhibitionDetailOverviewPanel } from "./exhibition-detail-overview-panel";
import { ExhibitionDetailSidebar } from "./exhibition-detail-sidebar";
import { ExhibitionDetailStats } from "./exhibition-detail-stats";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";
import { ExhibitionPhysicalHandoffsPanel } from "./exhibition-physical-handoffs-panel";

export function ExhibitionDetailBody(props: ExhibitionDetailViewProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6 pb-20 sm:px-6 sm:py-8">
        <ExhibitionDetailStats {...props} />
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="min-w-0 space-y-6 md:col-span-2">
            <ExhibitionDetailOverviewPanel {...props} />
            <ExhibitionPhysicalHandoffsPanel
              exhibitionId={props.exhibitionId}
              organizationId={props.exhibition.organizationId}
              startDate={props.exhibition.startDate}
              endDate={props.exhibition.endDate}
            />
            <ExhibitionDetailDocumentsPanel {...props} />
            <CaseTaskPanel
              organizationId={props.exhibition.organizationId}
              caseType="exhibition"
              caseId={props.exhibitionId}
            />
          </div>
          <ExhibitionDetailSidebar {...props} />
        </div>
      </div>
    </div>
  );
}
