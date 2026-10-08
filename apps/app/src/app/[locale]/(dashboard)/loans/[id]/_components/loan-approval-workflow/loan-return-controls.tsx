"use client";

import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { CheckCircle } from "lucide-react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { ReturnConfirmDialog } from "./return-confirm-dialog";
import { ReturnItemSelectionDialog } from "./return-item-selection-dialog";
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

  const evidenceT = useScopedI18n("conditionAssessments");
  const { hasPermission } = usePermissions();

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
        canProceed={returnFlow.canProceed}
        validationMessage={evidenceT("receiptRequirement")}
        renderEvidence={(item) => {
          const evidence = returnFlow.evidenceByItem[item._id] ?? {};
          const setEvidence = (patch: Partial<typeof evidence>) =>
            returnFlow.setEvidence(item._id, { ...evidence, ...patch });
          return (
            <div className="w-full space-y-3 border-t border-border pt-3">
              {returnFlow.loanType === "outgoing" &&
              returnFlow.organizationId ? (
                <>
                  {item.dispatchOriginLocationId &&
                  !item.dispatchOriginUnknown ? (
                    <label
                      htmlFor={`confirm-origin-${item._id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`confirm-origin-${item._id}`}
                        checked={evidence.confirmReturnToOrigin ?? false}
                        onCheckedChange={(checked) =>
                          setEvidence({
                            confirmReturnToOrigin: checked === true,
                            destinationLocationId: undefined,
                          })
                        }
                      />
                      {evidenceT("confirmOrigin")}
                    </label>
                  ) : null}
                  {!evidence.confirmReturnToOrigin ? (
                    <div className="space-y-1">
                      <p className="text-sm">
                        {evidenceT("returnDestination")}
                      </p>
                      <LocationSelector
                        organizationId={returnFlow.organizationId}
                        value={evidence.destinationLocationId ?? ""}
                        onValueChange={(value) =>
                          setEvidence({ destinationLocationId: value })
                        }
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
              <Input
                aria-label={evidenceT("conditionEvidence")}
                placeholder={evidenceT("conditionEvidence")}
                value={evidence.conditionIn ?? ""}
                onChange={(event) =>
                  setEvidence({ conditionIn: event.target.value })
                }
              />
              {hasPermission("collections.read") ? (
                <AcceptedConditionAssessmentSelector
                  collectionId={item.collectionId}
                  value={evidence.incomingConditionAssessmentId ?? ""}
                  onValueChange={(value) =>
                    setEvidence({ incomingConditionAssessmentId: value })
                  }
                />
              ) : null}
            </div>
          );
        }}
      />
      <ReturnConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        isFullReturn={isFullReturn}
        loanItemCount={returnFlow.outstandingItemCount}
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
