"use client";

import { ClientDateFns } from "@/components/client-date";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type ExportData = NonNullable<DeaccessionDetailViewProps["exportData"]>;

interface DeaccessionBoardReportDetailsSectionProps {
  exportData: ExportData;
  locale: DeaccessionDetailViewProps["locale"];
}

export function DeaccessionBoardReportDetailsSection({
  exportData,
  locale,
}: DeaccessionBoardReportDetailsSectionProps) {
  return (
    <div className="print:break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
        Deaccession Details
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
        <div>
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            Date Deaccessioned
          </p>
          <p className="text-black">
            <ClientDateFns
              timestamp={exportData.deaccession.dateDeaccessioned}
              format="MMMM d, yyyy"
              locale={locale}
            />
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            Method
          </p>
          <p className="capitalize text-black">
            {exportData.deaccession.method}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            Reason
          </p>
          <p className="whitespace-pre-wrap text-black">
            {exportData.deaccession.reason}
          </p>
        </div>
        {exportData.deaccession.disposition ? (
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              Disposition
            </p>
            <p className="whitespace-pre-wrap text-black">
              {exportData.deaccession.disposition}
            </p>
          </div>
        ) : null}
        {exportData.deaccession.notes ? (
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-black">
              {exportData.deaccession.notes}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
