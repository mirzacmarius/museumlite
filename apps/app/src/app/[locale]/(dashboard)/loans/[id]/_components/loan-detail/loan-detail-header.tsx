"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useBackToResultsLink } from "@/components/record-recovery-state";
import { useI18n, useScopedI18n } from "@/locales/client";
import { LoanAgreement } from "../loan-agreement/loan-agreement";
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
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");
  const common = useScopedI18n("common");
  const back = useBackToResultsLink("loans");

  return (
    <header className="sticky top-0 z-50 flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
          <Link href={back.href} aria-label={back.label} title={back.label}>
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="hidden text-muted-foreground sm:inline">
          {tRoot("loans.title")}
        </span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="hidden text-muted-foreground sm:inline">
          {loan.type === "incoming"
            ? tActions("incoming")
            : tActions("outgoing")}
        </span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="truncate font-medium text-foreground">
          {loan.loanNumber}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <LoanAgreement
          loanId={loan._id}
          organizationId={loan.organizationId}
          loan={{
            loanNumber: loan.loanNumber,
            type: loan.type,
            lenderBorrowerName: loan.lenderBorrowerName,
            lenderBorrowerContact: loan.lenderBorrowerContact,
            startDate: loan.startDate,
            endDate: loan.endDate,
            terms: loan.terms,
            insuranceValue: loan.insuranceValue,
            currency: loan.currency,
            account: loan.account,
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
