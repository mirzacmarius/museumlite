"use client";

import { PermissionGate } from "@/components/permission-gate";
import { LoanReturnControls } from "./loan-return-controls";
import type { LoanApprovalWorkflowState } from "./use-loan-approval-workflow";
import { WorkflowErrorBanner } from "./workflow-error-banner";

interface DispatchedLoanStepProps {
  workflow: LoanApprovalWorkflowState;
}

export function DispatchedLoanStep({ workflow }: DispatchedLoanStepProps) {
  const { t, loanItems, error, returnFlow } = workflow;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t("loanActions")}</h3>
      {error && <WorkflowErrorBanner error={error} />}
      <PermissionGate permission="loans.update">
        <LoanReturnControls loanItems={loanItems} returnFlow={returnFlow} />
      </PermissionGate>
    </div>
  );
}
