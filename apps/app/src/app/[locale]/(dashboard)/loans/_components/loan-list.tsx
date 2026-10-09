"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { usePaginatedQuery } from "convex/react";
import { useCallback, useState } from "react";
import { useDebouncedSearch, useListState } from "@/hooks/use-list-state";
import { useListReturnPath } from "@/hooks/use-return-path";
import { LoanListFilters } from "./loan-list-filters";
import { LoanListKpis } from "./loan-list-kpis";
import { LOAN_PAGE_SIZE, loanListState } from "./loan-list-state";
import { LoanListTable } from "./loan-list-table";
import { LoansBulkActionsBar } from "./loans-bulk-actions-bar";
import type { LoanListProps, LoanListRow } from "./types";
import { useLoanListBulkActions } from "./use-loan-list-bulk-actions";

export function LoanList({ organizationId }: LoanListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"loans">>>(new Set());
  const list = useListState(loanListState);
  const { status: statusFilter, type: typeFilter } = list.state.filters;
  const searchQuery = list.state.search;
  const updateList = list.update;
  const [searchInput, setSearchInput] = useDebouncedSearch(
    searchQuery,
    useCallback((search: string) => updateList({ search }), [updateList]),
  );
  const returnPath = useListReturnPath(loanListState.keys);

  const {
    results: loansPage,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.loans.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          status: statusFilter === "all" ? undefined : statusFilter,
          type: typeFilter === "all" ? undefined : typeFilter,
          search: searchQuery.trim() || undefined,
        }
      : "skip",
    { initialNumItems: list.state.show },
  );

  const isLoading = status === "LoadingFirstPage";
  const typedLoansPage = loansPage as LoanListRow[];

  const activeLoansCount = typedLoansPage.filter(
    (loan) => loan.status === "active",
  ).length;
  const loadedItemCount = typedLoansPage.reduce(
    (sum, loan) => sum + (loan.itemCount || 0),
    0,
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const { handleBulkApprove, handleBulkCancel, handleExport } =
    useLoanListBulkActions({
      loansPage: typedLoansPage,
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

  const handleLoadMore = () => {
    loadMore(LOAN_PAGE_SIZE);
    list.loadMore();
  };

  return (
    <div className="space-y-6">
      <LoanListKpis
        activeLoansCount={activeLoansCount}
        loadedItemCount={loadedItemCount}
      />

      <div className="space-y-4">
        <LoanListFilters
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchInput}
          onShowAll={() =>
            list.update({ filters: { status: "all", type: "all" } })
          }
          onStatusFilterChange={(value) =>
            list.update({ filters: { status: value } })
          }
          onTypeFilterChange={(value) =>
            list.update({ filters: { type: value } })
          }
          onSearchQueryChange={setSearchInput}
        />

        <LoanListTable
          loansPage={typedLoansPage}
          paginationStatus={status}
          onLoadMore={handleLoadMore}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
          isFiltered={list.isFiltered}
          onClearFilters={list.clear}
          returnPath={returnPath}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
        />

        {!isLoading && typedLoansPage.length > 0 && (
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
