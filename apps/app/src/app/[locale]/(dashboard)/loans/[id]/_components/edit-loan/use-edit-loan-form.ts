"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { loanAgreementTemplateErrorFromError } from "@v1/backend/convex/utils/loanAgreementErrors";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useMemo } from "react";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useFormNavigationGuard } from "@/hooks/use-form-navigation-guard";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import { useRecordFormSession } from "@/hooks/use-record-form-session";
import { useRecordSaveFailure } from "@/hooks/use-record-save-failure";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";
import {
  comparableEditLoanForm,
  type EditLoanField,
  type EditLoanFormData,
  EMPTY_EDIT_LOAN_FORM,
  editLoanFormValues,
  editLoanPatch,
  parseEditLoanForm,
  validateEditLoanForm,
} from "./types";

interface UseEditLoanFormOptions {
  loanId: Id<"loans">;
  loan: Loan;
}

export function useEditLoanForm({ loanId, loan }: UseEditLoanFormOptions) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");
  const tErrors = useScopedI18n("recordForm.errors");
  const tAgreementErrors = useScopedI18n("loanAgreementTemplates.errors");
  const tCurrency = useScopedI18n("loanAgreementTemplates.currency");
  const agreementErrorMessage = useLoanAgreementTemplateErrorMessage();
  const { push } = useRouter();
  const updateLoan = useMutation(api.loans.update);
  const editState = useQuery(api.recordEdits.getEditState, {
    target: { type: "loan", id: loanId },
  });

  const fieldLabel = useCallback(
    (field: string) => {
      switch (field as EditLoanField) {
        case "lenderBorrowerName":
          return `${loan.type === "incoming" ? tActions("lender") : tActions("borrower")} ${tRoot("collections.form.nameLabel")}`;
        case "lenderBorrowerContact":
          return tActions("contactInformation");
        case "startDate":
          return tActions("startDate");
        case "endDate":
          return tActions("endDate");
        case "insuranceValue":
          return tActions("insuranceValue");
        case "currency":
          return tCurrency("label");
        case "terms":
          return tActions("termsConditions");
        case "notes":
          return tActions("internalNotes");
        default:
          return field;
      }
    },
    [loan.type, tActions, tCurrency, tRoot],
  );
  const describeFailure = useRecordSaveFailure({
    fieldLabel,
    describe: useCallback(
      (error: unknown) => {
        const agreementError = loanAgreementTemplateErrorFromError(error);
        if (!agreementError) return null;
        return {
          message: agreementErrorMessage(error),
          field: agreementError.code.includes("CURRENCY")
            ? "currency"
            : undefined,
        };
      },
      [agreementErrorMessage],
    ),
  });
  const validate = useCallback(
    (values: EditLoanFormData) =>
      validateEditLoanForm(values, {
        required: (field) => tErrors("required", { field: fieldLabel(field) }),
        dateOrder: tErrors("dateOrderInvalid"),
        amount: tErrors("amountInvalid"),
        currency: tAgreementErrors("invalidCurrency"),
      }),
    [fieldLabel, tAgreementErrors, tErrors],
  );

  const latest = useMemo(
    () =>
      editState
        ? {
            values: editLoanFormValues(loan),
            editVersion: editState.editVersion,
          }
        : undefined,
    [editState, loan],
  );
  const session = useRecordFormSession({
    latest,
    initialValues: EMPTY_EDIT_LOAN_FORM,
    comparable: comparableEditLoanForm,
    recovery: { kind: "loan", recordId: loanId, parse: parseEditLoanForm },
    validate,
    describeFailure,
    invalidMessage: tErrors("invalid"),
  });
  useBeforeUnload(session.isDirty);

  const isLocked = loan.status !== "pending";
  const isPartyLinked = loan.accountId !== undefined;
  const { save } = session;
  const saveLoan = useCallback(
    () =>
      save(async ({ values, changedFields, expectedEditVersion }) =>
        updateLoan({
          ...editLoanPatch(loanId, values, changedFields),
          expectedEditVersion,
        }),
      ),
    [loanId, save, updateLoan],
  );
  const navigation = useFormNavigationGuard({
    hasUnsavedChanges: session.isDirty,
    onNavigate: push,
    onSaveBeforeNavigate: saveLoan,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await saveLoan()) push(`/loans/${loanId}`);
  };
  const { update } = session;
  const onChange = useCallback(
    (changes: Partial<EditLoanFormData>) =>
      update((values) => ({ ...values, ...changes })),
    [update],
  );

  return {
    session,
    formData: session.values,
    onChange,
    fieldLabel,
    isLocked,
    isPartyLinked,
    handleSubmit,
    navigation,
  };
}
