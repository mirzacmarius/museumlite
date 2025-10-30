"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
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
import { PermissionGate } from "@/components/permission-gate";
import { useMutation } from "convex/react";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

interface LoanApprovalWorkflowProps {
  loanId: string;
  loanStatus: string;
}

export function LoanApprovalWorkflow({
  loanId,
  loanStatus,
}: LoanApprovalWorkflowProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveLoan = useMutation(api.loans.approve);
  const returnLoan = useMutation(api.loans.returnLoan);
  const cancelLoan = useMutation(api.loans.cancel);

  if (loanStatus === "pending") {
    const handleApprove = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await approveLoan({
          loanId: loanId as Id<"loans">,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to approve loan",
        );
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
        setError(
          err instanceof Error ? err.message : "Failed to cancel loan",
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Loan Actions</h3>
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-4">
          <PermissionGate permission="loans.approve">
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Loan
            </Button>
          </PermissionGate>
          <PermissionGate permission="loans.update">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isSubmitting}
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Loan
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Loan</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this loan? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Loan</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>
                    Cancel Loan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>
      </div>
    );
  }

  if (loanStatus === "active") {
    const handleReturn = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await returnLoan({
          loanId: loanId as Id<"loans">,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to return loan",
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Loan Actions</h3>
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <PermissionGate permission="loans.update">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Returned
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark Loan as Returned</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to mark this loan as returned? This
                  will update the status of all associated collection items.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReturn}>
                  Mark as Returned
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PermissionGate>
      </div>
    );
  }

  return null;
}
