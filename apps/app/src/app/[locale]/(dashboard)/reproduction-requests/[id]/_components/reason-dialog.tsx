"use client";

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
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { useScopedI18n } from "@/locales/client";

/** Asks for the reason a command records, then runs it. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useScopedI18n("reproductionRequests");
  const id = useId();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error(t("errors.reasonRequired"));
      return;
    }
    setSaving(true);
    const done = await onConfirm(reason);
    setSaving(false);
    if (done) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={id}>{t("detail.reason")}</Label>
            <Textarea
              id={id}
              rows={3}
              maxLength={4000}
              value={reason}
              placeholder={t("detail.reasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
