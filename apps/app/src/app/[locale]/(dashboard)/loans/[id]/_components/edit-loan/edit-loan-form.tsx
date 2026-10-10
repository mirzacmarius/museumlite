"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { ArrowLeft, Lock, Save } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { RecordFormNotices } from "@/components/record-form/record-form-notices";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";
import { EditLoanCoreInfoSection } from "./edit-loan-core-info-section";
import { EditLoanDetailsSection } from "./edit-loan-details-section";
import { EditLoanLockedView } from "./edit-loan-locked-view";
import { EditLoanScheduleSection } from "./edit-loan-schedule-section";
import { useEditLoanForm } from "./use-edit-loan-form";

interface EditLoanFormProps {
  loanId: Id<"loans">;
  loan: Loan;
}

function focusField(field: string) {
  document.getElementById(field)?.focus();
}

export function EditLoanForm({ loanId, loan }: EditLoanFormProps) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");
  const tStatus = useScopedI18n("recordForm.status");
  const {
    session,
    formData,
    onChange,
    fieldLabel,
    isLocked,
    isPartyLinked,
    handleSubmit,
    navigation,
  } = useEditLoanForm({ loanId, loan });

  // Input typed before the loan left pending stays visible so it can be
  // copied; otherwise a locked loan just says it can no longer be edited.
  if (isLocked && !session.isDirty) {
    return <EditLoanLockedView loanId={loanId} status={loan.status} />;
  }
  const detailHref = `/loans/${loanId}`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={tRoot("loans.actions.cancel")}
            onClick={() => navigation.handleNavigate(detailHref)}
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Button>
          <span className="text-muted-foreground">{tRoot("loans.title")}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-muted-foreground">{loan.loanNumber}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">
            {tRoot("accessions.detail.edit")}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 pb-20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {tRoot("loans.actions.editLoanRecord")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tRoot("loans.actions.updateDetailsFor")}{" "}
              <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                {loan.loanNumber}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8" noValidate>
            {isLocked ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"
              >
                <Lock className="mt-0.5 size-4 shrink-0" />
                <p>
                  {tRoot("loans.actions.loanLockedDesc", {
                    status: loan.status,
                  })}
                </p>
              </div>
            ) : null}
            <RecordFormNotices
              session={session}
              fieldLabel={fieldLabel}
              onGoToField={focusField}
              keepsDeviceCopy
            />

            <EditLoanCoreInfoSection
              loan={loan}
              formData={formData}
              onChange={onChange}
              isPartyLinked={isPartyLinked}
              partiesHref={detailHref}
              fieldErrors={session.fieldErrors}
            />
            <EditLoanScheduleSection
              formData={formData}
              onChange={onChange}
              fieldErrors={session.fieldErrors}
            />
            <EditLoanDetailsSection formData={formData} onChange={onChange} />

            <div className="flex flex-wrap items-center justify-end gap-4 pt-4">
              {session.isDirty ? (
                <span className="mr-auto text-sm text-muted-foreground">
                  {tStatus("unsaved")}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigation.handleNavigate(detailHref)}
                className="w-24"
              >
                {tRoot("loans.actions.cancel")}
              </Button>
              <PermissionGate permission="loans.update">
                <Button
                  type="submit"
                  disabled={
                    session.saving ||
                    !session.isDirty ||
                    !session.ready ||
                    isLocked
                  }
                  className="min-w-[140px]"
                >
                  <Save className="mr-2 size-4" />
                  {session.saving
                    ? tActions("saving")
                    : tActions("saveChanges")}
                </Button>
              </PermissionGate>
            </div>
          </form>
        </div>
      </div>

      <UnsavedChangesDialog
        open={navigation.showUnsavedDialog}
        onOpenChange={navigation.setShowUnsavedDialog}
        onDiscard={navigation.handleDiscardAndNavigate}
        onSave={isLocked ? undefined : navigation.handleSaveAndNavigate}
        isSaving={session.saving}
      />
    </div>
  );
}
