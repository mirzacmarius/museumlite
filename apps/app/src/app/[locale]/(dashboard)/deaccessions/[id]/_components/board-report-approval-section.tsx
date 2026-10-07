"use client";

import { CheckCircle } from "lucide-react";
import { ClientCurrentDateFns, ClientDateFns } from "@/components/client-date";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type BoardReportExportData = NonNullable<
  DeaccessionDetailViewProps["exportData"]
>;

interface BoardReportApprovalSectionProps {
  exportData: BoardReportExportData;
  locale: string;
}

export function BoardReportApprovalSection({
  exportData,
  locale,
}: BoardReportApprovalSectionProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("deaccessions");

  return (
    <>
      {exportData.workflowHistory.length > 0 ? (
        <div className="print:break-inside-avoid">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
            {tRoot("deaccessions.report.approvalHistory")}
          </h2>
          <div className="space-y-2">
            {exportData.workflowHistory.map((entry) => (
              <div
                key={`${entry.step}-${entry.approvedAt}`}
                className="flex items-start gap-3 text-sm print:text-xs"
              >
                <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium">
                  {entry.step}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-black">
                    {entry.step === 0
                      ? t("detail.created")
                      : t("detail.step", { step: entry.step })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {entry.approverName} •{" "}
                    <ClientDateFns
                      timestamp={entry.approvedAt}
                      format="MMM d, yyyy 'at' h:mm a"
                      locale={locale}
                    />
                  </p>
                  {entry.comment ? (
                    <p className="mt-1 text-xs italic text-zinc-600">
                      "{entry.comment}"
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {exportData.deaccession.approvedAt && exportData.approverName ? (
        <div className="border-t border-zinc-200 pt-4 print:break-inside-avoid">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                {tRoot("deaccessions.report.finalApproval")}
              </p>
              <p className="text-sm font-medium text-black">
                {exportData.approverName}
              </p>
              <p className="text-xs text-zinc-500">
                <ClientDateFns
                  timestamp={exportData.deaccession.approvedAt}
                  format="MMMM d, yyyy 'at' h:mm a"
                  locale={locale}
                />
              </p>
            </div>
            <CheckCircle className="size-8 text-green-600" />
          </div>
        </div>
      ) : null}

      <div className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-400 print:pt-2 print:text-[9px]">
        <p>
          {tRoot("deaccessions.report.generatedOn")}{" "}
          <ClientCurrentDateFns
            format="MMMM d, yyyy 'at' h:mm a"
            locale={locale}
          />{" "}
          • {exportData.organization.name}
        </p>
      </div>
    </>
  );
}
