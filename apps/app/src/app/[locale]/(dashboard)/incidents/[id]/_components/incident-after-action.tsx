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
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DATE_TIME } from "../../_components/incident-format";
import { Field, type IncidentDetail, Section } from "./incident-detail-client";

const TEXT_MAX_LENGTH = 4000;

/** The after-action review that closes the incident, and reopening it. */
export function IncidentAfterAction({
  incident,
}: {
  incident: IncidentDetail;
}) {
  const t = useScopedI18n("incidents.afterAction");
  const locale = useCurrentLocale();
  const [dialog, setDialog] = useState<"close" | "reopen" | null>(null);
  const record = incident.afterAction;
  const coordinator = incident.viewer.canCoordinate;

  return (
    <Section
      id="incident-after-action"
      title={t("title")}
      action={
        coordinator ? (
          <Button
            size="sm"
            variant={record ? "outline" : "default"}
            onClick={() => setDialog(record ? "reopen" : "close")}
          >
            {record ? t("reopen") : t("close")}
          </Button>
        ) : null
      }
    >
      {record ? (
        <dl className="grid gap-4">
          <Field label={t("summary")}>{record.summary}</Field>
          {record.whatWorked ? (
            <Field label={t("whatWorked")}>{record.whatWorked}</Field>
          ) : null}
          {record.improvements ? (
            <Field label={t("improvements")}>{record.improvements}</Field>
          ) : null}
          {record.followUp ? (
            <Field label={t("followUp")}>{record.followUp}</Field>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("recordedBy", { name: record.recordedByName ?? "-" })}{" "}
            <ClientDate
              timestamp={record.recordedAt}
              locale={locale}
              options={DATE_TIME}
            />
          </p>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          {coordinator ? t("pendingCoordinator") : t("pending")}
        </p>
      )}
      {incident.earlierAfterActions.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t("earlier", { count: incident.earlierAfterActions.length })}
          </summary>
          <ul className="mt-2 space-y-2">
            {incident.earlierAfterActions.map((earlier) => (
              <li
                key={earlier.recordedAt}
                className="rounded-md border border-border p-2"
              >
                <p className="whitespace-pre-wrap">{earlier.summary}</p>
                <p className="text-xs text-muted-foreground">
                  <ClientDate
                    timestamp={earlier.recordedAt}
                    locale={locale}
                    options={DATE_TIME}
                  />
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Dialog
        open={dialog !== null}
        onOpenChange={(next) => {
          if (!next) setDialog(null);
        }}
      >
        {dialog === "close" ? (
          <CloseForm incident={incident} onDone={() => setDialog(null)} />
        ) : dialog === "reopen" ? (
          <ReopenForm incident={incident} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
    </Section>
  );
}

function CloseForm({
  incident,
  onDone,
}: {
  incident: IncidentDetail;
  onDone: () => void;
}) {
  const t = useScopedI18n("incidents.afterAction");
  const tIncidents = useScopedI18n("incidents");
  const errorMessage = useWorkErrorMessage();
  const close = useMutation(api.incidents.close);
  const [summary, setSummary] = useState("");
  const [whatWorked, setWhatWorked] = useState("");
  const [improvements, setImprovements] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!summary.trim()) {
      setError(t("summaryRequired"));
      document.getElementById("incident-close-summary")?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await close({
        incidentId: incident._id,
        summary: summary.trim(),
        whatWorked: whatWorked.trim() || undefined,
        improvements: improvements.trim() || undefined,
        followUp: followUp.trim() || undefined,
      });
      toast.success(t("closed"));
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    ["incident-close-summary", t("summary"), summary, setSummary],
    ["incident-close-worked", t("whatWorked"), whatWorked, setWhatWorked],
    [
      "incident-close-improvements",
      t("improvements"),
      improvements,
      setImprovements,
    ],
    ["incident-close-follow-up", t("followUp"), followUp, setFollowUp],
  ] as const;

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>{t("closeTitle")}</DialogTitle>
          <DialogDescription>{t("closeDescription")}</DialogDescription>
        </DialogHeader>
        {fields.map(([id, label, value, setValue]) => (
          <div key={id} className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
              id={id}
              value={value}
              maxLength={TEXT_MAX_LENGTH}
              onChange={(event) => setValue(event.currentTarget.value)}
              aria-invalid={
                id === "incident-close-summary" && error !== null
                  ? true
                  : undefined
              }
              rows={id === "incident-close-summary" ? 4 : 2}
            />
          </div>
        ))}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tIncidents("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("closeSubmit")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ReopenForm({
  incident,
  onDone,
}: {
  incident: IncidentDetail;
  onDone: () => void;
}) {
  const t = useScopedI18n("incidents.afterAction");
  const tIncidents = useScopedI18n("incidents");
  const errorMessage = useWorkErrorMessage();
  const reopen = useMutation(api.incidents.reopen);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError(t("reasonRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reopen({ incidentId: incident._id, reason: reason.trim() });
      toast.success(t("reopened"));
      onDone();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>{t("reopenTitle")}</DialogTitle>
          <DialogDescription>{t("reopenDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="incident-reopen-reason">{t("reason")}</Label>
          <Textarea
            id="incident-reopen-reason"
            value={reason}
            maxLength={TEXT_MAX_LENGTH}
            onChange={(event) => setReason(event.currentTarget.value)}
            aria-invalid={error !== null}
            rows={3}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tIncidents("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("reopen")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
