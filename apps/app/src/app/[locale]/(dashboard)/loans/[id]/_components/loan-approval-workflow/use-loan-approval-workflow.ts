"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { useLoanReturnFlow } from "./use-loan-return-flow";

export function useLoanApprovalWorkflow(loanId: string) {
  const t = useScopedI18n("loans.actions");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveLoan = useMutation(api.loans.approve);
  const dispatchLoan = useMutation(api.loans.dispatch);
  const returnLoan = useMutation(api.loans.returnLoan);
  const cancelLoan = useMutation(api.loans.cancel);

  const loan = useQuery(api.loans.get, {
    loanId: loanId as Id<"loans">,
  });

  const loanItems: LoanItem[] = loan?.items ?? [];

  const returnFlow = useLoanReturnFlow({
    loanId,
    organizationId: loan?.organizationId,
    loanType: loan?.type ?? "outgoing",
    loanItems,
    returnLoan,
    isSubmitting,
    setIsSubmitting,
    setError,
  });

  return {
    t,
    loanItems,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    approveLoan,
    dispatchLoan,
    cancelLoan,
    returnFlow,
  };
}

export type LoanApprovalWorkflowState = ReturnType<
  typeof useLoanApprovalWorkflow
>;
