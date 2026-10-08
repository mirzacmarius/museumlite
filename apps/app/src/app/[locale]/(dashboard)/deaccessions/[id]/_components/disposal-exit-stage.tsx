"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { partyErrorFromError } from "@v1/backend/convex/utils/partyErrors";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDateFns } from "@/components/client-date";
import { PartyPicker, usePartyPickerAccess } from "@/components/party-picker";
import { usePermissions } from "@/components/permission-gate";
import { usePartyErrorMessage } from "@/hooks/use-party-error-message";
import { useScopedI18n } from "@/locales/client";
import { disposalStageErrorMessage } from "./disposal-stage-error";

type ExitStage = NonNullable<
  FunctionReturnType<typeof api.deaccessions.getDisposalStages>
>["exit"];

export function DisposalExitStage({
  deaccessionId,
  organizationId,
  exit,
  locale,
}: {
  deaccessionId: Id<"deaccessions">;
  organizationId: Id<"organizations">;
  exit: ExitStage;
  locale: string;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const { hasPermission } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const canRecord =
    exit.state !== "awaiting_decision" &&
    exit.state !== "not_applicable" &&
    hasPermission("collections.update");

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <h3 className="text-sm font-semibold">{t("exit.title")}</h3>
      {exit.state === "awaiting_decision" ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("awaitingDecision")}
        </p>
      ) : exit.state === "not_applicable" ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("notApplicable")}
        </p>
      ) : exit.record && !isEditing ? (
        <dl className="mt-2 space-y-1 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("exit.exitDate")}
            </dt>
            <dd>
              <ClientDateFns
                timestamp={exit.record.exitDate}
                format="MMM d, yyyy"
                locale={locale}
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("exit.recipient")}
            </dt>
            <dd className="whitespace-pre-wrap">{exit.record.recipient}</dd>
          </div>
          {exit.record.reference ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("exit.reference")}
              </dt>
              <dd>{exit.record.reference}</dd>
            </div>
          ) : null}
          {exit.record.notes ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t("notes")}</dt>
              <dd className="whitespace-pre-wrap">{exit.record.notes}</dd>
            </div>
          ) : null}
          <p className="pt-1 text-xs text-muted-foreground">
            {t("recordedBy", {
              name: exit.record.recordedByName ?? t("unknownUser"),
            })}
          </p>
          {exit.correctionCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("exit.corrections", { count: exit.correctionCount })}
            </p>
          ) : null}
        </dl>
      ) : !isEditing ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("exit.outstanding")}
        </p>
      ) : null}

      {canRecord && isEditing ? (
        <ExitForm
          deaccessionId={deaccessionId}
          organizationId={organizationId}
          existing={exit.record}
          onDone={() => setIsEditing(false)}
        />
      ) : canRecord ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setIsEditing(true)}
        >
          {exit.record ? t("exit.correct") : t("exit.record")}
        </Button>
      ) : null}
    </div>
  );
}

function ExitForm({
  deaccessionId,
  organizationId,
  existing,
  onDone,
}: {
  deaccessionId: Id<"deaccessions">;
  organizationId: Id<"organizations">;
  existing: ExitStage["record"];
  onDone: () => void;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const tParties = useScopedI18n("parties");
  const { canPick } = usePartyPickerAccess();
  const partyErrorMessage = usePartyErrorMessage();
  const recordExit = useMutation(api.deaccessions.recordExit);
  const [form, setForm] = useState<{
    exitDate: Date | undefined;
    recipient: string;
    recipientAccountId: Id<"accounts"> | undefined;
    reference: string;
    notes: string;
    correctionReason: string;
  }>({
    exitDate: existing ? new Date(existing.exitDate) : undefined,
    recipient: existing?.recipient ?? "",
    recipientAccountId: undefined,
    reference: existing?.reference ?? "",
    notes: existing?.notes ?? "",
    correctionReason: "",
  });
  const {
    exitDate,
    recipient,
    recipientAccountId,
    reference,
    notes,
    correctionReason,
  } = form;
  const update = <Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) => setForm((current) => ({ ...current, [field]: value }));
  const [isSaving, setIsSaving] = useState(false);

  const isValid =
    exitDate !== undefined &&
    recipient.trim().length > 0 &&
    (!existing || correctionReason.trim().length > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!exitDate || !isValid) return;
    setIsSaving(true);
    try {
      await recordExit({
        deaccessionId,
        exitDate: exitDate.getTime(),
        recipient,
        recipientAccountId,
        reference: reference || undefined,
        notes: notes || undefined,
        correctionReason: existing ? correctionReason : undefined,
      });
      toast.success(t("exit.saved"));
      onDone();
    } catch (error) {
      toast.error(
        partyErrorFromError(error)
          ? partyErrorMessage(error)
          : disposalStageErrorMessage(error, t("actionFailed")),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <DatePicker
        id="disposal-exit-date"
        label={t("exit.exitDate")}
        date={exitDate}
        onSelect={(value) => update("exitDate", value)}
        disabled={isSaving}
      />
      {canPick ? (
        <div className="space-y-1.5">
          <Label htmlFor="disposal-exit-party">
            {tParties("roles.recipient")}
          </Label>
          <PartyPicker
            id="disposal-exit-party"
            organizationId={organizationId}
            value={recipientAccountId}
            onChange={(party) =>
              setForm((current) => ({
                ...current,
                recipientAccountId: party?._id,
                recipient:
                  party && !current.recipient.trim()
                    ? party.displayName
                    : current.recipient,
              }))
            }
            disabled={isSaving}
          />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="disposal-exit-recipient">{t("exit.recipient")}</Label>
        <Input
          id="disposal-exit-recipient"
          value={recipient}
          onChange={(event) => update("recipient", event.target.value)}
          required
          disabled={isSaving}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="disposal-exit-reference">{t("exit.reference")}</Label>
        <Input
          id="disposal-exit-reference"
          value={reference}
          onChange={(event) => update("reference", event.target.value)}
          disabled={isSaving}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="disposal-exit-notes">{t("notes")}</Label>
        <Textarea
          id="disposal-exit-notes"
          value={notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={2}
          disabled={isSaving}
        />
      </div>
      {existing ? (
        <div className="space-y-1.5">
          <Label htmlFor="disposal-exit-correction">
            {t("exit.correctionReason")}
          </Label>
          <Textarea
            id="disposal-exit-correction"
            value={correctionReason}
            onChange={(event) => update("correctionReason", event.target.value)}
            rows={2}
            required
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            {t("exit.correctionHint")}
          </p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!isValid || isSaving}>
          {isSaving ? t("saving") : t("exit.save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={isSaving}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
