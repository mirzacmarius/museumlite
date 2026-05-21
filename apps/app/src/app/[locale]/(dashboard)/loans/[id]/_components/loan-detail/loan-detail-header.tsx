"use client";

import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { AlertCircle, ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { LoanAgreement } from "../loan-agreement";
import type { Loan } from "../types";

interface LoanDetailHeaderProps {
  loan: Loan;
  organizationName: string;
  onOpenPrint: () => void;
}

export function LoanDetailHeader({
  loan,
  organizationName,
  onOpenPrint,
}: LoanDetailHeaderProps) {
  const tActions = useScopedI18n("loans.actions");
  const common = useScopedI18n("common");

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href="/loans">
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="text-muted-foreground flex items-center gap-2">
          Loans
        </span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground">
          {loan.type === "incoming"
            ? tActions("incoming")
            : tActions("outgoing")}
        </span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">{loan.loanNumber}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded text-[10px] font-medium text-amber-600 dark:text-amber-500">
          <AlertCircle className="size-3" />
          {tActions("pendingFacilityReportApproval")}
        </div>
        <div className="h-4 w-px bg-border" />
        <LoanAgreement
          loan={{
            loanNumber: loan.loanNumber,
            type: loan.type,
            lenderBorrowerName: loan.lenderBorrowerName,
            lenderBorrowerContact: loan.lenderBorrowerContact,
            startDate: loan.startDate,
            endDate: loan.endDate,
            insuranceValue: loan.insuranceValue,
          }}
          items={loan.items.map((item) => ({
            accessionNumber: item.accessionNumber,
            title: item.title,
            conditionOut: item.conditionOut,
          }))}
          organizationName={organizationName}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title={common("printManifest")}
          onClick={onOpenPrint}
        >
          <Printer className="size-4" />
        </Button>
      </div>
    </header>
  );
}
