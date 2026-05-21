"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Loader2, Printer } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { DeaccessionBoardReportApprovalSection } from "./deaccession-board-report-approval-section";
import { DeaccessionBoardReportDetailsSection } from "./deaccession-board-report-details-section";
import { DeaccessionBoardReportFooter } from "./deaccession-board-report-footer";
import { DeaccessionBoardReportHeader } from "./deaccession-board-report-header";
import { DeaccessionBoardReportObjectSection } from "./deaccession-board-report-object-section";
import { DeaccessionBoardReportProceedsSection } from "./deaccession-board-report-proceeds-section";
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
              <DeaccessionBoardReportHeader exportData={exportData} />
              <DeaccessionBoardReportObjectSection exportData={exportData} />
              <DeaccessionBoardReportDetailsSection
                exportData={exportData}
                locale={locale}
              />
              <DeaccessionBoardReportProceedsSection
                exportData={exportData}
                locale={locale}
              />
              <DeaccessionBoardReportApprovalSection
                exportData={exportData}
                locale={locale}
              />
              <DeaccessionBoardReportFooter
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

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-zinc-200 bg-white p-6 pt-4 print:hidden">
          <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
            {t("actions.close")}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            {t("actions.print")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
