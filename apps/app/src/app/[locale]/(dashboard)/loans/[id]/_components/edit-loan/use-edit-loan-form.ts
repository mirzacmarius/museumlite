"use client";

import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Loan } from "../types";
import { EMPTY_EDIT_LOAN_FORM, type EditLoanFormData } from "./types";

interface UseEditLoanFormOptions {
  loanId: string;
  loan: Loan | null | undefined;
}

export function useEditLoanForm({ loanId, loan }: UseEditLoanFormOptions) {
  const tActions = useScopedI18n("loans.actions");
  const { push } = useRouter();
  const updateLoan = useMutation(api.loans.update);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] =
    useState<EditLoanFormData>(EMPTY_EDIT_LOAN_FORM);

  useEffect(() => {
    if (loan) {
      setFormData({
        lenderBorrowerName: loan.lenderBorrowerName || "",
        lenderBorrowerContact: loan.lenderBorrowerContact || "",
        startDate: new Date(loan.startDate),
        endDate: loan.endDate ? new Date(loan.endDate) : undefined,
        terms: loan.terms || "",
        insuranceValue: loan.insuranceValue?.toString() || "",
        notes: loan.notes || "",
      });
    }
  }, [loan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.lenderBorrowerName.trim()) {
      setError(tActions("lenderBorrowerRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateLoan({
        loanId: loanId as Id<"loans">,
        lenderBorrowerName: formData.lenderBorrowerName,
        lenderBorrowerContact: formData.lenderBorrowerContact || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        terms: formData.terms || undefined,
        insuranceValue: formData.insuranceValue
          ? Number.parseFloat(formData.insuranceValue)
          : undefined,
        notes: formData.notes || undefined,
      });
      push(`/loans/${loanId}`);
    } catch (err) {
      console.error("Error updating loan:", err);
      setError(
        err instanceof Error ? err.message : tActions("failedToCreateLoan"),
      );
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    isSubmitting,
    error,
    handleSubmit,
  };
}
