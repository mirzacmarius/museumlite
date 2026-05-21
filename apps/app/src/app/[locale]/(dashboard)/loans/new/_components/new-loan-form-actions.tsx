"use client";

import { Button } from "@v1/ui/button";
import { Info, Save } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

interface NewLoanFormActionsProps {
  error: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function NewLoanFormActions({
  error,
  isSubmitting,
  onCancel,
}: NewLoanFormActionsProps) {
  const tActions = useScopedI18n("loans.actions");

  return (
    <>
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <Info className="size-4" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="w-24"
        >
          Cancel
        </Button>
        <PermissionGate permission="loans.create">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[140px]"
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? tActions("saving") : tActions("createNewLoan")}
          </Button>
        </PermissionGate>
      </div>
    </>
  );
}
