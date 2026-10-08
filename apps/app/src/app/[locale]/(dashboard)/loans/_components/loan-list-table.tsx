"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { DataTable } from "@v1/ui/data-table";
import { ChevronRight, Handshake, Plus } from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import {
  formatLoanDateRange,
  getLoanStatusLabel,
  getLoanTypeIcon,
  getPartnerInitial,
} from "./loan-list-utils";
import type { LoanListRow, LoanStatus, LoanType } from "./types";

interface LoanListTableProps {
  loansPage: LoanListRow[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
  selectedIds: Set<Id<"loans">>;
  onToggleSelection: (loanId: Id<"loans">) => void;
}

export function LoanListTable({
  loansPage,
  isLoading,
  hasMore,
  onLoadMore,
  statusFilter,
  typeFilter,
  searchQuery,
  selectedIds,
  onToggleSelection,
}: LoanListTableProps) {
  const t = useScopedI18n("loans");
  const tRoot = useI18n();
  const locale = useCurrentLocale();

  const statusLabels = {
    pending: t("status.pendingReview"),
    pendingReview: t("status.pendingReview"),
    active: t("status.active"),
    dispatched: t("status.dispatched"),
    returned: t("status.returned"),
    cancelled: t("status.cancelled"),
    draft: t("status.draft"),
  };

  return (
    <>
      <DataTable<LoanListRow>
        loading={isLoading}
        data={loansPage}
        columns={[
          {
            key: "checkbox",
            label: "",
            className: "w-12 flex-none justify-center px-3",
            render: (loan) => {
              const loanId = loan._id;
              const isSelected = selectedIds.has(loanId);
              return (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(loanId)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={tRoot(
                    "untranslatedRecords.loans.items.selectLoan",
                    {
                      number: loan.loanNumber,
                    },
                  )}
                />
              );
            },
          },
          {
            key: "type",
            label: t("table.type"),
            className: "w-20 flex-none justify-center px-3",
            render: (loan) => getLoanTypeIcon(loan.type),
          },
          {
            key: "loanNumber",
            label: t("table.loanIdTitle"),
            className: "min-w-0 flex-[1.45]",
            render: (loan) => (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold">
                  {loan.loanNumber}
                </span>
                <span className="mt-0.5 truncate text-xs text-foreground/80">
                  {loan.itemCount}{" "}
                  {loan.itemCount !== 1
                    ? t("table.itemsPlural")
                    : t("table.items")}
                </span>
              </div>
            ),
          },
          {
            key: "lenderBorrowerName",
            label: t("table.partnerInstitution"),
            className: "min-w-0 flex-[1.25]",
            render: (loan) => (
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground">
                  {getPartnerInitial(loan.lenderBorrowerName)}
                </div>
                <span className="min-w-0 truncate text-xs">
                  {loan.lenderBorrowerName}
                </span>
              </div>
            ),
          },
          {
            key: "duration",
            label: t("table.duration"),
            className: "w-40 flex-none",
            render: (loan) => (
              <div className="text-xs text-foreground/80">
                {formatLoanDateRange(loan.startDate, loan.endDate, locale)}
              </div>
            ),
          },
          {
            key: "status",
            label: t("table.status"),
            className: "w-40 flex-none",
            render: (loan) => (
              <span className="truncate text-xs text-foreground/80">
                {getLoanStatusLabel(loan.status, statusLabels)}
              </span>
            ),
          },
          {
            key: "action",
            label: "",
            className: "w-12 flex-none justify-center px-3 text-right",
            render: () => (
              <ChevronRight className="inline-block size-4 text-foreground/80" />
            ),
          },
        ]}
        rowHref={(loan) => `/loans/${loan._id}`}
        rowAriaLabel={(loan) =>
          tRoot("untranslatedRecords.loans.actions.viewLoan", {
            number: loan.loanNumber ?? loan._id,
          })
        }
        emptyState={
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Handshake className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-muted-foreground">
                {t("emptyState.noLoansFound")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground/60">
                {searchQuery
                  ? t("emptyState.adjustSearch")
                  : statusFilter === "all" && typeFilter === "all"
                    ? t("emptyState.createFirst")
                    : tRoot(
                        "untranslatedRecords.loans.items.noLoansForStatus",
                        {
                          status:
                            statusFilter !== "all"
                              ? statusLabels[statusFilter]
                              : "",
                          type:
                            typeFilter !== "all"
                              ? t(`filters.${typeFilter}`)
                              : "",
                        },
                      )}
              </p>
            </div>
            {statusFilter === "all" && typeFilter === "all" && (
              <PermissionGate permission="loans.create">
                <Button asChild>
                  <Link href="/loans/new">
                    <Plus className="size-4" />
                    {t("createLoan")}
                  </Link>
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />

      {!isLoading && (loansPage.length > 0 || hasMore) && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
          <span>{t("pagination.loaded", { count: loansPage.length })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border/60 px-2 py-1 hover:bg-card/50 disabled:opacity-50"
              disabled
            >
              {t("pagination.previous")}
            </button>
            <button
              type="button"
              className="rounded border border-border/60 px-2 py-1 hover:bg-card/50"
              disabled={!hasMore}
              onClick={onLoadMore}
            >
              {t("pagination.next")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
