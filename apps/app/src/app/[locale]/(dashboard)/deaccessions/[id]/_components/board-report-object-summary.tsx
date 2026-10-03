"use client";

import { ClientDateFns } from "@/components/client-date";
import { useI18n } from "@/locales/client";
import { formatDeaccessionMethodLabel } from "./deaccession-detail-types";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type BoardReportExportData = NonNullable<
  DeaccessionDetailViewProps["exportData"]
>;

interface BoardReportObjectSummaryProps {
  exportData: BoardReportExportData;
  locale: string;
}

export function BoardReportObjectSummary({
  exportData,
  locale,
}: BoardReportObjectSummaryProps) {
  const tRoot = useI18n();
  return (
    <>
      {exportData.collection ? (
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
                <p className="text-black">
                  {exportData.collection.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="print:break-inside-avoid">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
          {tRoot("deaccessions.report.deaccessionDetails")}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
          <div>
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.dateDeaccessioned")}
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
              {tRoot("deaccessions.report.method")}
            </p>
            <p className="capitalize text-black">
              {formatDeaccessionMethodLabel(
                exportData.deaccession.method,
                tRoot,
              )}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.reason")}
            </p>
            <p className="whitespace-pre-wrap text-black">
              {exportData.deaccession.reason}
            </p>
          </div>
          {exportData.deaccession.disposition ? (
            <div className="col-span-2">
              <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                {tRoot("deaccessions.report.disposition")}
              </p>
              <p className="whitespace-pre-wrap text-black">
                {exportData.deaccession.disposition}
              </p>
            </div>
          ) : null}
          {exportData.deaccession.notes ? (
            <div className="col-span-2">
              <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                {tRoot("deaccessions.report.notes")}
              </p>
              <p className="whitespace-pre-wrap text-black">
                {exportData.deaccession.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
