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
import { useMutation, useQuery } from "convex/react";
import { CheckCheck, MapPin, Printer, XCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import {
  LabelSheetDialog,
  recordLabelUrl,
} from "@/components/label-sheet-dialog";
import { useInventoryErrorMessage } from "@/hooks/use-inventory-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { SessionView } from "./session-types";

const MAX_REASON_LENGTH = 1000;

function FinishDialog({
  session,
  onOpenChange,
}: {
  session: SessionView;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("inventory.session");
  const errorMessage = useInventoryErrorMessage();
  const finishScanning = useMutation(api.inventory.finishScanning);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function finish() {
    setIsSaving(true);
    setRefusal(null);
    try {
      await finishScanning({ sessionId: session._id });
      toast.success(t("finished"));
      onOpenChange(false);
    } catch (error) {
      setRefusal({ message: errorMessage(error) });
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("finishTitle")}</DialogTitle>
          <DialogDescription>{t("finishDescription")}</DialogDescription>
        </DialogHeader>
        <ActionRefusal refusal={refusal} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("keepScanning")}
          </Button>
          <Button onClick={finish} disabled={isSaving}>
            {isSaving ? t("finishing") : t("finish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  session,
  onOpenChange,
}: {
  session: SessionView;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("inventory.session");
  const errorMessage = useInventoryErrorMessage();
  const cancelSession = useMutation(api.inventory.cancelSession);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const reasonMissing = submitted && !reason.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!reason.trim()) {
      document.getElementById("inventory-cancel-reason")?.focus();
      return;
    }
    setIsSaving(true);
    setRefusal(null);
    try {
      await cancelSession({ sessionId: session._id, reason });
      toast.success(t("cancelled"));
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
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>{t("cancelDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inventory-cancel-reason">{t("cancelReason")}</Label>
            <Textarea
              id="inventory-cancel-reason"
              value={reason}
              rows={3}
              maxLength={MAX_REASON_LENGTH}
              aria-invalid={reasonMissing}
              aria-describedby={
                reasonMissing ? "inventory-cancel-reason-error" : undefined
              }
              onChange={(event) => setReason(event.target.value)}
              disabled={isSaving}
            />
            {reasonMissing ? (
              <p
                id="inventory-cancel-reason-error"
                className="text-xs text-destructive"
              >
                {t("cancelReasonRequired")}
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
              {t("keepScanning")}
            </Button>
            <Button type="submit" variant="destructive" disabled={isSaving}>
              {isSaving ? t("cancelling") : t("cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ObjectLabelsDialog({
  session,
  onOpenChange,
}: {
  session: SessionView;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("inventory.session");
  const locale = useCurrentLocale();
  const rows = useQuery(api.inventory.listExpected, { sessionId: session._id });
  return (
    <LabelSheetDialog
      open
      onOpenChange={onOpenChange}
      title={t("objectLabelsTitle")}
      description={t("objectLabelsDescription", {
        count: session.progress.expected,
      })}
      labels={rows?.map((row) => ({
        accessionNumber: row.accessionNumber,
        title: row.title,
        qrCodeUrl: recordLabelUrl(locale, "objects", row.collectionId),
      }))}
      idPrefix="inventory-objects"
    />
  );
}

function LocationLabelsDialog({
  session,
  onOpenChange,
}: {
  session: SessionView;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("inventory.session");
  const locale = useCurrentLocale();
  return (
    <LabelSheetDialog
      open
      onOpenChange={onOpenChange}
      title={t("locationLabelsTitle")}
      description={t("locationLabelsDescription", {
        count: session.scopeLocations.length,
      })}
      labels={session.scopeLocations.map((location) => ({
        accessionNumber: location.locationCode ?? location.name,
        title: location.name,
        qrCodeUrl: recordLabelUrl(locale, "locations", location._id),
      }))}
      idPrefix="inventory-locations"
    />
  );
}

type OpenDialog = "finish" | "cancel" | "objectLabels" | "locationLabels";

/** Labels for anyone following the session; finish and cancel for staff who scan. */
export function SessionActions({ session }: { session: SessionView }) {
  const t = useScopedI18n("inventory.session");
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const canChange = session.status === "scanning" && session.canWork;

  return (
    <div className="flex flex-wrap gap-2">
      {canChange ? (
        <Button size="sm" onClick={() => setDialog("finish")}>
          <CheckCheck className="mr-2 size-4" />
          {t("finish")}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialog("objectLabels")}
        disabled={session.progress.expected === 0}
      >
        <Printer className="mr-2 size-4" />
        {t("printObjectLabels")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialog("locationLabels")}
      >
        <MapPin className="mr-2 size-4" />
        {t("printLocationLabels")}
      </Button>
      {canChange ? (
        <Button size="sm" variant="ghost" onClick={() => setDialog("cancel")}>
          <XCircle className="mr-2 size-4" />
          {t("cancel")}
        </Button>
      ) : null}
      {dialog === "finish" ? (
        <FinishDialog session={session} onOpenChange={close} />
      ) : null}
      {dialog === "cancel" ? (
        <CancelDialog session={session} onOpenChange={close} />
      ) : null}
      {dialog === "objectLabels" ? (
        <ObjectLabelsDialog session={session} onOpenChange={close} />
      ) : null}
      {dialog === "locationLabels" ? (
        <LocationLabelsDialog session={session} onOpenChange={close} />
      ) : null}
    </div>
  );
}
