"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { EntryStatus } from "@v1/backend/convex/utils/objectEntryValidators";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { PartyPicker, usePartyPickerAccess } from "@/components/party-picker";
import { useEntryErrorMessage } from "@/hooks/use-entry-error-message";
import { useScopedI18n } from "@/locales/client";
import { endOfDay } from "../../_components/entry-dates";

interface EditableEntry {
  _id: Id<"objectEntries">;
  organizationId: Id<"organizations">;
  status: EntryStatus;
  ownerName?: string;
  ownerAccountId?: Id<"accounts">;
  purposeNote?: string;
  responsibleUserId: Id<"users">;
  responsibilityTerms?: string;
  decisionDueAt?: number;
  returnDueAt?: number;
  notes?: string;
}

interface EditForm {
  ownerName: string;
  ownerAccountId: Id<"accounts"> | undefined;
  responsibleUserId: string;
  responsibilityTerms: string;
  decisionDueAt: Date | undefined;
  returnDueAt: Date | undefined;
  purposeNote: string;
  notes: string;
  isSaving: boolean;
}

function dateOrUndefined(timestamp: number | undefined) {
  return timestamp === undefined ? undefined : new Date(timestamp);
}

/** The dialog is mounted when opened, so it starts from the entry's values. */
function initialForm(entry: EditableEntry): EditForm {
  return {
    ownerName: entry.ownerName ?? "",
    ownerAccountId: entry.ownerAccountId,
    responsibleUserId: entry.responsibleUserId,
    responsibilityTerms: entry.responsibilityTerms ?? "",
    decisionDueAt: dateOrUndefined(entry.decisionDueAt),
    returnDueAt: dateOrUndefined(entry.returnDueAt),
    purposeNote: entry.purposeNote ?? "",
    notes: entry.notes ?? "",
    isSaving: false,
  };
}

export function EditEntryDialog({
  entry,
  onOpenChange,
}: {
  entry: EditableEntry;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("objectEntries");
  const errorMessage = useEntryErrorMessage();
  const update = useMutation(api.objectEntries.update);
  const members = useQuery(api.objectEntries.listResponsibleMembers, {
    organizationId: entry.organizationId,
  });
  const [form, setForm] = useState(() => initialForm(entry));
  const set = <Field extends keyof EditForm>(
    field: Field,
    value: EditForm[Field],
  ) => setForm((current) => ({ ...current, [field]: value }));
  const { isSaving } = form;
  // The owner is the source of title, so it is fixed once an acquisition opens.
  const canChangeOwner = entry.status === "in_custody";
  const { canPick } = usePartyPickerAccess();
  const ownerChanged =
    form.ownerAccountId !== entry.ownerAccountId ||
    form.ownerName.trim() !== (entry.ownerName ?? "");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    set("isSaving", true);
    try {
      await update({
        entryId: entry._id,
        ...(canChangeOwner && ownerChanged
          ? {
              ownerName: form.ownerName,
              ownerAccountId:
                form.ownerAccountId === entry.ownerAccountId
                  ? undefined
                  : form.ownerAccountId,
            }
          : {}),
        responsibleUserId: form.responsibleUserId as Id<"users">,
        responsibilityTerms: form.responsibilityTerms,
        decisionDueAt: form.decisionDueAt ? endOfDay(form.decisionDueAt) : null,
        returnDueAt: form.returnDueAt ? endOfDay(form.returnDueAt) : null,
        purposeNote: form.purposeNote,
        notes: form.notes,
      });
      toast.success(t("editDialog.success"));
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
            <DialogTitle>{t("editDialog.title")}</DialogTitle>
            <DialogDescription>{t("editDialog.description")}</DialogDescription>
          </DialogHeader>
          {canChangeOwner ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {canPick ? (
                <div className="space-y-1.5">
                  <Label htmlFor="entry-edit-owner-party">
                    {t("fields.ownerParty")}
                  </Label>
                  <PartyPicker
                    id="entry-edit-owner-party"
                    organizationId={entry.organizationId}
                    value={form.ownerAccountId}
                    onChange={(party) =>
                      setForm((current) => ({
                        ...current,
                        ownerAccountId: party?._id,
                        ownerName: party
                          ? party.displayName
                          : current.ownerName,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="entry-edit-owner">{t("fields.owner")}</Label>
                <Input
                  id="entry-edit-owner"
                  value={form.ownerName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ownerName: event.target.value,
                      ownerAccountId: undefined,
                    }))
                  }
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  {t("fields.ownerHint")}
                </p>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="entry-edit-responsible">
              {t("fields.responsible")}
            </Label>
            <Select
              value={form.responsibleUserId}
              onValueChange={(value) => set("responsibleUserId", value)}
              disabled={isSaving}
            >
              <SelectTrigger id="entry-edit-responsible">
                <SelectValue placeholder={t("fields.chooseMember")} />
              </SelectTrigger>
              <SelectContent>
                {(members ?? []).map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-edit-terms">
              {t("fields.responsibilityTerms")}
            </Label>
            <Input
              id="entry-edit-terms"
              value={form.responsibilityTerms}
              onChange={(event) =>
                set("responsibilityTerms", event.target.value)
              }
              disabled={isSaving}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker
              id="entry-edit-decision-due"
              label={t("fields.decisionDueAt")}
              date={form.decisionDueAt}
              onSelect={(value) => set("decisionDueAt", value)}
              disabled={isSaving}
            />
            <DatePicker
              id="entry-edit-return-due"
              label={t("fields.returnDueAt")}
              date={form.returnDueAt}
              onSelect={(value) => set("returnDueAt", value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-edit-purpose-note">
              {t("fields.purposeNote")}
            </Label>
            <Textarea
              id="entry-edit-purpose-note"
              value={form.purposeNote}
              onChange={(event) => set("purposeNote", event.target.value)}
              rows={2}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-edit-notes">{t("fields.notes")}</Label>
            <Textarea
              id="entry-edit-notes"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={2}
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
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("actions.saving") : t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
