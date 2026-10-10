"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { PartyPicker, usePartyPickerAccess } from "@/components/party-picker";
import { useEntryErrorMessage } from "@/hooks/use-entry-error-message";
import { useScopedI18n } from "@/locales/client";
import { handoffTime } from "../../_components/entry-dates";
import { recordExitSchema } from "../../_components/entry-form-schemas";

interface ExitForm {
  recipient: string;
  recipientAccountId: Id<"accounts"> | undefined;
  exitedAt: Date | undefined;
  reference: string;
  notes: string;
  isSaving: boolean;
}

export function RecordExitDialog({
  entryId,
  organizationId,
  depositor,
  observedLocation,
  onOpenChange,
}: {
  entryId: Id<"objectEntries">;
  organizationId: Id<"organizations">;
  /** Suggested recipient; staff confirm or change it. */
  depositor: { name: string; accountId?: Id<"accounts"> };
  /** Where the page shows the object; the exit is refused if it moved. */
  observedLocation: { id: Id<"locations"> | null; name: string | null };
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("objectEntries");
  const errorMessage = useEntryErrorMessage();
  const { canPick } = usePartyPickerAccess();
  const recordExit = useMutation(api.objectEntries.recordExit);
  const [form, setForm] = useState<ExitForm>(() => ({
    recipient: depositor.name,
    recipientAccountId: depositor.accountId,
    exitedAt: new Date(),
    reference: "",
    notes: "",
    isSaving: false,
  }));
  const set = <Field extends keyof ExitForm>(
    field: Field,
    value: ExitForm[Field],
  ) => setForm((current) => ({ ...current, [field]: value }));
  const { isSaving, exitedAt } = form;
  const isValid = recordExitSchema.safeParse({
    recipient: { name: form.recipient, accountId: form.recipientAccountId },
    exitedAt,
  }).success;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!exitedAt || !isValid) return;
    set("isSaving", true);
    try {
      await recordExit({
        entryId,
        recipientName: form.recipient.trim() || undefined,
        recipientAccountId: form.recipientAccountId,
        exitedAt: handoffTime(exitedAt, Date.now()),
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        observedFromLocationId: observedLocation.id,
      });
      toast.success(t("exitDialog.success"));
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
      set("isSaving", false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("exitDialog.title")}</DialogTitle>
            <DialogDescription>{t("exitDialog.description")}</DialogDescription>
          </DialogHeader>
          {canPick ? (
            <div className="space-y-1.5">
              <Label htmlFor="entry-exit-party">
                {t("exitDialog.recipientParty")}
              </Label>
              <PartyPicker
                id="entry-exit-party"
                organizationId={organizationId}
                value={form.recipientAccountId}
                onChange={(party) =>
                  setForm((current) => ({
                    ...current,
                    recipientAccountId: party?._id,
                    recipient: party ? party.displayName : current.recipient,
                  }))
                }
                disabled={isSaving}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="entry-exit-recipient">
              {t("exitDialog.recipient")}
            </Label>
            <Input
              id="entry-exit-recipient"
              value={form.recipient}
              onChange={(event) => set("recipient", event.target.value)}
              disabled={isSaving}
            />
          </div>
          <DatePicker
            id="entry-exit-date"
            label={t("exitDialog.exitedAt")}
            date={exitedAt}
            onSelect={(value) => set("exitedAt", value)}
            disabled={isSaving}
          />
          <div className="space-y-1.5">
            <Label htmlFor="entry-exit-reference">
              {t("exitDialog.reference")}
            </Label>
            <Input
              id="entry-exit-reference"
              value={form.reference}
              onChange={(event) => set("reference", event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-exit-notes">{t("exitDialog.notes")}</Label>
            <Textarea
              id="entry-exit-notes"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={2}
              disabled={isSaving}
            />
          </div>
          {observedLocation.name ? (
            <p className="text-xs text-muted-foreground">
              {t("exitDialog.observedAt", { location: observedLocation.name })}
            </p>
          ) : null}
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
              {isSaving ? t("actions.saving") : t("exitDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
