"use client";

import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { Check, FileText, Shield, Upload } from "lucide-react";
import { LoanApprovalWorkflow } from "./loan-approval-workflow";
import type { Loan, LoanDocument } from "./types";

interface OverviewTabProps {
  loan: Loan;
  documents: LoanDocument[];
}

export function OverviewTab({ loan, documents }: OverviewTabProps) {
  const locale = useCurrentLocale();
  const tActions = useScopedI18n("loans.actions");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left: Approval Pipeline */}
      <div className="col-span-2 space-y-6">
        {/* Loan Workflow Actions */}
        <LoanApprovalWorkflow
          key={loan._id}
          loanId={loan._id}
          loanStatus={loan.status}
        />
        {/* Status Flow */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Approval Workflow
          </h3>
          <div className="relative">
            <div className="absolute top-4 left-0 w-full h-0.5 bg-secondary z-0" />
            <div className="relative z-10 grid grid-cols-5 gap-4">
              {/* Step 1 */}
              <div className="flex flex-col gap-2">
                <div className="size-8 rounded-full bg-cyan-600 border-4 border-background flex items-center justify-center text-white z-10 shadow-lg shadow-cyan-900/20">
                  <Check className="size-3.5" strokeWidth={3} />
                </div>
                <div className="pr-4">
                  <p className="text-xs font-semibold text-foreground">
                    Request
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Rec:{" "}
                    <ClientDate
                      timestamp={loan.startDate}
                      locale={locale}
                      options={{ month: "short", day: "numeric" }}
                    />
                  </p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex flex-col gap-2">
                <div className="size-8 rounded-full bg-cyan-600 border-4 border-background flex items-center justify-center text-white z-10 shadow-lg shadow-cyan-900/20">
                  <Check className="size-3.5" strokeWidth={3} />
                </div>
                <div className="pr-4">
                  <p className="text-xs font-semibold text-foreground">
                    Curatorial
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    App:{" "}
                    <ClientDate
                      timestamp={loan.startDate}
                      locale={locale}
                      options={{ month: "short", day: "numeric" }}
                    />
                  </p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex flex-col gap-2">
                <div className="size-8 rounded-full bg-amber-500 border-4 border-background flex items-center justify-center text-white z-10 shadow-lg shadow-amber-900/20 animate-pulse">
                  <span className="text-[10px] font-bold">3</span>
                </div>
                <div className="pr-4">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-500">
                    Facilities
                  </p>
                  <p className="text-[10px] text-muted-foreground">Reviewing</p>
                </div>
              </div>
              {/* Step 4 */}
              <div className="flex flex-col gap-2">
                <div className="size-8 rounded-full bg-secondary border-4 border-background flex items-center justify-center text-muted-foreground z-10">
                  <span className="text-[10px] font-bold">4</span>
                </div>
                <div className="pr-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Conservation
                  </p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
              </div>
              {/* Step 5 */}
              <div className="flex flex-col gap-2">
                <div className="size-8 rounded-full bg-secondary border-4 border-background flex items-center justify-center text-muted-foreground z-10">
                  <span className="text-[10px] font-bold">5</span>
                </div>
                <div className="pr-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dispatch
                  </p>
                  <p className="text-[10px] text-muted-foreground">Locked</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Borrower Details
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              MOMA-NY-001
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-6 gap-x-12">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Institution
              </div>
              <p className="text-sm text-foreground mt-1">
                {loan.lenderBorrowerName}
              </p>
              <p className="text-xs text-muted-foreground">
                {loan.lenderBorrowerContact}
              </p>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Exhibition Space
              </div>
              <p className="text-sm text-foreground mt-1">
                The Robert B. Menschel Galleries
              </p>
              <p className="text-xs text-muted-foreground">
                Floor 4, Wing West (Environment controlled)
              </p>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Loan Agreement
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">
                  <Check className="size-3" />
                  Countersigned
                </span>
                <span className="text-xs text-muted-foreground">
                  on <ClientDate timestamp={loan.startDate} locale={locale} />
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Costs
              </div>
              <p className="text-sm text-foreground mt-1">
                All costs to be borne by Borrower
              </p>
              <p className="text-xs text-muted-foreground">
                Wall-to-wall insurance coverage active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Key Docs */}
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Documents ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.map((doc) => {
              const iconClass =
                doc.documentType === "agreement"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : doc.documentType === "insurance"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "bg-muted text-muted-foreground";
              const Icon = doc.documentType === "insurance" ? Shield : FileText;

              return (
                <a
                  key={doc._id}
                  href={doc.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-secondary transition-colors group"
                >
                  <div
                    className={`size-8 rounded flex items-center justify-center shrink-0 ${iconClass}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {doc.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.documentType.charAt(0).toUpperCase() +
                        doc.documentType.slice(1)}{" "}
                      •{" "}
                      {doc.uploaderName ? (
                        `Uploaded by ${doc.uploaderName}`
                      ) : (
                        <ClientDate
                          timestamp={doc.uploadedAt}
                          locale={locale}
                        />
                      )}
                    </p>
                  </div>
                </a>
              );
            })}
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">
                No documents uploaded yet.
              </p>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-secondary transition-colors group opacity-60"
            >
              <div className="size-8 rounded bg-secondary text-muted-foreground flex items-center justify-center shrink-0 border border-dashed border-border">
                <Upload className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground italic">
                  {tActions("uploadFacilityReport")}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
