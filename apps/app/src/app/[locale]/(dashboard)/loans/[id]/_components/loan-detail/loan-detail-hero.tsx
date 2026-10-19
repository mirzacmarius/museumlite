"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { Banknote, CalendarRange, Check, Copy, Layers } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import {
  type FormatLocale,
  formatCurrency,
  formatNumber,
} from "@/lib/format-number";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";

interface LoanDetailHeroProps {
  loan: Loan;
  locale: FormatLocale;
  copied: boolean;
  onCopyId: () => void;
}

export function LoanDetailHero({
  loan,
  locale,
  copied,
  onCopyId,
}: LoanDetailHeroProps) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");

  return (
    <div className="border-b border-border/60 bg-secondary/10 p-4 sm:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
        <div className="relative shrink-0">
          <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-background p-2 shadow-2xl sm:size-32">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(#6b7280 1px, transparent 1px)",
                backgroundSize: "8px 8px",
              }}
            />
            <span className="relative z-10 text-xl font-bold tracking-tighter text-foreground sm:text-4xl">
              {loan.lenderBorrowerName.slice(0, 4).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center flex-wrap gap-2.5">
            <div
              className={cn(
                "px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm",
                loan.type === "outgoing"
                  ? "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400"
                  : "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400",
              )}
            >
              {loan.type === "outgoing"
                ? tActions("outgoingLoan")
                : tActions("incomingLoan")}
            </div>
            <div className="flex items-center gap-1.5 rounded border border-border bg-background py-0.5 pl-2 pr-0.5 font-mono text-xs text-foreground shadow-sm sm:ml-auto">
              <span className="select-none text-muted-foreground">
                {tRoot("untranslatedRecords.loans.detail.idLabel")}
              </span>
              <span className="break-all">{loan.loanNumber}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={tActions("copyLoanNumber")}
                title={tActions("copyLoanNumber")}
                onClick={onCopyId}
              >
                {copied ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <h1 className="mb-1 break-words text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {tRoot("accessions.form.methods.loan")} {loan.loanNumber}
            </h1>
            <p className="break-words text-sm text-muted-foreground">
              {loan.type === "outgoing"
                ? tActions("borrower")
                : tActions("lenderLabel")}
              : {loan.lenderBorrowerName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
            <div className="flex items-center gap-2 text-xs">
              <CalendarRange className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                <ClientDate
                  timestamp={loan.startDate}
                  locale={locale}
                  options={{
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }}
                />{" "}
                {tRoot("untranslatedRecords.objects.transfer.to")}{" "}
                {loan.endDate ? (
                  <ClientDate
                    timestamp={loan.endDate}
                    locale={locale}
                    options={{
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }}
                  />
                ) : (
                  tActions("indefinite")
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Layers className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {tRoot("loans.actions.objectsTab", {
                  count: loan.items.length,
                })}
              </span>
            </div>
            {loan.insuranceValue ? (
              <div className="flex items-center gap-2 text-xs">
                <Banknote className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {tActions("totalValue")}{" "}
                  {loan.currency
                    ? formatCurrency(loan.insuranceValue, locale, loan.currency)
                    : formatNumber(loan.insuranceValue, locale)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
