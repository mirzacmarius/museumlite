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
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Link2, Loader2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { formatMoney } from "@/lib/format-number";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DATE_TIME } from "../../_components/incident-format";
import { type IncidentDetail, Section } from "./incident-detail-client";

/** Linked assessments, photos and claims, and coverage at discovery. */
export function IncidentEvidence({ incident }: { incident: IncidentDetail }) {
  const t = useScopedI18n("incidents.evidence");
  const locale = useCurrentLocale();
  const errorMessage = useWorkErrorMessage();
  const view = useQuery(api.incidentEvidence.getEvidence, {
    incidentId: incident._id,
  });
  const [linking, setLinking] = useState(false);
  const [retracting, setRetracting] = useState<Id<"incidentEvidence"> | null>(
    null,
  );
  const open = incident.status !== "closed";
  const returnPath = `/incidents/${incident._id}`;

  return (
    <Section
      id="incident-evidence"
      title={t("title")}
      action={
        open && incident.viewer.canWork ? (
          <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
            <Link2 className="mr-1 size-4" aria-hidden="true" />
            {t("link")}
          </Button>
        ) : null
      }
    >
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {view === undefined ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : view.evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {view.evidence.map((row) => (
            <li
              key={row._id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t(`kinds.${row.kind}`)}
                </p>
                <p
                  className={
                    row.retraction
                      ? "break-words text-sm line-through"
                      : "break-words text-sm"
                  }
                >
                  {row.visible && row.label ? (
                    row.kind === "insuranceClaim" ? (
                      <Link
                        href="/insurance"
                        className="underline-offset-2 hover:underline"
                      >
                        {row.label}
                      </Link>
                    ) : row.objectId ? (
                      <Link
                        href={withReturnPath(
                          `/objects/${row.objectId}${row.kind === "conditionAssessment" ? "?tab=physical" : "?tab=media"}`,
                          returnPath,
                        )}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.label}
                      </Link>
                    ) : (
                      row.label
                    )
                  ) : (
                    t("restricted")
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("linkedBy", { name: row.linkedByName ?? "-" })}{" "}
                  <ClientDate
                    timestamp={row.linkedAt}
                    locale={locale}
                    options={DATE_TIME}
                  />
                </p>
                {row.retraction ? (
                  <p className="text-xs text-muted-foreground">
                    {t("retractedBy", {
                      name: row.retraction.retractedByName ?? "-",
                      reason: row.retraction.reason,
                    })}
                  </p>
                ) : null}
              </div>
              {open && incident.viewer.canWork && !row.retraction ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRetracting(row._id)}
                >
                  {t("retract")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("coverageTitle")}</h3>
        {view === undefined ? null : view.coverage === null ? (
          <p className="text-sm text-muted-foreground">
            {t("coverageRestricted")}
          </p>
        ) : view.coverage.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("coverageNone")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.coverage.map((row) => (
              <li key={`${row.collectionId}-${row.policyNumber}`}>
                {t("coverageRow", {
                  object: row.objectTitle,
                  policy: row.policyNumber,
                  carrier: row.carrier,
                  value: formatMoney(row.coveredValue, locale, row.currency),
                })}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("coverageNote")}</p>
      </div>

      <Dialog open={linking} onOpenChange={setLinking}>
        {linking ? (
          <LinkEvidenceForm
            incident={incident}
            linkedIds={
              new Set(
                (view?.evidence ?? []).flatMap((row) =>
                  row.retraction ? [] : [row.recordId],
                ),
              )
            }
            onDone={() => setLinking(false)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={retracting !== null}
        onOpenChange={(next) => {
          if (!next) setRetracting(null);
        }}
      >
        {retracting ? (
          <RetractForm
            evidenceId={retracting}
            onDone={() => setRetracting(null)}
            onError={(error) => toast.error(errorMessage(error))}
          />
        ) : null}
      </Dialog>
    </Section>
  );
}

function LinkEvidenceForm({
  incident,
  linkedIds,
  onDone,
}: {
  incident: IncidentDetail;
  linkedIds: ReadonlySet<string>;
  onDone: () => void;
}) {
  const t = useScopedI18n("incidents.evidence");
  const tIncidents = useScopedI18n("incidents");
  const errorMessage = useWorkErrorMessage();
  const candidates = useQuery(api.incidentEvidence.listEvidenceCandidates, {
    incidentId: incident._id,
  });
  const link = useMutation(api.incidentEvidence.linkEvidence);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available = candidates?.filter(
    (candidate) => !linkedIds.has(candidate.reference.id),
  );

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("linkTitle")}</DialogTitle>
        <DialogDescription>{t("linkDescription")}</DialogDescription>
      </DialogHeader>
      {available === undefined ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCandidates")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {available.map((candidate) => (
            <li
              key={candidate.reference.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t(`kinds.${candidate.reference.kind}`)}
                </p>
                <p className="break-words text-sm">{candidate.label}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(candidate.reference.id);
                  setError(null);
                  try {
                    await link({
                      incidentId: incident._id,
                      reference: candidate.reference,
                    });
                    toast.success(t("linked"));
                  } catch (cause) {
                    setError(errorMessage(cause));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === candidate.reference.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("linkOne")
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {tIncidents("close")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RetractForm({
  evidenceId,
  onDone,
  onError,
}: {
  evidenceId: Id<"incidentEvidence">;
  onDone: () => void;
  onError: (error: unknown) => void;
}) {
  const t = useScopedI18n("incidents.evidence");
  const tIncidents = useScopedI18n("incidents");
  const retract = useMutation(api.incidentEvidence.retractEvidence);
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
    try {
      await retract({ evidenceId, reason: reason.trim() });
      onDone();
    } catch (cause) {
      onError(cause);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{t("retractTitle")}</DialogTitle>
          <DialogDescription>{t("retractDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="incident-retract-reason">{t("reason")}</Label>
          <Textarea
            id="incident-retract-reason"
            value={reason}
            maxLength={2000}
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
            {t("retract")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
