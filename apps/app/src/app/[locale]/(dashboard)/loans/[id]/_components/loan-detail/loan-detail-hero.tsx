"use client";

import { cn } from "@v1/ui/utils";
import { Banknote, CalendarRange, Check, Copy, Layers } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { RecordedValue } from "@/components/recorded-value";
import type { FormatLocale } from "@/lib/format-number";
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
    <div className="border-b border-border/60 bg-secondary/10 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto flex max-w-7xl items-start gap-8">
        <div className="shrink-0 relative group">
          <div className="size-32 rounded-xl border border-border shadow-2xl bg-background flex items-center justify-center p-2 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(#6b7280 1px, transparent 1px)",
                backgroundSize: "8px 8px",
              }}
            />
            <span className="text-4xl font-bold tracking-tighter relative z-10 text-foreground">
              {loan.lenderBorrowerName.slice(0, 4).toUpperCase()}
            </span>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-background">
            {tActions("trusted")}
          </div>
        </div>

        <div className="flex-1 space-y-4">
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
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground">
              <span className="font-medium">{tActions("international")}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-foreground font-mono bg-background px-2 py-1 rounded border border-border shadow-sm ml-auto">
              <span className="text-muted-foreground select-none">
                {tRoot("untranslatedRecords.loans.detail.idLabel")}
              </span>
              <span>{loan.loanNumber}</span>
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy
                  className="size-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  onClick={onCopyId}
                />
              )}
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight leading-tight mb-1">
              {tRoot("accessions.form.methods.loan")} {loan.loanNumber}
            </h1>
            <p className="text-muted-foreground text-sm">
              {loan.type === "outgoing"
                ? tActions("borrower")
                : tActions("lenderLabel")}
              : {loan.lenderBorrowerName}
            </p>
          </div>

          <div className="flex items-center gap-6 pt-2">
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
                {loan.items.length}{" "}
                {tRoot("untranslatedRecords.loans.items.objectsPaintings")}
              </span>
            </div>
            {loan.insuranceValue && (
              <div className="flex items-center gap-2 text-xs">
                <Banknote className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {tActions("totalValue")}{" "}
                  <RecordedValue value={loan.insuranceValue} />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
