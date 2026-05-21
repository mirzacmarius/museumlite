"use client";

import { Button } from "@v1/ui/button";
import { Info, Save } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";
import { EditLoanCoreInfoSection } from "./edit-loan-core-info-section";
import { EditLoanDetailsSection } from "./edit-loan-details-section";
import { EditLoanScheduleSection } from "./edit-loan-schedule-section";
import { useEditLoanForm } from "./use-edit-loan-form";

interface EditLoanFormProps {
  loanId: string;
  loan: Loan;
  onCancel: () => void;
}

export function EditLoanForm({ loanId, loan, onCancel }: EditLoanFormProps) {
  const tActions = useScopedI18n("loans.actions");
  const { formData, setFormData, isSubmitting, error, handleSubmit } =
    useEditLoanForm({ loanId, loan });

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <Info className="size-4" />
          {error}
        </div>
      )}

      <EditLoanCoreInfoSection
        loan={loan}
        formData={formData}
        onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
      />
      <EditLoanScheduleSection
        formData={formData}
        onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
      />
      <EditLoanDetailsSection
        formData={formData}
        onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
      />

      <div className="flex items-center justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="w-24"
        >
          Cancel
        </Button>
        <PermissionGate permission="loans.update">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[140px]"
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? tActions("saving") : tActions("saveChanges")}
          </Button>
        </PermissionGate>
      </div>
    </form>
  );
}
