"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
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
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { CALENDAR_DATE_OPTIONS, formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { useRequestDate } from "../../_components/request-status";
import { ReasonDialog } from "./reason-dialog";
import type { RequestView } from "./request-view";
import { RightsFields } from "./rights-fields";
import { Field, Section } from "./section";

const expirySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The end of a calendar day in UTC: the last moment the license allows. */
function endOfUtcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined)
    return Number.NaN;
  return Date.UTC(year, month - 1, day, 23, 59, 59, 999);
}

function ApproveForm({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const errorMessage = useReproductionErrorMessage();
  const approve = useMutation(api.reproductionRequests.approve);
  const readyCopies = view.derivatives.filter(
    (derivative) => derivative.status === "ready",
  );
  const [derivativeId, setDerivativeId] = useState<string | undefined>(
    readyCopies[0]?._id,
  );
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const activeEvidence = view.evidence.some((entry) => !entry.retracted);
  const terms = view.latestTerms;
  const selectedCopy =
    readyCopies.find((copy) => copy._id === derivativeId) ?? readyCopies[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCopy || !terms) return;
    const parsed = expirySchema.safeParse(expiry);
    const expiresAt = parsed.success ? endOfUtcDay(parsed.data) : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      toast.error(t("errors.expiryInvalid"));
      return;
    }
    setSaving(true);
    try {
      await approve({
        requestId: view.request._id,
        derivativeId: selectedCopy._id as Id<"reproductionDerivatives">,
        termsId: terms._id,
        expiresAt,
        note: note.trim() || undefined,
      });
      toast.success(t("decision.approved"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border p-3"
    >
      <h3 className="text-sm font-medium">{t("decision.approveTitle")}</h3>
      {view.emailAvailable ? null : (
        <p className="text-sm text-muted-foreground">
          {t("decision.emailUnavailable")}
        </p>
      )}
      {activeEvidence ? null : (
        <p className="text-sm text-muted-foreground">
          {t("decision.evidenceRequired")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="approve-copy">{t("decision.copy")}</Label>
          {readyCopies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("decision.noReadyCopy")}
            </p>
          ) : (
            <Select
              value={selectedCopy?._id ?? ""}
              onValueChange={setDerivativeId}
            >
              <SelectTrigger id="approve-copy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {readyCopies.map((copy) => (
                  <SelectItem key={copy._id} value={copy._id}>
                    {copy.width && copy.height
                      ? t("derivative.dimensions", {
                          width: copy.width,
                          height: copy.height,
                        })
                      : t("derivative.sizeOption", { size: copy.maxDimension })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("decision.terms")}</span>
          <p className="text-sm">
            {terms
              ? t("decision.termsVersion", {
                  title: terms.title,
                  version: terms.version,
                })
              : t("decision.noTerms")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="approve-expiry">{t("decision.expires")}</Label>
          <Input
            id="approve-expiry"
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            aria-describedby="approve-expiry-hint"
          />
          <p id="approve-expiry-hint" className="text-xs text-muted-foreground">
            {t("decision.expiresHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="approve-note">{t("decision.note")}</Label>
          <Textarea
            id="approve-note"
            rows={2}
            maxLength={4000}
            value={note}
            placeholder={t("decision.notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
      <Button
        type="submit"
        disabled={saving || !selectedCopy || !terms || !activeEvidence}
      >
        {t("decision.approve")}
      </Button>
    </form>
  );
}

function DecisionRecord({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const locale = useCurrentLocale();
  const formatDay = useRequestDate();
  const decision = view.decision;
  if (!decision) return null;
  const name = decision.decidedByName ?? t("detail.notRecorded");
  const approval = decision.approval;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={decision.outcome === "approved" ? "default" : "outline"}
        >
          {decision.outcome === "approved"
            ? t("statuses.approved")
            : t("statuses.refused")}
        </Badge>
        {decision.grant ? (
          <Badge
            variant={decision.grant === "active" ? "secondary" : "outline"}
          >
            {t(`decision.grants.${decision.grant}`)}
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {decision.outcome === "approved"
            ? t("decision.approvedOn", {
                date: formatDay(decision.decidedAt),
                name,
              })
            : t("decision.refusedOn", {
                date: formatDay(decision.decidedAt),
                name,
              })}
        </span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {decision.reason ? (
          <div className="sm:col-span-2">
            <Field
              label={
                decision.outcome === "approved"
                  ? t("decision.note")
                  : t("detail.reason")
              }
            >
              {decision.reason}
            </Field>
          </div>
        ) : null}
        {approval ? (
          <>
            <Field label={t("decision.expires")}>
              {formatDate(
                new Date(approval.expiresAt),
                locale,
                CALENDAR_DATE_OPTIONS,
              )}{" "}
              (UTC)
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("decision.termsUsed")}>
                <span className="font-medium">
                  {t("decision.termsVersion", {
                    title: approval.termsTitle,
                    version: approval.termsVersion,
                  })}
                </span>
                {"\n"}
                {approval.termsBody}
              </Field>
            </div>
          </>
        ) : null}
        {decision.ended && decision.grant === "revoked" ? (
          <div className="sm:col-span-2">
            <Field label={t("decision.grants.revoked")}>
              {t("decision.revokedOn", {
                date: formatDay(decision.ended.at),
                reason: decision.ended.reason ?? "",
              })}
            </Field>
          </div>
        ) : null}
      </dl>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          {t("decision.rightsAtDecision")}
        </h3>
        <RightsFields rights={decision.rights} />
      </div>
    </div>
  );
}

export function DecisionSection({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const errorMessage = useReproductionErrorMessage();
  const refuse = useMutation(api.reproductionRequests.refuse);
  const revoke = useMutation(api.reproductionRequests.revoke);
  const [dialog, setDialog] = useState<"refuse" | "revoke">();
  const { status } = view.request;
  const canDecide = view.commands.canDecide;

  return (
    <Section
      id="decision-title"
      title={t("decision.title")}
      description={t("decision.description")}
      action={
        canDecide && status === "open" ? (
          <Button variant="outline" onClick={() => setDialog("refuse")}>
            {t("decision.refuse")}
          </Button>
        ) : canDecide && view.decision?.grant === "active" ? (
          <Button variant="destructive" onClick={() => setDialog("revoke")}>
            {t("decision.revoke")}
          </Button>
        ) : null
      }
    >
      {status === "open" ? (
        canDecide ? (
          <ApproveForm view={view} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("decision.awaiting")} {t("decision.cannotDecide")}
          </p>
        )
      ) : view.decision ? (
        <DecisionRecord view={view} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(`statuses.${status}`)}
        </p>
      )}
      {dialog === "refuse" ? (
        <ReasonDialog
          title={t("decision.refuseTitle")}
          description={t("decision.description")}
          confirmLabel={t("decision.refuse")}
          onClose={() => setDialog(undefined)}
          onConfirm={async (reason) => {
            try {
              await refuse({ requestId: view.request._id, reason });
              toast.success(t("decision.refused"));
              return true;
            } catch (error) {
              toast.error(errorMessage(error));
              return false;
            }
          }}
        />
      ) : null}
      {dialog === "revoke" ? (
        <ReasonDialog
          title={t("decision.revokeTitle")}
          description={t("decision.revokeDescription")}
          confirmLabel={t("decision.revoke")}
          onClose={() => setDialog(undefined)}
          onConfirm={async (reason) => {
            try {
              await revoke({ requestId: view.request._id, reason });
              toast.success(t("decision.revokedToast"));
              return true;
            } catch (error) {
              toast.error(errorMessage(error));
              return false;
            }
          }}
        />
      ) : null}
    </Section>
  );
}
