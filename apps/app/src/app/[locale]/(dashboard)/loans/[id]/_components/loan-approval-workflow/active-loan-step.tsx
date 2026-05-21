"use client";

import { PermissionGate } from "@/components/permission-gate";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Truck } from "lucide-react";
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

  const handleDispatch = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await dispatchLoan({
        loanId: loanId as Id<"loans">,
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
      <div className="flex gap-4">
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
