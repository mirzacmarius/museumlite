"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Send } from "lucide-react";
import Link from "next/link";
import { ClientDate } from "@/components/client-date";
import { getLoanStatusLabel, getLoanTypeLabel } from "@/lib/record-enum-labels";
import { useI18n } from "@/locales/client";
import { DetailSection } from "./detail-section";
import type { LoanForCollection } from "./types";

interface LoansTabProps {
  collectionId: string;
  locale: string;
  hasAccess: boolean;
}

export function LoansTab({ collectionId, locale, hasAccess }: LoansTabProps) {
  const tRoot = useI18n();
  const loans = useQuery(
    api.loans.getLoansForCollection,
    hasAccess && collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasAccess) {
    return (
      <FeatureGuard
        featureName={tRoot("objects.tabs.loans")}
        reason={{ kind: "tier_required", tier: "pro" }}
        showAction={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  return (
    <DetailSection
      title={tRoot("untranslatedRecords.loans.items.loanHistory")}
      icon={Send}
      bodyClassName="border-0 bg-transparent p-0 sm:p-0"
    >
      {loans === undefined ? (
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.objects.loading.loans")}
        </p>
      ) : loans.length > 0 ? (
        <div className="space-y-4">
          {loans.map((loan: LoanForCollection) => (
            <Link
              key={loan._id}
              href={`/loans/${loan._id}`}
              className="block rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-accent/30 hover:bg-accent/5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent-foreground">
                      {loan.loanNumber}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-bold uppercase",
                        loan.type === "incoming"
                          ? "border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
                          : "border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                      )}
                    >
                      {getLoanTypeLabel(loan.type, tRoot)}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-bold uppercase",
                        loan.status === "active"
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : loan.status === "dispatched"
                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : loan.status === "returned"
                              ? "badge-neutral"
                              : "badge-neutral",
                      )}
                    >
                      {getLoanStatusLabel(loan.status, tRoot)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {loan.lenderBorrowerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">
                    <ClientDate timestamp={loan.startDate} locale={locale} />
                    {loan.endDate && (
                      <>
                        {" - "}
                        <ClientDate timestamp={loan.endDate} locale={locale} />
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          variant="card"
          size="sm"
          title={tRoot("untranslatedRecords.loans.items.noLoanHistory")}
        />
      )}
    </DetailSection>
  );
}
