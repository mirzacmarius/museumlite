"use client";

import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type ExportData = NonNullable<DeaccessionDetailViewProps["exportData"]>;

interface DeaccessionBoardReportObjectSectionProps {
  exportData: ExportData;
}

export function DeaccessionBoardReportObjectSection({
  exportData,
}: DeaccessionBoardReportObjectSectionProps) {
  if (!exportData.collection) return null;

  return (
    <div className="print:break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
        Object Information
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
        <div>
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            Title
          </p>
          <p className="text-black">{exportData.collection.title}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            Accession Number
          </p>
          <p className="text-black">
            {exportData.collection.accessionNumber || "—"}
          </p>
        </div>
        {exportData.collection.description ? (
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              Description
            </p>
            <p className="text-black">{exportData.collection.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
