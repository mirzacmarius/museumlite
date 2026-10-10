"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useEffect, useReducer, useState } from "react";
import type { Refusal } from "@/components/action-refusal";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
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
}

interface ReturnFlowState {
  isReturnDialogOpen: boolean;
  isConfirmDialogOpen: boolean;
  selectedItemIds: Set<string>;
  pendingReturnItemIds: string[];
  /** Missing evidence is shown once staff have tried to continue. */
  showEvidenceProblems: boolean;
  refusal: Refusal | null;
}

type ReturnFlowAction =
  | { type: "openReturnDialog" }
  | { type: "openConfirmDialog"; pendingReturnItemIds: string[] }
  | { type: "setReturnDialogOpen"; value: boolean }
  | { type: "setConfirmDialogOpen"; value: boolean }
  | { type: "setSelectedItemIds"; value: Set<string> }
  | { type: "syncDialogState"; isSubmitting: boolean }
  | { type: "pruneReturnedItems"; loanItems: LoanItem[] }
  | { type: "showEvidenceProblems" }
  | { type: "resetAfterReturn" }
  | { type: "refused"; refusal: Refusal };

const initialReturnFlowState: ReturnFlowState = {
  isReturnDialogOpen: false,
  isConfirmDialogOpen: false,
  selectedItemIds: new Set(),
  pendingReturnItemIds: [],
  showEvidenceProblems: false,
  refusal: null,
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
        showEvidenceProblems: false,
        refusal: null,
      };
    case "openConfirmDialog":
      return {
        ...state,
        pendingReturnItemIds: action.pendingReturnItemIds,
        isReturnDialogOpen: false,
        isConfirmDialogOpen: true,
        refusal: null,
      };
    case "setReturnDialogOpen":
      return { ...state, isReturnDialogOpen: action.value };
    case "setConfirmDialogOpen":
      return { ...state, isConfirmDialogOpen: action.value };
    case "setSelectedItemIds":
      return { ...state, selectedItemIds: action.value };
    case "syncDialogState": {
      // A return in flight keeps its selection, so a refusal can reopen the
      // dialog with everything staff entered.
      if (
        !action.isSubmitting &&
        !state.isReturnDialogOpen &&
        !state.isConfirmDialogOpen
      ) {
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
    case "showEvidenceProblems":
      return { ...state, showEvidenceProblems: true, refusal: null };
    case "resetAfterReturn":
      return initialReturnFlowState;
    case "refused":
      return {
        ...state,
        refusal: action.refusal,
        isConfirmDialogOpen: false,
        isReturnDialogOpen: true,
      };
  }
}

export interface LoanReceiptEvidence {
  destinationLocationId?: string;
  confirmReturnToOrigin?: boolean;
  conditionIn?: string;
  incomingConditionAssessmentId?: string;
}

/** Receipt evidence an item still needs before it can be returned. */
export type ReceiptEvidenceProblem = "condition" | "destination";

/** Element id of an item's receipt field; its error is `<id>-error`. */
export function receiptFieldId(
  itemId: string,
  part: "condition" | "destination" | "assessment" | "origin",
) {
  return `return-${itemId}-${part}`;
}

function receiptEvidenceProblems(
  evidence: LoanReceiptEvidence | undefined,
  loanType: "incoming" | "outgoing",
): ReceiptEvidenceProblem[] {
  const problems: ReceiptEvidenceProblem[] = [];
  if (
    !evidence?.conditionIn?.trim() &&
    !evidence?.incomingConditionAssessmentId
  ) {
    problems.push("condition");
  }
  if (
    loanType === "outgoing" &&
    evidence?.confirmReturnToOrigin !== true &&
    !evidence?.destinationLocationId
  ) {
    problems.push("destination");
  }
  return problems;
}

export function useLoanReturnFlow({
  loanId,
  organizationId,
  loanType,
  loanItems,
  returnLoan,
  isSubmitting,
  setIsSubmitting,
}: UseLoanReturnFlowOptions) {
  const t = useScopedI18n("loans.actions");
  const capabilityMessage = useCapabilityErrorMessage();
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
    dispatch({ type: "syncDialogState", isSubmitting });
  }, [state.isReturnDialogOpen, state.isConfirmDialogOpen, isSubmitting]);

  useEffect(() => {
    dispatch({ type: "pruneReturnedItems", loanItems });
  }, [loanItems, state.isReturnDialogOpen]);

  const handleReturn = async (itemIdsToReturn: string[] = []) => {
    setIsSubmitting(true);
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
      dispatch({
        type: "refused",
        refusal: {
          message:
            capabilityMessage(err) ??
            custodyConflictMessage(err, t("failedToReturn")),
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnClick = () => {
    dispatch({ type: "openReturnDialog" });
  };

  const evidenceProblemsFor = (itemId: string) =>
    state.showEvidenceProblems && state.selectedItemIds.has(itemId)
      ? receiptEvidenceProblems(evidenceByItem[itemId], loanType)
      : [];

  /** Confirms the return once every selected item has its evidence. */
  const handleProceedToConfirm = () => {
    if (state.selectedItemIds.size === 0) {
      dispatch({
        type: "refused",
        refusal: { message: t("selectAtLeastOne") },
      });
      return;
    }
    const firstMissing = loanItems
      .filter((item) => state.selectedItemIds.has(item._id))
      .flatMap((item) =>
        receiptEvidenceProblems(evidenceByItem[item._id], loanType).map(
          (problem) => receiptFieldId(item._id, problem),
        ),
      )[0];
    if (firstMissing) {
      dispatch({ type: "showEvidenceProblems" });
      document.getElementById(firstMissing)?.focus();
      return;
    }

    dispatch({
      type: "openConfirmDialog",
      pendingReturnItemIds: Array.from(state.selectedItemIds),
    });
  };

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
    evidenceProblemsFor,
    refusal: state.refusal,
    outstandingItemCount,
    isFullReturn,
    handleReturn,
    handleReturnClick,
    handleProceedToConfirm,
  };
}

export type LoanReturnFlow = ReturnType<typeof useLoanReturnFlow>;
