"use client";

import { api } from "@v1/backend/convex/_generated/api";
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
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useClientDateFns } from "@/hooks/use-client-date-format";
import { useQualityErrorMessage } from "@/hooks/use-quality-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { FindingView } from "../../_components/quality-repair";

const MAX_NOTE_LENGTH = 2000;

function AcceptDialog({
  view,
  onOpenChange,
}: {
  view: FindingView;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("documentationQuality.review");
  const errorMessage = useQualityErrorMessage();
  const acceptFinding = useMutation(api.documentationQuality.acceptFinding);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const noteMissing = submitted && !note.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!note.trim()) return;
    setIsSaving(true);
    try {
      await acceptFinding({ findingId: view.finding._id, note });
      toast.success(t("accepted"));
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("acceptTitle")}</DialogTitle>
            <DialogDescription>
              {view.finding.kind === "duplicate_identifier"
                ? t("acceptDuplicateDescription")
                : t("acceptDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="finding-review-note">{t("note")}</Label>
            <Textarea
              id="finding-review-note"
              value={note}
              maxLength={MAX_NOTE_LENGTH}
              rows={4}
              aria-invalid={noteMissing}
              aria-describedby={
                noteMissing ? "finding-review-note-error" : undefined
              }
              onChange={(event) => setNote(event.target.value)}
              disabled={isSaving}
            />
            {noteMissing ? (
              <p
                id="finding-review-note-error"
                className="text-xs text-destructive"
              >
                {t("noteRequired")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("saving") : t("accept")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The finding's review: accept it as a documented exception, withdraw a
 * mistaken acceptance, or read how a later check resolved it.
 */
export function FindingReview({ view }: { view: FindingView }) {
  const t = useScopedI18n("documentationQuality.review");
  const locale = useCurrentLocale();
  const errorMessage = useQualityErrorMessage();
  const reopenFinding = useMutation(api.documentationQuality.reopenFinding);
  const [accepting, setAccepting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const { finding } = view;
  const reviewedOn = useClientDateFns(
    finding.review?.reviewedAt,
    "MMM d, yyyy",
    locale,
  );
  const resolvedOn = useClientDateFns(
    finding.resolvedAt,
    "MMM d, yyyy",
    locale,
  );
  const reviewLine = finding.review
    ? t("reviewedBy", {
        name: view.reviewedByName ?? t("unknownReviewer"),
        date: reviewedOn,
      })
    : null;

  async function reopen() {
    setIsWorking(true);
    try {
      await reopenFinding({ findingId: finding._id });
      toast.success(t("reopened"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section
      aria-labelledby="finding-review-title"
      className="space-y-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 id="finding-review-title" className="text-lg font-medium">
        {t("title")}
      </h2>
      {finding.status === "resolved" ? (
        <p className="text-sm text-muted-foreground">
          {t("resolved", {
            number: finding.resolvedCheckNumber ?? finding.lastCheckNumber,
            date: resolvedOn,
          })}
        </p>
      ) : null}
      {finding.status === "accepted" && finding.review ? (
        <div className="space-y-1">
          <p className="whitespace-pre-wrap text-sm">{finding.review.note}</p>
          <p className="text-xs text-muted-foreground">{reviewLine}</p>
        </div>
      ) : null}
      {finding.status === "open" && finding.review ? (
        <div className="space-y-1 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("earlierReview")}</p>
          <p className="whitespace-pre-wrap text-sm">{finding.review.note}</p>
          <p className="text-xs text-muted-foreground">{reviewLine}</p>
        </div>
      ) : null}
      {finding.status === "open" ? (
        <p className="text-sm text-muted-foreground">{t("openHint")}</p>
      ) : null}
      {finding.status === "open" ? (
        <Button size="sm" variant="outline" onClick={() => setAccepting(true)}>
          {t("acceptAction")}
        </Button>
      ) : null}
      {finding.status === "accepted" ? (
        finding.kind === "duplicate_identifier" ? (
          <p className="text-xs text-muted-foreground">
            {t("reviewedInRegister")}
          </p>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isWorking}
            onClick={reopen}
          >
            {t("reopen")}
          </Button>
        )
      ) : null}
      {accepting ? (
        <AcceptDialog
          view={view}
          onOpenChange={(open) => {
            if (!open) setAccepting(false);
          }}
        />
      ) : null}
    </section>
  );
}
