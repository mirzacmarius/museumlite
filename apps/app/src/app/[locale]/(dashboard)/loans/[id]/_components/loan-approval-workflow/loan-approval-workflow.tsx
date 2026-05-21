"use client";

import { ActiveLoanStep } from "./active-loan-step";
import { DispatchedLoanStep } from "./dispatched-loan-step";
import { PendingApprovalStep } from "./pending-approval-step";
import type { LoanApprovalWorkflowProps } from "./types";
import { useLoanApprovalWorkflow } from "./use-loan-approval-workflow";

export function LoanApprovalWorkflow({
  loanId,
  loanStatus,
}: LoanApprovalWorkflowProps) {
  const workflow = useLoanApprovalWorkflow(loanId);

  if (loanStatus === "pending") {
    return <PendingApprovalStep loanId={loanId} workflow={workflow} />;
  }

  if (loanStatus === "active") {
    return <ActiveLoanStep loanId={loanId} workflow={workflow} />;
  }

  if (loanStatus === "dispatched") {
    return <DispatchedLoanStep workflow={workflow} />;
  }

  return null;
}
