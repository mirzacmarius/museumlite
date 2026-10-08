"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useEffect, useReducer, useState } from "react";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { isLoanItemReturned } from "./loan-item-utils";

interface UseLoanReturnFlowOptions {
  loanId: string;
  organizationId?: Id<"organizations">;
  loanType: "incoming" | "outgoing";
  loanItems: LoanItem[];
  returnLoan: (args: {
    loanId: Id<"loans">;
    loanItemIds?: Id<"loanItems">[];
    receipts?: Array<{
      loanItemId: Id<"loanItems">;
      confirmReturnToOrigin?: boolean;
      destinationLocationId?: Id<"locations">;
      conditionIn?: string;
      incomingConditionAssessmentId?: Id<"conditionAssessments">;
    }>;
  }) => Promise<unknown>;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setError: (value: string | null) => void;
}

interface ReturnFlowState {
  isReturnDialogOpen: boolean;
  isConfirmDialogOpen: boolean;
  selectedItemIds: Set<string>;
  pendingReturnItemIds: string[];
}

type ReturnFlowAction =
  | { type: "openReturnDialog" }
  | { type: "openConfirmDialog"; pendingReturnItemIds: string[] }
  | { type: "setReturnDialogOpen"; value: boolean }
  | { type: "setConfirmDialogOpen"; value: boolean }
  | { type: "setSelectedItemIds"; value: Set<string> }
  | { type: "syncDialogState" }
  | { type: "pruneReturnedItems"; loanItems: LoanItem[] }
  | { type: "resetAfterReturn" }
  | { type: "closeConfirmOnError" };

const initialReturnFlowState: ReturnFlowState = {
  isReturnDialogOpen: false,
  isConfirmDialogOpen: false,
  selectedItemIds: new Set(),
  pendingReturnItemIds: [],
};

function returnFlowReducer(
  state: ReturnFlowState,
  action: ReturnFlowAction,
): ReturnFlowState {
  switch (action.type) {
    case "openReturnDialog":
      return {
        ...state,
        selectedItemIds: new Set(),
        isReturnDialogOpen: true,
      };
    case "openConfirmDialog":
      return {
        ...state,
        pendingReturnItemIds: action.pendingReturnItemIds,
        isReturnDialogOpen: false,
        isConfirmDialogOpen: true,
      };
    case "setReturnDialogOpen":
      return { ...state, isReturnDialogOpen: action.value };
    case "setConfirmDialogOpen":
      return { ...state, isConfirmDialogOpen: action.value };
    case "setSelectedItemIds":
      return { ...state, selectedItemIds: action.value };
    case "syncDialogState": {
      if (!state.isReturnDialogOpen && !state.isConfirmDialogOpen) {
        if (
          state.selectedItemIds.size === 0 &&
          state.pendingReturnItemIds.length === 0
        ) {
          return state;
        }

        return {
          ...state,
          selectedItemIds: new Set(),
          pendingReturnItemIds: [],
        };
      }

      return state;
    }
    case "pruneReturnedItems": {
      if (action.loanItems.length === 0 || !state.isReturnDialogOpen) {
        return state;
      }

      const nextSelected = new Set(state.selectedItemIds);
      let changed = false;
      for (const item of action.loanItems) {
        if (isLoanItemReturned(item) && nextSelected.has(item._id)) {
          nextSelected.delete(item._id);
          changed = true;
        }
      }

      return changed ? { ...state, selectedItemIds: nextSelected } : state;
    }
    case "resetAfterReturn":
      return initialReturnFlowState;
    case "closeConfirmOnError":
      return { ...state, isConfirmDialogOpen: false, isReturnDialogOpen: true };
  }
}

export interface LoanReceiptEvidence {
  destinationLocationId?: string;
  confirmReturnToOrigin?: boolean;
  conditionIn?: string;
  incomingConditionAssessmentId?: string;
}

export function useLoanReturnFlow({
  loanId,
  organizationId,
  loanType,
  loanItems,
  returnLoan,
  isSubmitting,
  setIsSubmitting,
  setError,
}: UseLoanReturnFlowOptions) {
  const t = useScopedI18n("loans.actions");
  const custodyConflictMessage = useCustodyConflictMessage();
  const [state, dispatch] = useReducer(
    returnFlowReducer,
    initialReturnFlowState,
  );

  const [evidenceByItem, setEvidenceByItem] = useState<
    Record<string, LoanReceiptEvidence>
  >({});

  const hasMultipleItems = loanItems.length > 1;

  useEffect(() => {
    dispatch({ type: "syncDialogState" });
  }, [state.isReturnDialogOpen, state.isConfirmDialogOpen]);

  useEffect(() => {
    dispatch({ type: "pruneReturnedItems", loanItems });
  }, [loanItems, state.isReturnDialogOpen]);

  const handleReturn = async (itemIdsToReturn: string[] = []) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const targetIds: string[] = [...itemIdsToReturn];
      if (targetIds.length === 0) {
        for (const item of loanItems) {
          if (!isLoanItemReturned(item)) {
            targetIds.push(item._id);
          }
        }
      }
      const receipts = targetIds.map((loanItemId) => {
        const evidence = evidenceByItem[loanItemId] ?? {};
        return {
          loanItemId: loanItemId as Id<"loanItems">,
          confirmReturnToOrigin: evidence.confirmReturnToOrigin,
          destinationLocationId: evidence.destinationLocationId
            ? (evidence.destinationLocationId as Id<"locations">)
            : undefined,
          conditionIn: evidence.conditionIn?.trim() || undefined,
          incomingConditionAssessmentId: evidence.incomingConditionAssessmentId
            ? (evidence.incomingConditionAssessmentId as Id<"conditionAssessments">)
            : undefined,
        };
      });
      await returnLoan({
        loanId: loanId as Id<"loans">,
        loanItemIds:
          itemIdsToReturn.length > 0
            ? (itemIdsToReturn as Id<"loanItems">[])
            : undefined,
        receipts: receipts.length > 0 ? receipts : undefined,
      });
      dispatch({ type: "resetAfterReturn" });
    } catch (err) {
      setError(custodyConflictMessage(err, t("failedToReturn")));
      dispatch({ type: "closeConfirmOnError" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnClick = () => {
    dispatch({ type: "openReturnDialog" });
  };

  const handleProceedToConfirm = () => {
    if (state.selectedItemIds.size === 0) {
      setError(t("selectAtLeastOne"));
      return;
    }

    dispatch({
      type: "openConfirmDialog",
      pendingReturnItemIds: Array.from(state.selectedItemIds),
    });
  };

  const canProceed =
    state.selectedItemIds.size > 0 &&
    Array.from(state.selectedItemIds).every((itemId) => {
      const evidence = evidenceByItem[itemId];
      return (
        !!evidence &&
        !!(
          evidence.conditionIn?.trim() || evidence.incomingConditionAssessmentId
        ) &&
        (loanType === "incoming" ||
          evidence.confirmReturnToOrigin === true ||
          !!evidence.destinationLocationId)
      );
    });

  const outstandingItemCount = loanItems.filter(
    (item) => !isLoanItemReturned(item),
  ).length;
  const isFullReturn =
    state.pendingReturnItemIds.length === outstandingItemCount;

  return {
    t,
    loanType,
    organizationId,
    evidenceByItem,
    setEvidence: (itemId: string, evidence: LoanReceiptEvidence) =>
      setEvidenceByItem((previous) => ({ ...previous, [itemId]: evidence })),
    hasMultipleItems,
    isSubmitting,
    isReturnDialogOpen: state.isReturnDialogOpen,
    setIsReturnDialogOpen: (value: boolean) =>
      dispatch({ type: "setReturnDialogOpen", value }),
    isConfirmDialogOpen: state.isConfirmDialogOpen,
    setIsConfirmDialogOpen: (value: boolean) =>
      dispatch({ type: "setConfirmDialogOpen", value }),
    selectedItemIds: state.selectedItemIds,
    setSelectedItemIds: (value: Set<string>) =>
      dispatch({ type: "setSelectedItemIds", value }),
    pendingReturnItemIds: state.pendingReturnItemIds,
    canProceed,
    outstandingItemCount,
    isFullReturn,
    handleReturn,
    handleReturnClick,
    handleProceedToConfirm,
  };
}

export type LoanReturnFlow = ReturnType<typeof useLoanReturnFlow>;
