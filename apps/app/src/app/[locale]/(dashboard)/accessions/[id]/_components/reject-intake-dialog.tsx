"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { MAX_REVIEW_REASON_LENGTH } from "@v1/backend/convex/utils/accessionReview";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { XCircle } from "lucide-react";
import { useState } from "react";
import { useAccessionReviewMessage } from "@/hooks/use-accession-review-message";
import { useScopedI18n } from "@/locales/client";

type RejectDecision = "returnToDraft" | "withdraw";

interface RejectForm {
  open: boolean;
  decision: RejectDecision;
  reason: string;
  error: string | null;
}

const initialRejectForm: RejectForm = {
  open: false,
  decision: "returnToDraft",
  reason: "",
  error: null,
};

interface RejectIntakeDialogProps {
  accessionId: Id<"accessions">;
  disabled?: boolean;
  /** Reviewer comment already typed next to the button; prefills the reason. */
  initialReason?: string;
  onDecided?: () => void;
}

/** Reviewer rejection: send the intake back to Draft, or withdraw it. */
export function RejectIntakeDialog({
  accessionId,
  disabled = false,
  initialReason,
  onDecided,
}: RejectIntakeDialogProps) {
  const t = useScopedI18n("accessionReview.reject");
  const tAccessions = useScopedI18n("accessions");
  const tCommon = useScopedI18n("common");
  const reviewMessage = useAccessionReviewMessage();
  const rejectIntake = useMutation(api.accessions.reject);
  const [form, setForm] = useState<RejectForm>(initialRejectForm);
  const [isSaving, setIsSaving] = useState(false);
  const { open, decision, reason, error } = form;

  const handleOpenChange = (nextOpen: boolean) => {
    setForm((current) =>
      nextOpen
        ? {
            ...current,
            open: true,
            reason: current.reason || initialReason?.trim() || "",
          }
        : initialRejectForm,
    );
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    // Close before saving: on success the intake leaves review and this
    // panel unmounts. A failure reopens the dialog with the reason intact.
    setForm((current) => ({ ...current, open: false, error: null }));
    try {
      await rejectIntake({ accessionId, decision, reason });
      setForm(initialRejectForm);
      onDecided?.();
    } catch (err) {
      setForm((current) => ({
        ...current,
        open: true,
        error: reviewMessage(err),
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const options = [
    {
      value: "returnToDraft",
      label: t("returnToDraft"),
      description: t("returnToDraftDescription"),
    },
    {
      value: "withdraw",
      label: t("withdraw"),
      description: t("withdrawDescription"),
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled || isSaving}
          variant="destructive"
          className="transition-transform duration-200 active:translate-y-px"
        >
          <XCircle className="mr-2 size-4" />
          {tAccessions("approval.reject")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={decision}
          onValueChange={(value) => {
            if (value === "returnToDraft" || value === "withdraw") {
              setForm((current) => ({ ...current, decision: value }));
            }
          }}
          className="gap-3"
        >
          {options.map((option) => (
            <Label
              key={option.value}
              htmlFor={`reject-decision-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem
                id={`reject-decision-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  {option.label}
                </span>
                <span className="block text-xs font-normal leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) =>
              setForm((current) => ({ ...current, reason: event.target.value }))
            }
            placeholder={t("reasonPlaceholder")}
            rows={3}
            maxLength={MAX_REVIEW_REASON_LENGTH}
            required
          />
          <p className="text-xs text-muted-foreground">{t("reasonHint")}</p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant={decision === "withdraw" ? "destructive" : "default"}
            disabled={isSaving || !reason.trim()}
            onClick={() => void handleConfirm()}
          >
            {isSaving
              ? t("saving")
              : decision === "withdraw"
                ? t("confirmWithdraw")
                : t("confirmReturnToDraft")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
