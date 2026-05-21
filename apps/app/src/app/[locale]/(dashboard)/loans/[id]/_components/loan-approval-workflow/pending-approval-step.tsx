"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import type { LoanApprovalWorkflowState } from "./use-loan-approval-workflow";
import { WorkflowErrorBanner } from "./workflow-error-banner";

interface PendingApprovalStepProps {
  loanId: string;
  workflow: LoanApprovalWorkflowState;
}

export function PendingApprovalStep({
  loanId,
  workflow,
}: PendingApprovalStepProps) {
  const {
    t,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    approveLoan,
    cancelLoan,
  } = workflow;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await approveLoan({
        loanId: loanId as Id<"loans">,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToApprove"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await cancelLoan({
        loanId: loanId as Id<"loans">,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToCancel"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{t("loanActions")}</h3>
      {error && <WorkflowErrorBanner error={error} />}
      <div className="flex gap-4">
        <PermissionGate permission="loans.approve">
          <Button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="mr-2 size-4" />
            {t("approveLoan")}
          </Button>
        </PermissionGate>
        <PermissionGate permission="loans.update">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isSubmitting} variant="destructive">
                <XCircle className="mr-2 size-4" />
                {t("cancelLoan")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("cancelLoan")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("cancelLoanConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("keepLoan")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel}>
                  {t("cancelLoan")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PermissionGate>
      </div>
    </div>
  );
}
