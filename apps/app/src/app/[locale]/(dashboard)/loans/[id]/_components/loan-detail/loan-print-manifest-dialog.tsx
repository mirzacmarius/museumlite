"use client";

import { ClientCurrentDate } from "@/components/client-date";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Printer } from "lucide-react";
import type { Loan } from "../types";

interface LoanPrintManifestDialogProps {
  loan: Loan;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoanPrintManifestDialog({
  loan,
  locale,
  open,
  onOpenChange,
}: LoanPrintManifestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* [PRINT-EXEMPT] Light zinc colors intentionally used for PDF/print output */}
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[210mm] w-full h-[90vh] p-0 gap-0 overflow-hidden bg-zinc-50 dark:bg-background flex flex-col"
      >
        <DialogHeader className="px-6 py-4 border-b border-border bg-background flex-shrink-0 flex-row items-center justify-between space-y-0">
          <DialogTitle>Print Dispatch Manifest</DialogTitle>
          <div className="flex items-center gap-3">
            <Button onClick={() => window.print()} className="h-8 text-xs">
              <Printer className="mr-2 size-4" />
              Print
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-zinc-100/50 dark:bg-muted/50">
          <div
            id="print-paper"
            className="bg-white text-zinc-900 w-[210mm] min-h-[297mm] shadow-xl p-[15mm] space-y-8 relative mx-auto box-border"
          >
            <div className="border-b border-zinc-200 pb-6 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <div className="size-6 bg-cyan-600 rounded flex items-center justify-center text-white font-bold text-xs">
                    NM
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-semibold">
                    National Museum
                  </span>
                </div>
                <h1 className="text-2xl font-serif text-zinc-900 font-bold tracking-tight leading-none">
                  Outgoing Loan Manifest
                </h1>
                <p className="text-muted-foreground mt-2 font-mono text-sm">
                  Ref: {loan.loanNumber}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  Date: <ClientCurrentDate locale={locale} />
                </p>
                <p>Page 1 of 4</p>
              </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded text-sm grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-bold text-zinc-900 uppercase text-[10px] tracking-wide mb-1">
                  Lender
                </h4>
                <p>National Museum</p>
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 uppercase text-[10px] tracking-wide mb-1">
                  Borrower (Consignee)
                </h4>
                <p>{loan.lenderBorrowerName}</p>
                {loan.lenderBorrowerContact && (
                  <p className="text-muted-foreground text-xs">
                    {loan.lenderBorrowerContact}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-zinc-900 uppercase text-[10px] tracking-wide mb-4 border-b border-zinc-100 pb-1">
                Loan Items
              </h4>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="py-2">Acc. No</th>
                    <th className="py-2">Object Title</th>
                    <th className="py-2 text-right">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loan.items.map((item) => (
                    <tr key={item.accessionNumber}>
                      <td className="py-2 font-mono">{item.accessionNumber}</td>
                      <td className="py-2">{item.title}</td>
                      <td className="py-2 text-right">
                        {item.conditionOut || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="absolute bottom-12 left-12 right-12 border-t border-zinc-200 pt-8 flex justify-between items-end">
              <div>
                <div className="h-12 w-48 border-b border-zinc-300 mb-1" />
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Released By (Registrar)
                </div>
              </div>
              <div>
                <div className="h-12 w-48 border-b border-zinc-300 mb-1" />
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Received By (Shipper)
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
