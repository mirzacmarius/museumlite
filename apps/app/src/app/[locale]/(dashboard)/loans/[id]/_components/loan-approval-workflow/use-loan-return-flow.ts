"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { isLoanItemReturned } from "./loan-item-utils";

interface UseLoanReturnFlowOptions {
  loanId: string;
  loanItems: LoanItem[];
  returnLoan: (args: {
    loanId: Id<"loans">;
    loanItemIds?: Id<"loanItems">[];
  }) => Promise<unknown>;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export function useLoanReturnFlow({
  loanId,
  loanItems,
  returnLoan,
  isSubmitting,
  setIsSubmitting,
  setError,
}: UseLoanReturnFlowOptions) {
  const t = useScopedI18n("loans.actions");
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingReturnItemIds, setPendingReturnItemIds] = useState<string[]>(
    [],
  );

  const hasMultipleItems = loanItems.length > 1;

  useEffect(() => {
    if (!isReturnDialogOpen && !isConfirmDialogOpen) {
      setSelectedItemIds(new Set());
      setPendingReturnItemIds([]);
    } else if (!isReturnDialogOpen && isConfirmDialogOpen) {
      setSelectedItemIds(new Set());
    }
  }, [isReturnDialogOpen, isConfirmDialogOpen]);

  useEffect(() => {
    if (loanItems.length > 0 && isReturnDialogOpen) {
      setSelectedItemIds((prev) => {
        const newSet = new Set(prev);
        let changed = false;
        for (const item of loanItems) {
          if (isLoanItemReturned(item) && newSet.has(item._id)) {
            newSet.delete(item._id);
            changed = true;
          }
        }
        return changed ? newSet : prev;
      });
    }
  }, [loanItems, isReturnDialogOpen]);

  const handleReturn = async (itemIdsToReturn: string[] = []) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await returnLoan({
        loanId: loanId as Id<"loans">,
        loanItemIds:
          itemIdsToReturn.length > 0
            ? (itemIdsToReturn as Id<"loanItems">[])
            : undefined,
      });
      setIsReturnDialogOpen(false);
      setIsConfirmDialogOpen(false);
      setSelectedItemIds(new Set());
      setPendingReturnItemIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToReturn"));
      setIsConfirmDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnClick = () => {
    if (hasMultipleItems && loanItems.length > 0) {
      setSelectedItemIds(new Set());
      setIsReturnDialogOpen(true);
    } else {
      handleReturn([]);
    }
  };

  const handleProceedToConfirm = () => {
    if (selectedItemIds.size === 0) {
      setError(t("selectAtLeastOne"));
      return;
    }
    setPendingReturnItemIds(Array.from(selectedItemIds));
    setIsReturnDialogOpen(false);
    setIsConfirmDialogOpen(true);
  };

  const isFullReturn = pendingReturnItemIds.length === loanItems.length;

  return {
    t,
    hasMultipleItems,
    isSubmitting,
    isReturnDialogOpen,
    setIsReturnDialogOpen,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    selectedItemIds,
    setSelectedItemIds,
    pendingReturnItemIds,
    isFullReturn,
    handleReturn,
    handleReturnClick,
    handleProceedToConfirm,
  };
}

export type LoanReturnFlow = ReturnType<typeof useLoanReturnFlow>;
