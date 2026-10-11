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
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { useInventoryErrorMessage } from "@/hooks/use-inventory-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { formatMoment } from "../../../_components/inventory-format";
import type { ExceptionView } from "./exception-detail-client";

const MAX_REASON_LENGTH = 1000;

function AcceptDialog({
  view,
  onOpenChange,
}: {
  view: ExceptionView;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("inventory.exception");
  const errorMessage = useInventoryErrorMessage();
  const acceptException = useMutation(api.inventory.acceptException);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const reasonMissing = submitted && !reason.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!reason.trim()) {
      document.getElementById("inventory-accept-reason")?.focus();
      return;
    }
    setIsSaving(true);
    setRefusal(null);
    try {
      await acceptException({ exceptionId: view._id, reason });
      toast.success(t("accepted"));
      onOpenChange(false);
    } catch (error) {
      setRefusal({ message: errorMessage(error) });
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("acceptTitle")}</DialogTitle>
            <DialogDescription>{t("acceptDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inventory-accept-reason">{t("reason")}</Label>
            <Textarea
              id="inventory-accept-reason"
              value={reason}
              rows={4}
              maxLength={MAX_REASON_LENGTH}
              aria-invalid={reasonMissing}
              aria-describedby={
                reasonMissing ? "inventory-accept-reason-error" : undefined
              }
              onChange={(event) => setReason(event.target.value)}
              disabled={isSaving}
            />
            {reasonMissing ? (
              <p
                id="inventory-accept-reason-error"
                className="text-xs text-destructive"
              >
                {t("reasonRequired")}
              </p>
            ) : null}
          </div>
          <ActionRefusal refusal={refusal} />
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
              {isSaving ? t("accepting") : t("accept")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Closes the exception through the guarded movement command or a reasoned
 * acceptance. A refused move is explained here and the exception stays open.
 */
export function ExceptionReview({ view }: { view: ExceptionView }) {
  const t = useScopedI18n("inventory.exception");
  const tSession = useScopedI18n("inventory.session");
  const locale = useCurrentLocale();
  const errorMessage = useInventoryErrorMessage();
  const recordObservedLocation = useMutation(
    api.inventory.recordObservedLocation,
  );
  const [accepting, setAccepting] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const movable =
    (view.kind === "misplaced" || view.kind === "unexpected") &&
    !!view.observedLocationName;

  async function recordMove() {
    setIsMoving(true);
    setRefusal(null);
    try {
      const result = await recordObservedLocation({ exceptionId: view._id });
      toast.success(
        result.resolution.kind === "moved" ? t("moved") : t("confirmed"),
      );
    } catch (error) {
      setRefusal({ message: errorMessage(error) });
    } finally {
      setIsMoving(false);
    }
  }

  const resolution = view.resolution;
  return (
    <section
      aria-labelledby="inventory-exception-review"
      className="space-y-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 id="inventory-exception-review" className="text-lg font-medium">
        {t("reviewTitle")}
      </h2>
      {resolution ? (
        <div className="space-y-1">
          <p className="whitespace-pre-wrap break-words text-sm">
            {resolution.kind === "accepted"
              ? t("resolutions.accepted", { reason: resolution.reason })
              : t(`resolutions.${resolution.kind}`)}
          </p>
          {view.resolvedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("resolvedBy", {
                name: view.resolvedByName ?? tSession("unknownPerson"),
                date: formatMoment(view.resolvedAt, locale),
              })}
            </p>
          ) : null}
        </div>
      ) : view.canWork ? (
        <>
          <p className="text-sm text-muted-foreground">{t("openHint")}</p>
          {movable ? (
            <div className="space-y-1">
              <Button size="sm" onClick={recordMove} disabled={isMoving}>
                {isMoving
                  ? t("recording")
                  : t("recordMove", {
                      location: view.observedLocationName ?? "",
                    })}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("recordMoveHint", {
                  recorded: view.recordedLocationName ?? t("notRecorded"),
                  observed: view.observedLocationName ?? "",
                })}
              </p>
            </div>
          ) : null}
          <ActionRefusal refusal={refusal} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAccepting(true)}
          >
            {t("accept")}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("viewOnly")}</p>
      )}
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
