"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { LoanListFilters } from "./loan-list-filters";
import { LoanListKpis } from "./loan-list-kpis";
import { LoanListTable } from "./loan-list-table";
import { LoansBulkActionsBar } from "./loans-bulk-actions-bar";
import type { LoanListProps, LoanListRow } from "./types";
import { useLoanListBulkActions } from "./use-loan-list-bulk-actions";

export function LoanList({
  organizationId,
  statusFilter,
  typeFilter,
  searchQuery,
  onStatusFilterChange,
  onTypeFilterChange,
  onSearchQueryChange,
}: LoanListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"loans">>>(new Set());

  const loans = useQuery(
    api.loans.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status: statusFilter === "all" ? undefined : statusFilter,
          type: typeFilter === "all" ? undefined : typeFilter,
          search: searchQuery.trim() || undefined,
        }
      : "skip",
  );

  const isLoading = loans === undefined;
  const loansPage = useMemo(
    () => (loans?.page ?? []) as LoanListRow[],
    [loans?.page],
  );

  const activeLoansCount = loansPage.filter(
    (loan) => loan.status === "active",
  ).length;
  const totalItemsInTransit = loansPage.reduce(
    (sum, loan) => sum + (loan.itemCount || 0),
    0,
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const { handleBulkApprove, handleBulkCancel, handleExport } =
    useLoanListBulkActions({
      loansPage,
      selectedIds,
      onClearSelection: clearSelection,
    });

  const toggleSelection = useCallback((loanId: Id<"loans">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) {
        next.delete(loanId);
      } else {
        next.add(loanId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <LoanListKpis
        activeLoansCount={activeLoansCount}
        totalItemsInTransit={totalItemsInTransit}
      />

      <div className="space-y-4">
        <LoanListFilters
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
          onStatusFilterChange={onStatusFilterChange}
          onTypeFilterChange={onTypeFilterChange}
          onSearchQueryChange={onSearchQueryChange}
        />

        <LoanListTable
          loansPage={loansPage}
          isLoading={isLoading}
          hasMore={Boolean(loans?.continueCursor)}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
        />

        {!isLoading && loansPage.length > 0 && (
          <LoansBulkActionsBar
            selectedCount={selectedIds.size}
            onClearSelection={clearSelection}
            onBulkApprove={handleBulkApprove}
            onBulkCancel={handleBulkCancel}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  );
}
