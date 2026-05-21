"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Loader2 } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { BoardReportApprovalSection } from "./board-report-approval-section";
import { BoardReportDialogHeader } from "./board-report-dialog-header";
import { BoardReportFinancialSection } from "./board-report-financial-section";
import { BoardReportObjectSummary } from "./board-report-object-summary";
import { BoardReportPrintActions } from "./board-report-print-actions";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

export function DeaccessionDetailBoardReportDialog({
  locale,
  isPrintModalOpen,
  setIsPrintModalOpen,
  exportData,
}: Pick<
  DeaccessionDetailViewProps,
  "locale" | "isPrintModalOpen" | "setIsPrintModalOpen" | "exportData"
>) {
  const t = useScopedI18n("deaccessions");

  return (
    <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[90vh] w-full max-w-[210mm] flex-col bg-white p-0 text-black print:h-auto print:max-h-none print:max-w-none print:w-full print:overflow-visible print:rounded-none print:border-none print:p-0 print:shadow-none"
      >
        <DialogHeader className="flex-shrink-0 border-b border-zinc-200 p-6 pb-4 print:hidden">
          <DialogTitle className="text-black">
            {t("report.deaccessionBoardReport")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {exportData ? (
            <div className="space-y-5 bg-white p-6 text-black print:space-y-4 print:break-inside-avoid-page print:p-[15mm]">
              <BoardReportDialogHeader exportData={exportData} />
              <BoardReportObjectSummary
                exportData={exportData}
                locale={locale}
              />
              <BoardReportFinancialSection
                exportData={exportData}
                locale={locale}
              />
              <BoardReportApprovalSection
                exportData={exportData}
                locale={locale}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-zinc-400" />
            </div>
          )}
        </div>

        <BoardReportPrintActions onClose={() => setIsPrintModalOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
