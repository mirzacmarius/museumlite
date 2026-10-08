"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Truck } from "lucide-react";
import { useState } from "react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { PermissionGate, usePermissions } from "@/components/permission-gate";
import { LoanReturnControls } from "./loan-return-controls";
import type { LoanApprovalWorkflowState } from "./use-loan-approval-workflow";
import { WorkflowErrorBanner } from "./workflow-error-banner";

interface ActiveLoanStepProps {
  loanId: string;
  workflow: LoanApprovalWorkflowState;
}

export function ActiveLoanStep({ loanId, workflow }: ActiveLoanStepProps) {
  const {
    t,
    loanItems,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    dispatchLoan,
    returnFlow,
  } = workflow;

  const [outgoingAssessments, setOutgoingAssessments] = useState<
    Record<string, string>
  >({});
  const { hasPermission } = usePermissions();

  const handleDispatch = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await dispatchLoan({
        loanId: loanId as Id<"loans">,
        itemAssessments: loanItems.flatMap((item) =>
          outgoingAssessments[item._id]
            ? [
                {
                  loanItemId: item._id,
                  outgoingConditionAssessmentId: outgoingAssessments[
                    item._id
                  ] as Id<"conditionAssessments">,
                },
              ]
            : [],
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToDispatch"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t("loanActions")}</h3>
      {error && <WorkflowErrorBanner error={error} />}
      {hasPermission("loans.update") && hasPermission("collections.read") ? (
        <div className="space-y-3">
          {loanItems.map((item) => (
            <div key={item._id} className="space-y-1">
              <p className="text-sm">
                {item.accessionNumber} · {item.title}
              </p>
              <AcceptedConditionAssessmentSelector
                collectionId={item.collectionId}
                value={outgoingAssessments[item._id] ?? ""}
                onValueChange={(value) =>
                  setOutgoingAssessments((previous) => ({
                    ...previous,
                    [item._id]: value,
                  }))
                }
                disabled={isSubmitting}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-4">
        <PermissionGate permission="loans.update">
          <Button
            onClick={handleDispatch}
            disabled={isSubmitting}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Truck className="mr-2 size-4" />
            {t("dispatchLoan")}
          </Button>
        </PermissionGate>
        <PermissionGate permission="loans.update">
          <LoanReturnControls loanItems={loanItems} returnFlow={returnFlow} />
        </PermissionGate>
      </div>
    </div>
  );
}
