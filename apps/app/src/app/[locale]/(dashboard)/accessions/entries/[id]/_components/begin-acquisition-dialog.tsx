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
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useEntryErrorMessage } from "@/hooks/use-entry-error-message";
import { useScopedI18n } from "@/locales/client";

const METHODS = [
  "gift",
  "donation",
  "bequest",
  "purchase",
  "transfer",
  "other",
] as const;
type AcquisitionMethod = (typeof METHODS)[number];

interface AcquisitionForm {
  method: AcquisitionMethod;
  accessionNumber: string;
  cost: string;
  notes: string;
  isSaving: boolean;
}

export function BeginAcquisitionDialog({
  entryId,
  ownerName,
  onOpenChange,
}: {
  entryId: Id<"objectEntries">;
  ownerName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("objectEntries");
  const { push } = useRouter();
  const errorMessage = useEntryErrorMessage();
  const beginAcquisition = useMutation(api.objectEntries.beginAcquisition);
  const [form, setForm] = useState<AcquisitionForm>({
    method: "gift",
    accessionNumber: "",
    cost: "",
    notes: "",
    isSaving: false,
  });
  const set = <Field extends keyof AcquisitionForm>(
    field: Field,
    value: AcquisitionForm[Field],
  ) => setForm((current) => ({ ...current, [field]: value }));
  const { isSaving } = form;
  const parsedCost = form.cost.trim() ? Number(form.cost) : undefined;
  const isValid =
    parsedCost === undefined ||
    (Number.isFinite(parsedCost) && parsedCost >= 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    set("isSaving", true);
    try {
      const accessionId = await beginAcquisition({
        entryId,
        method: form.method,
        accessionNumber: form.accessionNumber.trim() || undefined,
        cost: parsedCost,
        notes: form.notes.trim() || undefined,
      });
      toast.success(t("acquisition.success"));
      push(`/accessions/${accessionId}`);
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
            <DialogTitle>{t("acquisition.title")}</DialogTitle>
            <DialogDescription>
              {t("acquisition.description", { owner: ownerName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="acquisition-method">
              {t("acquisition.method")}
            </Label>
            <Select
              value={form.method}
              onValueChange={(value) =>
                set("method", value as AcquisitionMethod)
              }
              disabled={isSaving}
            >
              <SelectTrigger id="acquisition-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`acquisition.methods.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acquisition-number">
              {t("acquisition.accessionNumber")}
            </Label>
            <Input
              id="acquisition-number"
              value={form.accessionNumber}
              onChange={(event) => set("accessionNumber", event.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              {t("acquisition.accessionNumberHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acquisition-cost">{t("acquisition.cost")}</Label>
            <Input
              id="acquisition-cost"
              type="number"
              min={0}
              step="0.01"
              value={form.cost}
              onChange={(event) => set("cost", event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acquisition-notes">{t("acquisition.notes")}</Label>
            <Textarea
              id="acquisition-notes"
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
            <Button type="submit" disabled={!isValid || isSaving}>
              {isSaving ? t("actions.saving") : t("acquisition.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
