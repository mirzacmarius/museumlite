"use client";

import { Button } from "@v1/ui/button";
import { CheckCircle } from "lucide-react";
import type { LoanItem } from "../types";
import { ReturnConfirmDialog } from "./return-confirm-dialog";
import { ReturnItemSelectionDialog } from "./return-item-selection-dialog";
import { SingleItemReturnDialog } from "./single-item-return-dialog";
import type { LoanReturnFlow } from "./use-loan-return-flow";

interface LoanReturnControlsProps {
  loanItems: LoanItem[];
  returnFlow: LoanReturnFlow;
}

export function LoanReturnControls({
  loanItems,
  returnFlow,
}: LoanReturnControlsProps) {
  const {
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
  } = returnFlow;

  if (!hasMultipleItems) {
    return (
      <SingleItemReturnDialog
        disabled={isSubmitting}
        onConfirm={() => handleReturn([])}
      />
    );
  }

  return (
    <>
      <Button
        onClick={handleReturnClick}
        disabled={isSubmitting}
        className="bg-blue-600 hover:bg-blue-700"
      >
        <CheckCircle className="mr-2 size-4" />
        {t("markAsReturned")}
      </Button>
      <ReturnItemSelectionDialog
        open={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        loanItems={loanItems}
        selectedItemIds={selectedItemIds}
        setSelectedItemIds={setSelectedItemIds}
        onProceed={handleProceedToConfirm}
      />
      <ReturnConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        isFullReturn={isFullReturn}
        loanItemCount={loanItems.length}
        pendingReturnItemIds={pendingReturnItemIds}
        isSubmitting={isSubmitting}
        onConfirm={() => handleReturn(pendingReturnItemIds)}
        onGoBack={() => {
          setIsConfirmDialogOpen(false);
          setIsReturnDialogOpen(true);
        }}
      />
    </>
  );
}
