"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { DataTable } from "@v1/ui/data-table";
import { ChevronRight, Handshake, Plus } from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { withReturnPath } from "@/lib/return-path";
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
  paginationStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  onLoadMore: () => void;
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
  isFiltered: boolean;
  onClearFilters: () => void;
  /** The list view to return to from a loan. */
  returnPath: string;
  selectedIds: Set<Id<"loans">>;
  onToggleSelection: (loanId: Id<"loans">) => void;
  tableRef: Ref<HTMLTableElement>;
}

export function LoanListTable({
  loansPage,
  paginationStatus,
  onLoadMore,
  statusFilter,
  typeFilter,
  searchQuery,
  isFiltered,
  onClearFilters,
  returnPath,
  selectedIds,
  onToggleSelection,
  tableRef,
}: LoanListTableProps) {
  const t = useScopedI18n("loans");
  const tList = useScopedI18n("listState");
  const tRoot = useI18n();
  const isLoading = paginationStatus === "LoadingFirstPage";
  const hasMore = paginationStatus === "CanLoadMore";
  const isLoadingMore = paginationStatus === "LoadingMore";
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
        ref={tableRef}
        label={t("title")}
        loading={isLoading}
        data={loansPage}
        columns={[
          {
            key: "select",
            label: t("table.select"),
            hideLabel: true,
            interactive: true,
            align: "center",
            className: "w-12 px-3",
            render: (loan) => (
              <Checkbox
                checked={selectedIds.has(loan._id)}
                onCheckedChange={() => onToggleSelection(loan._id)}
                aria-label={tRoot(
                  "untranslatedRecords.loans.items.selectLoan",
                  {
                    number: loan.loanNumber,
                  },
                )}
              />
            ),
          },
          {
            key: "type",
            label: t("table.type"),
            align: "center",
            className: "w-20 px-3",
            render: (loan) =>
              getLoanTypeIcon(
                loan.type,
                loan.type === "incoming"
                  ? t("filters.incoming")
                  : t("filters.outgoing"),
              ),
          },
          {
            key: "loanNumber",
            label: t("table.loanIdTitle"),
            rowHeader: true,
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
            render: (loan) => (
              <div className="flex min-w-0 items-center gap-2">
                <div
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground"
                >
                  {getPartnerInitial(loan.lenderBorrowerName)}
                </div>
                <span
                  className="min-w-0 truncate text-xs"
                  title={loan.lenderBorrowerName}
                >
                  {loan.lenderBorrowerName}
                </span>
              </div>
            ),
          },
          {
            key: "duration",
            label: t("table.duration"),
            className: "w-40",
            render: (loan) => (
              <div className="text-xs text-foreground/80">
                {formatLoanDateRange(loan.startDate, loan.endDate, locale)}
              </div>
            ),
          },
          {
            key: "status",
            label: t("table.status"),
            className: "w-52",
            render: (loan) => (
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-xs text-foreground/80">
                  {getLoanStatusLabel(loan.status, statusLabels)}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-foreground/80"
                />
              </div>
            ),
          },
        ]}
        rowHref={(loan) => withReturnPath(`/loans/${loan._id}`, returnPath)}
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
            {isFiltered ? (
              <Button variant="outline" onClick={onClearFilters}>
                {tList("clearFilters")}
              </Button>
            ) : (
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
          {hasMore || isLoadingMore ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? tList("loading") : tList("loadMore")}
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
