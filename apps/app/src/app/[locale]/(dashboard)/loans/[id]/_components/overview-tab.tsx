"use client";

import { FileText, Shield } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { TargetPartyLinks } from "@/components/target-party-links";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { LoanApprovalWorkflow } from "./loan-approval-workflow/loan-approval-workflow";
import type { Loan, LoanDocument } from "./types";

interface OverviewTabProps {
  loan: Loan;
  documents: LoanDocument[];
}

export function OverviewTab({ loan, documents }: OverviewTabProps) {
  const tRoot = useI18n();
  const locale = useCurrentLocale();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="min-w-0 space-y-6 md:col-span-2">
        {/* Loan Workflow Actions */}
        <LoanApprovalWorkflow
          key={loan._id}
          loanId={loan._id}
          loanStatus={loan.status}
        />
        <TargetPartyLinks
          target={{ type: "loan", id: loan._id }}
          organizationId={loan.organizationId}
          writePermission="loans.update"
        />
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {tRoot("loans.actions.borrowerDetails")}
          </h3>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tRoot("loans.actions.institution")}
          </div>
          <p className="mt-1 break-words text-sm text-foreground">
            {loan.lenderBorrowerName}
          </p>
          {loan.lenderBorrowerContact ? (
            <p className="break-words text-xs text-muted-foreground">
              {loan.lenderBorrowerContact}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right: Key Docs */}
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            {tRoot("untranslatedRecords.loans.items.documentsCount", {
              count: documents.length,
            })}
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
                        tRoot("untranslatedRecords.loans.items.uploadedBy", {
                          name: doc.uploaderName,
                        })
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
                {tRoot("loans.actions.noDocumentsUploaded")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
