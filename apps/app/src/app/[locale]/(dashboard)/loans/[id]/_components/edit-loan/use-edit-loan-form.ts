"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { loanAgreementTemplateErrorFromError } from "@v1/backend/convex/utils/loanAgreementErrors";
import { isLoanCurrencyCode } from "@v1/backend/convex/utils/loanCurrency";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import { useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";
import { type EditLoanFormData, EMPTY_EDIT_LOAN_FORM } from "./types";

interface UseEditLoanFormOptions {
  loanId: string;
  loan: Loan | null | undefined;
}

export function useEditLoanForm({ loanId, loan }: UseEditLoanFormOptions) {
  const tActions = useScopedI18n("loans.actions");
  const tAgreementErrors = useScopedI18n("loanAgreementTemplates.errors");
  const agreementErrorMessage = useLoanAgreementTemplateErrorMessage();
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
        currency: loan.currency ?? "",
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
    const currency = formData.currency.trim();
    if (currency && !isLoanCurrencyCode(currency)) {
      setError(tAgreementErrors("invalidCurrency"));
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
        // An empty currency clears a previously recorded one.
        currency,
        notes: formData.notes || undefined,
      });
      push(`/loans/${loanId}`);
    } catch (err) {
      console.error("Error updating loan:", err);
      setError(
        loanAgreementTemplateErrorFromError(err) || !(err instanceof Error)
          ? agreementErrorMessage(err, tActions("failedToCreateLoan"))
          : err.message,
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
