"use client";

import { ClientCurrentDateFns } from "@/components/client-date";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type ExportData = NonNullable<DeaccessionDetailViewProps["exportData"]>;

interface DeaccessionBoardReportFooterProps {
  exportData: ExportData;
  locale: DeaccessionDetailViewProps["locale"];
}

export function DeaccessionBoardReportFooter({
  exportData,
  locale,
}: DeaccessionBoardReportFooterProps) {
  return (
    <div className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-400 print:pt-2 print:text-[9px]">
      <p>
        Generated on{" "}
        <ClientCurrentDateFns
          format="MMMM d, yyyy 'at' h:mm a"
          locale={locale}
        />{" "}
        • {exportData.organization.name}
      </p>
    </div>
  );
}
