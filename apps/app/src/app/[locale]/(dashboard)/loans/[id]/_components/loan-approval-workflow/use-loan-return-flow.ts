"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useEffect, useReducer } from "react";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { isLoanItemReturned } from "./loan-item-utils";

interface UseLoanReturnFlowOptions {
  loanId: string;
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

      if (!state.isReturnDialogOpen && state.isConfirmDialogOpen) {
        if (state.selectedItemIds.size === 0) {
          return state;
        }

        return { ...state, selectedItemIds: new Set() };
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
      return { ...state, isConfirmDialogOpen: false };
  }
}

function buildReceiptsForItems(
  loanType: "incoming" | "outgoing",
  loanItems: LoanItem[],
  itemIdsToReturn: string[],
) {
  return itemIdsToReturn.flatMap((itemId) => {
    const item = loanItems.find((entry) => entry._id === itemId);
    if (!item) {
      return [];
    }
    if (loanType === "incoming") {
      return [{ loanItemId: item._id as Id<"loanItems"> }];
    }
    if (item.dispatchOriginLocationId && !item.dispatchOriginUnknown) {
      return [
        {
          loanItemId: item._id as Id<"loanItems">,
          confirmReturnToOrigin: true,
        },
      ];
    }
    return [{ loanItemId: item._id as Id<"loanItems"> }];
  });
}

export function useLoanReturnFlow({
  loanId,
  loanType,
  loanItems,
  returnLoan,
  isSubmitting,
  setIsSubmitting,
  setError,
}: UseLoanReturnFlowOptions) {
  const t = useScopedI18n("loans.actions");
  const [state, dispatch] = useReducer(
    returnFlowReducer,
    initialReturnFlowState,
  );

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
      const targetIds =
        itemIdsToReturn.length > 0
          ? itemIdsToReturn
          : loanItems.map((item) => item._id);
      const receipts = buildReceiptsForItems(
        loanType,
        loanItems,
        targetIds,
      );
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
      setError(err instanceof Error ? err.message : t("failedToReturn"));
      dispatch({ type: "closeConfirmOnError" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnClick = () => {
    if (hasMultipleItems && loanItems.length > 0) {
      dispatch({ type: "openReturnDialog" });
    } else {
      handleReturn([]);
    }
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

  const isFullReturn = state.pendingReturnItemIds.length === loanItems.length;

  return {
    t,
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
    isFullReturn,
    handleReturn,
    handleReturnClick,
    handleProceedToConfirm,
  };
}

export type LoanReturnFlow = ReturnType<typeof useLoanReturnFlow>;
