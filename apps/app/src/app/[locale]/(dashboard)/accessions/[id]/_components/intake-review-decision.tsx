"use client";

import { api } from "@v1/backend/convex/_generated/api";
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
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { Archive, RotateCcw, Undo2 } from "lucide-react";
import { useState } from "react";
import { ClientRelativeTime } from "@/components/client-date";
import { useAccessionReviewMessage } from "@/hooks/use-accession-review-message";
import { useScopedI18n } from "@/locales/client";
import type { AccessionDetailRecord } from "./accession-detail-view-props";

interface IntakeReviewDecisionProps {
  accession: AccessionDetailRecord;
  isDraft: boolean;
  locale: string;
}

/**
 * The latest reviewer decision: why an intake is back in Draft, or why it is
 * withdrawn, with restore for approvers.
 */
export function IntakeReviewDecision({
  accession,
  isDraft,
  locale,
}: IntakeReviewDecisionProps) {
  const t = useScopedI18n("accessionReview.decision");
  const decision = accession.reviewDecision;
  const isWithdrawn = accession.status === "withdrawn";
  if (!decision || !(isWithdrawn || isDraft)) {
    return null;
  }

  const title =
    decision.decision === "withdrawn"
      ? t("withdrawnTitle")
      : decision.decision === "restored"
        ? t("restoredTitle")
        : t("returnedTitle");
  const Icon =
    decision.decision === "withdrawn"
      ? Archive
      : decision.decision === "restored"
        ? RotateCcw
        : Undo2;

  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${
        isWithdrawn
          ? "border-border/60 bg-secondary/30"
          : "border-yellow-500/30 bg-yellow-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {decision.reason}
            </p>
            {decision.decidedByName ? (
              <p className="text-xs text-muted-foreground">
                {t("decidedBy", { name: decision.decidedByName })}
              </p>
            ) : null}
            {isWithdrawn ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("withdrawnDescription")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <span className="text-xs text-muted-foreground">
            <ClientRelativeTime
              timestamp={decision.decidedAt}
              locale={locale}
              options={{ addSuffix: true }}
            />
          </span>
          {accession.canCurrentUserRestore ? (
            <RestoreIntakeDialog accessionId={accession._id} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RestoreIntakeDialog({
  accessionId,
}: {
  accessionId: AccessionDetailRecord["_id"];
}) {
  const t = useScopedI18n("accessionReview.restore");
  const tCommon = useScopedI18n("common");
  const tReject = useScopedI18n("accessionReview.reject");
  const reviewMessage = useAccessionReviewMessage();
  const restoreIntake = useMutation(api.accessions.restoreWithdrawn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReason("");
      setError(null);
    }
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    setError(null);
    // Close before saving: on success restore rights end and this dialog
    // unmounts. A failure reopens it with the reason intact.
    setOpen(false);
    try {
      await restoreIntake({ accessionId, reason });
      setReason("");
    } catch (err) {
      setError(reviewMessage(err));
      setOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isSaving}>
          <RotateCcw className="mr-2 size-4" />
          {t("action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="restore-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="restore-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
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
            disabled={isSaving || !reason.trim()}
            onClick={() => void handleConfirm()}
          >
            {isSaving ? tReject("saving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
