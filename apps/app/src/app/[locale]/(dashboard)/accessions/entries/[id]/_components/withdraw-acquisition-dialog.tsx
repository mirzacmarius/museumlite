"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useEntryErrorMessage } from "@/hooks/use-entry-error-message";
import { useScopedI18n } from "@/locales/client";
import { withdrawAcquisitionSchema } from "../../_components/entry-form-schemas";

export function WithdrawAcquisitionDialog({
  entryId,
  onOpenChange,
}: {
  entryId: Id<"objectEntries">;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("objectEntries");
  const errorMessage = useEntryErrorMessage();
  const withdraw = useMutation(api.objectEntries.withdrawAcquisition);
  const [form, setForm] = useState({ reason: "", isSaving: false });
  const { isSaving } = form;
  const isValid = withdrawAcquisitionSchema.safeParse(form).success;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    setForm((current) => ({ ...current, isSaving: true }));
    try {
      await withdraw({ entryId, reason: form.reason });
      toast.success(t("withdrawDialog.success"));
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
      setForm((current) => ({ ...current, isSaving: false }));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("withdrawDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("withdrawDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="entry-withdraw-reason">
              {t("withdrawDialog.reason")}
            </Label>
            <Textarea
              id="entry-withdraw-reason"
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              rows={3}
              required
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!isValid || isSaving}>
              {isSaving ? t("actions.saving") : t("withdrawDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
