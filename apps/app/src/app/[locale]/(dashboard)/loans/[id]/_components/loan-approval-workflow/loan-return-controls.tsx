"use client";

import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { CheckCircle } from "lucide-react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { ReturnConfirmDialog } from "./return-confirm-dialog";
import { ReturnItemSelectionDialog } from "./return-item-selection-dialog";
import { type LoanReturnFlow, receiptFieldId } from "./use-loan-return-flow";

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
        refusal={returnFlow.refusal}
        renderEvidence={(item) => (
          <ReceiptEvidenceFields item={item} returnFlow={returnFlow} />
        )}
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

/** Condition evidence first, then where an outgoing loan's object goes. */
function ReceiptEvidenceFields({
  item,
  returnFlow,
}: {
  item: LoanItem;
  returnFlow: LoanReturnFlow;
}) {
  const evidenceT = useScopedI18n("conditionAssessments");
  const { hasPermission } = usePermissions();
  const evidence = returnFlow.evidenceByItem[item._id] ?? {};
  const setEvidence = (patch: Partial<typeof evidence>) =>
    returnFlow.setEvidence(item._id, { ...evidence, ...patch });
  const problems = returnFlow.evidenceProblemsFor(item._id);
  const conditionField = receiptFieldId(item._id, "condition");
  const destinationField = receiptFieldId(item._id, "destination");
  const conditionError = problems.includes("condition")
    ? evidenceT("receiptErrors.condition")
    : undefined;
  const destinationError = problems.includes("destination")
    ? evidenceT("receiptErrors.destination")
    : undefined;
  // Outgoing loans come back into the museum; incoming ones leave to the lender.
  const organizationId =
    returnFlow.loanType === "outgoing" ? returnFlow.organizationId : undefined;
  const originKnown =
    item.dispatchOriginLocationId !== undefined && !item.dispatchOriginUnknown;

  return (
    <div className="w-full space-y-4 border-t border-border pt-3">
      <div className="space-y-2">
        <Label htmlFor={conditionField}>{evidenceT("receiptNotes")}</Label>
        <Input
          id={conditionField}
          value={evidence.conditionIn ?? ""}
          onChange={(event) => setEvidence({ conditionIn: event.target.value })}
          {...fieldErrorProps(conditionField, conditionError)}
        />
        <FieldError field={conditionField} message={conditionError} />
      </div>
      {hasPermission("collections.read") ? (
        <div className="space-y-2">
          <Label htmlFor={receiptFieldId(item._id, "assessment")}>
            {evidenceT("assessmentLabel")}
          </Label>
          <AcceptedConditionAssessmentSelector
            id={receiptFieldId(item._id, "assessment")}
            collectionId={item.collectionId}
            value={evidence.incomingConditionAssessmentId ?? ""}
            onValueChange={(value) =>
              setEvidence({ incomingConditionAssessmentId: value })
            }
          />
        </div>
      ) : null}
      {organizationId ? (
        <div className="space-y-3">
          {originKnown ? (
            <div className="flex items-center gap-3">
              <Checkbox
                id={receiptFieldId(item._id, "origin")}
                checked={evidence.confirmReturnToOrigin ?? false}
                onCheckedChange={(checked) =>
                  setEvidence({
                    confirmReturnToOrigin: checked === true,
                    destinationLocationId: undefined,
                  })
                }
              />
              <Label
                htmlFor={receiptFieldId(item._id, "origin")}
                className="min-h-6 text-sm leading-snug"
              >
                {evidenceT("confirmOrigin")}
              </Label>
            </div>
          ) : null}
          {evidence.confirmReturnToOrigin ? null : (
            <div className="space-y-2">
              <Label htmlFor={destinationField}>
                {evidenceT("returnDestination")}
              </Label>
              <LocationSelector
                id={destinationField}
                organizationId={organizationId}
                value={evidence.destinationLocationId ?? ""}
                onValueChange={(value) =>
                  setEvidence({ destinationLocationId: value })
                }
                allowNone={false}
                {...fieldErrorProps(destinationField, destinationError)}
              />
              <FieldError field={destinationField} message={destinationError} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
