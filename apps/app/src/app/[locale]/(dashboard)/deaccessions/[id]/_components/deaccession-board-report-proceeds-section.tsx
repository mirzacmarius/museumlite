"use client";

import { DollarSign } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { type FormatLocale, formatCurrency } from "@/lib/format-number";
import { useI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type ExportData = NonNullable<DeaccessionDetailViewProps["exportData"]>;

interface DeaccessionBoardReportProceedsSectionProps {
  exportData: ExportData;
  locale: DeaccessionDetailViewProps["locale"];
}

export function DeaccessionBoardReportProceedsSection({
  exportData,
  locale,
}: DeaccessionBoardReportProceedsSectionProps) {
  const tRoot = useI18n();
  if (
    !exportData.deaccession.proceedsAmount &&
    !exportData.deaccession.proceedsRecipient
  ) {
    return null;
  }

  return (
    <div className="print:break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
        <DollarSign className="mr-1 inline size-3" />
        {tRoot("deaccessions.report.proceedsInfo")}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
        {exportData.deaccession.proceedsAmount !== undefined ? (
          <div>
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.amount")}
            </p>
            <p className="font-semibold text-black">
              {formatCurrency(
                exportData.deaccession.proceedsAmount,
                locale as FormatLocale,
                exportData.deaccession.proceedsCurrency || "USD",
              )}
            </p>
          </div>
        ) : null}
        {exportData.deaccession.proceedsRecipient ? (
          <div>
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.recipient")}
            </p>
            <p className="text-black">
              {exportData.deaccession.proceedsRecipient}
            </p>
          </div>
        ) : null}
        {exportData.deaccession.proceedsDate ? (
          <div>
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.dateReceived")}
            </p>
            <p className="text-black">
              <ClientDateFns
                timestamp={exportData.deaccession.proceedsDate}
                format="MMMM d, yyyy"
                locale={locale}
              />
            </p>
          </div>
        ) : null}
        {exportData.deaccession.proceedsNotes ? (
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
              {tRoot("deaccessions.report.proceedsNotes")}
            </p>
            <p className="whitespace-pre-wrap text-black">
              {exportData.deaccession.proceedsNotes}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
