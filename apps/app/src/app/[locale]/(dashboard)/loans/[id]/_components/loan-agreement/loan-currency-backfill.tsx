"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { isLoanCurrencyCode } from "@v1/backend/convex/utils/loanCurrency";
import { Button } from "@v1/ui/button";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { LoanCurrencyInput } from "@/components/loan-currency-input";
import { PermissionGate } from "@/components/permission-gate";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import { useScopedI18n } from "@/locales/client";

interface BackfillState {
  currency: string;
  error: string | null;
  isSaving: boolean;
}

/**
 * Loans created before currencies were recorded show their insurance value as
 * a plain number. Staff who can update loans record the currency here once.
 */
export function LoanCurrencyBackfill({ loanId }: { loanId: Id<"loans"> }) {
  const t = useScopedI18n("loanAgreementTemplates");
  const errorMessage = useLoanAgreementTemplateErrorMessage();
  const recordCurrency = useMutation(api.loans.recordCurrency);
  const [state, setState] = useState<BackfillState>({
    currency: "",
    error: null,
    isSaving: false,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isLoanCurrencyCode(state.currency)) {
      setState((current) => ({
        ...current,
        error: t("errors.invalidCurrency"),
      }));
      return;
    }
    setState((current) => ({ ...current, error: null, isSaving: true }));
    try {
      await recordCurrency({ loanId, currency: state.currency });
      toast.success(t("currency.recorded"));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: errorMessage(error),
        isSaving: false,
      }));
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <p>{t("currency.missing")}</p>
      <PermissionGate permission="loans.update">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="w-40">
            <LoanCurrencyInput
              id="loan-agreement-currency"
              value={state.currency}
              onChange={(currency) =>
                setState((current) => ({ ...current, currency }))
              }
            />
          </div>
          <Button type="submit" size="sm" disabled={state.isSaving}>
            {t("currency.record")}
          </Button>
        </form>
        {state.error && (
          <p role="alert" className="text-destructive">
            {state.error}
          </p>
        )}
      </PermissionGate>
    </div>
  );
}
