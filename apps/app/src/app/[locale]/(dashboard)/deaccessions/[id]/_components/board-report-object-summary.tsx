"use client";

import { ClientDateFns } from "@/components/client-date";
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
  return (
    <>
      {exportData.collection ? (
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
    </>
  );
}
