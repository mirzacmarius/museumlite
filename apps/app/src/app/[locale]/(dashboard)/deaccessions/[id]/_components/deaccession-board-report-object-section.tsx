"use client";

import { useI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type ExportData = NonNullable<DeaccessionDetailViewProps["exportData"]>;

interface DeaccessionBoardReportObjectSectionProps {
  exportData: ExportData;
}

export function DeaccessionBoardReportObjectSection({
  exportData,
}: DeaccessionBoardReportObjectSectionProps) {
  const tRoot = useI18n();
  if (!exportData.collection) return null;

  return (
    <div className="print:break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
        {tRoot("deaccessions.report.objectInfo")}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
        <div>
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            {tRoot("deaccessions.report.title_field")}
          </p>
          <p className="text-black">{exportData.collection.title}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
            {tRoot("deaccessions.report.accessionNumber")}
          </p>
          <p className="text-black">
            {exportData.collection.accessionNumber || "—"}
          </p>
        </div>
        {exportData.collection.description ? (
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.description")}
            </p>
            <p className="text-black">{exportData.collection.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
