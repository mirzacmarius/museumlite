"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useScopedI18n } from "@/locales/client";
import { buildSelectedLoansCsv } from "./loan-list-utils";
import type { LoanListRow } from "./types";

interface UseLoanListBulkActionsOptions {
  loansPage: LoanListRow[];
  selectedIds: Set<Id<"loans">>;
  onClearSelection: () => void;
}

export function useLoanListBulkActions({
  loansPage,
  selectedIds,
  onClearSelection,
}: UseLoanListBulkActionsOptions) {
  const t = useScopedI18n("loans");
  const tToast = useScopedI18n("common.toast");
  const tBulk = useScopedI18n("loans.bulkActions");
  const bulkApprove = useMutation(api.loans.bulkApprove);
  const bulkCancel = useMutation(api.loans.bulkCancel);

  const handleBulkApprove = useCallback(async () => {
    const loanIds = Array.from(selectedIds);
    try {
      const result = await bulkApprove({ loanIds });
      if (result.approved > 0) {
        toast.success(tToast("loansApproved", { count: result.approved }));
      }
      if (result.skipped > 0) {
        toast.warning(tToast("someLoansSkipped", { count: result.skipped }));
      }
      if (result.errors.length > 0) {
        toast.error(tToast("loansApproveFailed"));
      }
      onClearSelection();
    } catch {
      toast.error(tToast("loansApproveFailed"));
    }
  }, [bulkApprove, onClearSelection, selectedIds, tToast]);

  const handleBulkCancel = useCallback(async () => {
    const loanIds = Array.from(selectedIds);
    try {
      const result = await bulkCancel({ loanIds });
      if (result.cancelled > 0) {
        toast.success(tToast("loansCancelled", { count: result.cancelled }));
      }
      if (result.skipped > 0) {
        toast.warning(tToast("loansCancelSkipped", { count: result.skipped }));
      }
      if (result.errors.length > 0) {
        toast.error(tToast("loansCancelFailed"));
      }
      onClearSelection();
    } catch {
      toast.error(tToast("loansCancelFailed"));
    }
  }, [bulkCancel, onClearSelection, selectedIds, tToast]);

  const handleExport = useCallback(() => {
    const selectedLoans = loansPage.filter((loan) => selectedIds.has(loan._id));
    const csvContent = buildSelectedLoansCsv(selectedLoans, [
      tBulk("csvHeaders.loanNumber"),
      tBulk("csvHeaders.type"),
      tBulk("csvHeaders.partner"),
      tBulk("csvHeaders.startDate"),
      tBulk("csvHeaders.endDate"),
      tBulk("csvHeaders.status"),
      tBulk("csvHeaders.items"),
    ]);

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loans-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      t("actions.exportedLoans", {
        count: selectedLoans.length,
        plural: selectedLoans.length !== 1 ? "s" : "",
      }),
    );
  }, [loansPage, selectedIds, t, tBulk]);

  return { handleBulkApprove, handleBulkCancel, handleExport };
}
