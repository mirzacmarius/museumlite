"use client";

import { ClientCurrentDateFns, ClientDateFns } from "@/components/client-date";
import { type FormatLocale, formatCurrency } from "@/lib/format-number";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { CheckCircle, DollarSign, Loader2, Printer } from "lucide-react";
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
              <div className="flex items-start gap-4 border-b border-zinc-200 pb-4 print:gap-3 print:pb-3">
                {exportData.collection?.primaryImageUrl ? (
                  <img
                    src={exportData.collection.primaryImageUrl}
                    alt={exportData.collection.title}
                    className="size-24 flex-shrink-0 rounded border border-zinc-300 object-cover print:size-20"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 print:text-[10px]">
                    {exportData.organization.name}
                  </p>
                  <h1 className="text-xl font-bold text-black print:text-lg">
                    Deaccession Report
                  </h1>
                  <p className="text-sm text-zinc-600 print:text-xs">
                    {exportData.deaccession.deaccessionNumber}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                      exportData.deaccession.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : exportData.deaccession.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {exportData.deaccession.status.charAt(0).toUpperCase() +
                      exportData.deaccession.status.slice(1)}
                  </span>
                </div>
              </div>

              {exportData.collection ? (
                <div className="print:break-inside-avoid">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                    Object Information
                  </h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                        Title
                      </p>
                      <p className="text-black">
                        {exportData.collection.title}
                      </p>
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
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
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

              {exportData.deaccession.proceedsAmount ||
              exportData.deaccession.proceedsRecipient ? (
                <div className="print:break-inside-avoid">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                    <DollarSign className="mr-1 inline size-3" />
                    Proceeds Information
                  </h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:gap-x-4 print:gap-y-1 print:text-xs">
                    {exportData.deaccession.proceedsAmount !== undefined ? (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                          Amount
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
                          Recipient
                        </p>
                        <p className="text-black">
                          {exportData.deaccession.proceedsRecipient}
                        </p>
                      </div>
                    ) : null}
                    {exportData.deaccession.proceedsDate ? (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                          Date Received
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
                          Proceeds Notes
                        </p>
                        <p className="whitespace-pre-wrap text-black">
                          {exportData.deaccession.proceedsNotes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {exportData.workflowHistory.length > 0 ? (
                <div className="print:break-inside-avoid">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                    Approval History
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
                        Final Approval
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
                  Generated on{" "}
                  <ClientCurrentDateFns
                    format="MMMM d, yyyy 'at' h:mm a"
                    locale={locale}
                  />{" "}
                  • {exportData.organization.name}
                </p>
              </div>
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
