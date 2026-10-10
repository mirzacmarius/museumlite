"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { ClientDate } from "@/components/client-date";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ExhibitionScheduleConflictsAlert } from "../../_components/exhibition-schedule-conflicts-alert";

type HandoffSummary = FunctionReturnType<
  typeof api.exhibitions.getPhysicalHandoffSummary
>;
type HandoffParticipant = HandoffSummary["participants"][number];
type HandoffAction = "install" | "deinstall" | "return" | "exception";

interface ExhibitionPhysicalHandoffsPanelProps {
  exhibitionId: string;
  organizationId: Id<"organizations">;
  startDate: number;
  endDate?: number;
}

const MIN_EXCEPTION_REASON = 10;

function toLocationId(value: string): Id<"locations"> | null {
  return value ? (value as Id<"locations">) : null;
}

export function ExhibitionPhysicalHandoffsPanel({
  exhibitionId,
  organizationId,
  startDate,
  endDate,
}: ExhibitionPhysicalHandoffsPanelProps) {
  const t = useScopedI18n("exhibitions.handoffs");
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("collections.update");

  const summary = useQuery(api.exhibitions.getPhysicalHandoffSummary, {
    exhibitionId: exhibitionId as Id<"exhibitions">,
  });

  const conflicts = useQuery(
    api.exhibitions.checkScheduleConflictsForParticipants,
    summary && summary.participants.length > 0
      ? {
          collectionIds: summary.participants.map(
            (participant) => participant.collectionId,
          ),
          startDate,
          endDate,
          excludeExhibitionId: exhibitionId as Id<"exhibitions">,
        }
      : "skip",
  );

  if (summary === undefined) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground" role="status">
          {t("loading")}
        </p>
      </div>
    );
  }

  if (summary.participantCount === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="exhibition-handoffs-title"
      className="rounded-xl border border-border bg-muted/20 p-4 sm:p-6"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="exhibition-handoffs-title"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground"
        >
          <Package className="size-4" />
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("outstanding", {
            count: summary.outstandingCount,
            total: summary.participantCount,
          })}
          {summary.canClose ? ` · ${t("readyToClose")}` : ""}
        </p>
      </div>

      {conflicts?.hasConflicts ? (
        <ExhibitionScheduleConflictsAlert conflicts={conflicts.conflicts} />
      ) : null}

      <ul className="mt-4 space-y-4">
        {summary.participants.map((participant) => (
          <ExhibitionHandoffParticipantRow
            key={participant.exhibitionObjectId}
            participant={participant}
            organizationId={organizationId}
            canUpdate={canUpdate}
            returnPath={`/exhibitions/${exhibitionId}`}
          />
        ))}
      </ul>
      {summary.timeline.length > 0 ? (
        <ExhibitionHandoffTimeline summary={summary} />
      ) : null}
    </section>
  );
}

function ExhibitionHandoffParticipantRow({
  participant,
  organizationId,
  canUpdate,
  returnPath,
}: {
  participant: HandoffParticipant;
  organizationId: Id<"organizations">;
  canUpdate: boolean;
  /** The exhibition, so the object page's back link returns here. */
  returnPath: string;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions.handoffs");
  const titleId = `handoff-${participant.exhibitionObjectId}-title`;
  const title =
    participant.collectionTitle ??
    participant.collectionAccessionNumber ??
    participant.collectionId;
  const hasNextStep =
    participant.status === "pending" ||
    participant.status === "installed" ||
    (participant.status === "deinstalled" && !participant.hasReturnException);
  const objectHref = `/${locale}/objects/${participant.collectionId}`;

  return (
    <li
      aria-labelledby={titleId}
      className="rounded-lg border border-border/60 bg-background/40 p-4"
    >
      <div className="min-w-0 space-y-1">
        <p
          id={titleId}
          className="break-words text-sm font-medium text-foreground"
        >
          {title}
        </p>
        {participant.collectionTitle &&
        participant.collectionAccessionNumber ? (
          <p className="break-all font-mono text-xs text-muted-foreground">
            {participant.collectionAccessionNumber}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t(`status.${participant.status}`)}
          {participant.hasReturnException ? ` · ${t("exceptionRecorded")}` : ""}
          {participant.installationMovementId
            ? ` · ${t("installMovementRecorded")}`
            : ""}
          {participant.returnMovementId
            ? ` · ${t("returnMovementRecorded")}`
            : ""}
        </p>
        <div className="flex flex-wrap gap-x-4">
          <Link
            href={withReturnPath(objectHref, returnPath)}
            className="inline-flex min-h-8 items-center text-xs text-primary hover:underline"
          >
            {t("viewObject")}
          </Link>
          {canUpdate && hasNextStep ? (
            <Link
              href={withReturnPath(`${objectHref}?tab=physical`, returnPath)}
              className="inline-flex min-h-8 items-center text-xs text-primary hover:underline"
            >
              {t("recordAssessment")}
            </Link>
          ) : null}
        </div>
      </div>

      {canUpdate && hasNextStep ? (
        // Each step starts from the object's latest recorded location.
        <ExhibitionHandoffActions
          key={participant.status}
          participant={participant}
          organizationId={organizationId}
        />
      ) : null}
    </li>
  );
}

function ExhibitionHandoffActions({
  participant,
  organizationId,
}: {
  participant: HandoffParticipant;
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("exhibitions.handoffs");
  const evidenceT = useScopedI18n("conditionAssessments");
  const capabilityMessage = useCapabilityErrorMessage();
  const custodyConflictMessage = useCustodyConflictMessage();
  const installObject = useMutation(api.exhibitions.installObject);
  const deinstallObject = useMutation(api.exhibitions.deinstallObject);
  const returnObject = useMutation(
    api.exhibitions.returnObjectToOriginalLocation,
  );
  const authorizeException = useMutation(
    api.exhibitions.authorizeReturnException,
  );
  // The observed source starts at where the object is recorded now; staff
  // change it when they find the object elsewhere.
  const [draft, setDraft] = useState(() => ({
    assessmentId: "",
    installationDestination: "",
    returnDestination: participant.returnLocationId ?? "",
    observedFrom: participant.currentLocationId ?? "",
    exceptionReason: "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<HandoffAction | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const field = (name: string) =>
    `handoff-${participant.exhibitionObjectId}-${name}`;
  const fields = {
    assessment: field("assessment"),
    installationDestination: field("installation-destination"),
    returnDestination: field("return-destination"),
    observedFrom: field("observed-from"),
    exceptionReason: field("exception-reason"),
  };

  function set(patch: Partial<typeof draft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setFieldErrors({});
  }

  /** Records a handoff once its required fields are filled in. */
  async function submit(
    action: HandoffAction,
    required: Array<[fieldId: string, missing: boolean, message: string]>,
    run: () => Promise<unknown>,
  ) {
    setRefusal(null);
    const errors: Record<string, string> = {};
    for (const [fieldId, missing, message] of required) {
      if (missing) errors[fieldId] = message;
    }
    setFieldErrors(errors);
    const [firstInvalid] = Object.keys(errors);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setBusy(action);
    try {
      await run();
    } catch (cause) {
      setRefusal({
        message:
          capabilityMessage(cause) ??
          custodyConflictMessage(cause, t("actionFailed")),
      });
    } finally {
      setBusy(null);
    }
  }

  const assessmentRequired: [string, boolean, string] = [
    fields.assessment,
    !draft.assessmentId,
    t("errors.assessment"),
  ];
  const assessmentId = draft.assessmentId as Id<"conditionAssessments">;
  const exceptionTooShort =
    draft.exceptionReason.trim().length < MIN_EXCEPTION_REASON;

  return (
    <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
      <div className="space-y-2">
        <Label htmlFor={fields.assessment}>
          {evidenceT("assessmentLabel")}
        </Label>
        <AcceptedConditionAssessmentSelector
          id={fields.assessment}
          collectionId={participant.collectionId}
          value={draft.assessmentId}
          onValueChange={(value) => set({ assessmentId: value })}
          disabled={busy !== null}
          {...fieldErrorProps(
            fields.assessment,
            fieldErrors[fields.assessment],
          )}
        />
        <FieldError
          field={fields.assessment}
          message={fieldErrors[fields.assessment]}
        />
      </div>
      {participant.status === "pending" ? (
        <div className="space-y-2">
          <Label htmlFor={fields.installationDestination}>
            {t("installationDestination")}
          </Label>
          <LocationSelector
            id={fields.installationDestination}
            organizationId={organizationId}
            value={draft.installationDestination}
            onValueChange={(value) => set({ installationDestination: value })}
            allowNone={false}
            disabled={busy !== null}
            {...fieldErrorProps(
              fields.installationDestination,
              fieldErrors[fields.installationDestination],
            )}
          />
          <FieldError
            field={fields.installationDestination}
            message={fieldErrors[fields.installationDestination]}
          />
        </div>
      ) : null}
      {participant.status === "deinstalled" ? (
        <div className="space-y-2">
          <Label htmlFor={fields.returnDestination}>
            {evidenceT("returnDestination")}
          </Label>
          <LocationSelector
            id={fields.returnDestination}
            organizationId={organizationId}
            value={draft.returnDestination}
            onValueChange={(value) => set({ returnDestination: value })}
            allowNone={false}
            disabled={busy !== null}
            {...fieldErrorProps(
              fields.returnDestination,
              fieldErrors[fields.returnDestination],
            )}
          />
          <FieldError
            field={fields.returnDestination}
            message={fieldErrors[fields.returnDestination]}
          />
        </div>
      ) : null}
      {participant.status === "pending" ||
      participant.status === "deinstalled" ? (
        <div className="space-y-2">
          <Label htmlFor={fields.observedFrom}>{t("observedFrom")}</Label>
          <LocationSelector
            id={fields.observedFrom}
            organizationId={organizationId}
            value={draft.observedFrom}
            onValueChange={(value) => set({ observedFrom: value })}
            disabled={busy !== null}
          />
        </div>
      ) : null}

      <ActionRefusal refusal={refusal} />

      {participant.status === "pending" ? (
        <Button
          className="w-full sm:w-auto"
          disabled={busy !== null}
          onClick={() =>
            submit(
              "install",
              [
                assessmentRequired,
                [
                  fields.installationDestination,
                  !draft.installationDestination,
                  t("errors.installationDestination"),
                ],
              ],
              () =>
                installObject({
                  exhibitionObjectId: participant.exhibitionObjectId,
                  installationConditionAssessmentId: assessmentId,
                  exhibitionLocationId:
                    draft.installationDestination as Id<"locations">,
                  observedFromLocationId: toLocationId(draft.observedFrom),
                }),
            )
          }
        >
          {busy === "install" ? (
            <RefreshCw className="mr-2 size-3 animate-spin" />
          ) : null}
          {busy === "install" ? t("saving") : t("install")}
        </Button>
      ) : null}

      {participant.status === "installed" ? (
        <Button
          className="w-full sm:w-auto"
          variant="secondary"
          disabled={busy !== null}
          onClick={() =>
            submit("deinstall", [assessmentRequired], () =>
              deinstallObject({
                exhibitionObjectId: participant.exhibitionObjectId,
                deinstallationConditionAssessmentId: assessmentId,
              }),
            )
          }
        >
          {busy === "deinstall" ? t("saving") : t("deinstall")}
        </Button>
      ) : null}

      {participant.status === "deinstalled" ? (
        <>
          <Button
            className="w-full sm:w-auto"
            disabled={busy !== null}
            onClick={() =>
              submit(
                "return",
                [
                  assessmentRequired,
                  [
                    fields.returnDestination,
                    !draft.returnDestination,
                    t("errors.returnDestination"),
                  ],
                ],
                () =>
                  returnObject({
                    exhibitionObjectId: participant.exhibitionObjectId,
                    observedFromLocationId: toLocationId(draft.observedFrom),
                    overrideLocationId:
                      draft.returnDestination as Id<"locations">,
                    returnConditionAssessmentId: assessmentId,
                  }),
              )
            }
          >
            {busy === "return" ? t("saving") : t("confirmReturn")}
          </Button>
          <div className="space-y-2 border-t border-border/40 pt-4">
            <Label htmlFor={fields.exceptionReason}>
              {t("exceptionReason")}
            </Label>
            <Input
              id={fields.exceptionReason}
              value={draft.exceptionReason}
              onChange={(event) => set({ exceptionReason: event.target.value })}
              placeholder={t("exceptionPlaceholder")}
              disabled={busy !== null}
              {...fieldErrorProps(
                fields.exceptionReason,
                fieldErrors[fields.exceptionReason],
              )}
            />
            <FieldError
              field={fields.exceptionReason}
              message={fieldErrors[fields.exceptionReason]}
            />
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                submit(
                  "exception",
                  [
                    [
                      fields.exceptionReason,
                      exceptionTooShort,
                      t("errors.exceptionReason"),
                    ],
                  ],
                  () =>
                    authorizeException({
                      exhibitionObjectId: participant.exhibitionObjectId,
                      reason: draft.exceptionReason.trim(),
                    }),
                )
              }
            >
              {busy === "exception" ? t("saving") : t("authorizeException")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ExhibitionHandoffTimeline({ summary }: { summary: HandoffSummary }) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions.handoffs");
  const evidenceT = useScopedI18n("conditionAssessments");
  const participantsById = new Map(
    summary.participants.map((participant) => [
      participant.exhibitionObjectId,
      participant,
    ]),
  );

  return (
    <section className="mt-6 space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">{evidenceT("handoffTimeline")}</h3>
      <ol className="space-y-3 text-xs">
        {summary.timeline.map((event) => (
          <li
            key={`${event.exhibitionObjectId}-${event.phase}`}
            className="space-y-1 break-words"
          >
            <p>
              {event.phase === "exception"
                ? t("exceptionRecorded")
                : t(`status.${event.phase}`)}{" "}
              ·{" "}
              {
                participantsById.get(event.exhibitionObjectId)
                  ?.collectionAccessionNumber
              }{" "}
              ·{" "}
              {event.actorName
                ? evidenceT("actorCurrentName", { name: event.actorName })
                : event.actorId
                  ? evidenceT("actorProfileUnavailable")
                  : evidenceT("unknownLegacyActor")}
            </p>
            <p className="text-muted-foreground">
              <ClientDate
                timestamp={event.recordedAt}
                locale={locale}
                options={{ dateStyle: "medium", timeStyle: "short" }}
              />
            </p>
            {event.conditionAssessmentId ? (
              <p>
                {evidenceT("title")} · {evidenceT("acceptedStatus")}
              </p>
            ) : null}
            {event.notes ? <p>{event.notes}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
