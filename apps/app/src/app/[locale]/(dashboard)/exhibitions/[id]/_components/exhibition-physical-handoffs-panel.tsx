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
import { useReducer, useState } from "react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { ClientDate } from "@/components/client-date";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ExhibitionScheduleConflictsAlert } from "../../_components/exhibition-schedule-conflicts-alert";

type HandoffSummary = FunctionReturnType<
  typeof api.exhibitions.getPhysicalHandoffSummary
>;
type HandoffParticipant = HandoffSummary["participants"][number];

interface ExhibitionPhysicalHandoffsPanelProps {
  exhibitionId: string;
  organizationId: Id<"organizations">;
  startDate: number;
  endDate?: number;
}

interface HandoffDraft {
  observedFrom: string;
  installationDestination: string;
  exceptionReason: string;
  assessmentId: string;
  returnDestination?: string;
}

type HandoffDraftAction =
  | {
      type: "set";
      field: keyof HandoffDraft;
      value: string;
    }
  | { type: "clear-assessment" };

const initialHandoffDraft: HandoffDraft = {
  observedFrom: "__none__",
  installationDestination: "",
  exceptionReason: "",
  assessmentId: "",
};

function handoffDraftReducer(
  state: HandoffDraft,
  action: HandoffDraftAction,
): HandoffDraft {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "clear-assessment":
      return { ...state, assessmentId: "" };
  }
}

function toObservedLocationId(value: string): Id<"locations"> | null {
  if (!value || value === "__none__") {
    return null;
  }
  return value as Id<"locations">;
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

  const [busyObjectId, setBusyObjectId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (summary === undefined) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (summary.participantCount === 0) {
    return null;
  }

  async function runHandoff(
    exhibitionObjectId: Id<"exhibitionObjects">,
    action: () => Promise<unknown>,
  ) {
    setError("");
    setBusyObjectId(exhibitionObjectId);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("actionFailed"));
      return false;
    } finally {
      setBusyObjectId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
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

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

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
            busy={busyObjectId === participant.exhibitionObjectId}
            runHandoff={runHandoff}
          />
        ))}
      </ul>
      {summary.timeline.length > 0 ? (
        <ExhibitionHandoffTimeline summary={summary} />
      ) : null}
    </div>
  );
}

function ExhibitionHandoffParticipantRow({
  participant,
  organizationId,
  canUpdate,
  busy,
  runHandoff,
}: {
  participant: HandoffParticipant;
  organizationId: Id<"organizations">;
  canUpdate: boolean;
  busy: boolean;
  runHandoff: (
    exhibitionObjectId: Id<"exhibitionObjects">,
    action: () => Promise<unknown>,
  ) => Promise<boolean>;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions.handoffs");
  const [draft, dispatch] = useReducer(
    handoffDraftReducer,
    initialHandoffDraft,
  );
  const label =
    participant.collectionAccessionNumber ??
    participant.collectionTitle ??
    participant.collectionId;

  async function submitHandoff(action: () => Promise<unknown>) {
    if (await runHandoff(participant.exhibitionObjectId, action)) {
      dispatch({ type: "clear-assessment" });
    }
  }

  return (
    <li className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {t(`status.${participant.status}`)}
            {participant.hasReturnException
              ? ` · ${t("exceptionRecorded")}`
              : ""}
            {participant.installationMovementId
              ? ` · ${t("installMovementRecorded")}`
              : ""}
            {participant.returnMovementId
              ? ` · ${t("returnMovementRecorded")}`
              : ""}
          </p>
          <Link
            href={`/${locale}/objects/${participant.collectionId}`}
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            {t("viewObject")}
          </Link>
        </div>
      </div>

      {canUpdate ? (
        <ExhibitionHandoffActions
          participant={participant}
          organizationId={organizationId}
          busy={busy}
          draft={draft}
          dispatch={dispatch}
          submitHandoff={submitHandoff}
        />
      ) : null}
    </li>
  );
}

function ExhibitionHandoffActions({
  participant,
  organizationId,
  busy,
  draft,
  dispatch,
  submitHandoff,
}: {
  participant: HandoffParticipant;
  organizationId: Id<"organizations">;
  busy: boolean;
  draft: HandoffDraft;
  dispatch: (action: HandoffDraftAction) => void;
  submitHandoff: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useScopedI18n("exhibitions.handoffs");
  const evidenceT = useScopedI18n("conditionAssessments");
  const installObject = useMutation(api.exhibitions.installObject);
  const deinstallObject = useMutation(api.exhibitions.deinstallObject);
  const returnObject = useMutation(
    api.exhibitions.returnObjectToOriginalLocation,
  );
  const authorizeException = useMutation(
    api.exhibitions.authorizeReturnException,
  );
  const {
    observedFrom,
    installationDestination,
    assessmentId,
    exceptionReason,
  } = draft;
  const returnDestination =
    draft.returnDestination ?? participant.originalLocationId ?? "";

  return (
    <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
      {participant.status !== "returned" ? (
        <AcceptedConditionAssessmentSelector
          collectionId={participant.collectionId}
          value={assessmentId}
          onValueChange={(value) =>
            dispatch({ type: "set", field: "assessmentId", value })
          }
          disabled={busy}
        />
      ) : null}
      {participant.status === "deinstalled" ? (
        <div className="space-y-2">
          <Label>{evidenceT("returnDestination")}</Label>
          <LocationSelector
            organizationId={organizationId}
            value={returnDestination}
            onValueChange={(value) =>
              dispatch({ type: "set", field: "returnDestination", value })
            }
          />
        </div>
      ) : null}
      {participant.status === "pending" ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t("installationDestination")}
          </Label>
          <LocationSelector
            organizationId={organizationId}
            value={installationDestination}
            onValueChange={(value) =>
              dispatch({
                type: "set",
                field: "installationDestination",
                value,
              })
            }
            allowNone={false}
          />
        </div>
      ) : null}
      {(participant.status === "pending" ||
        participant.status === "deinstalled") && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t("observedFrom")}
          </Label>
          <LocationSelector
            organizationId={organizationId}
            value={observedFrom}
            onValueChange={(value) =>
              dispatch({ type: "set", field: "observedFrom", value })
            }
          />
        </div>
      )}

      {participant.status === "pending" ? (
        <Button
          size="sm"
          disabled={busy || !assessmentId || !installationDestination}
          onClick={() =>
            submitHandoff(() =>
              installObject({
                exhibitionObjectId: participant.exhibitionObjectId,
                installationConditionAssessmentId:
                  assessmentId as Id<"conditionAssessments">,
                exhibitionLocationId:
                  installationDestination as Id<"locations">,
                observedFromLocationId: toObservedLocationId(observedFrom),
              }),
            )
          }
        >
          {busy ? <RefreshCw className="mr-2 size-3 animate-spin" /> : null}
          {t("install")}
        </Button>
      ) : null}

      {participant.status === "installed" ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !assessmentId}
          onClick={() =>
            submitHandoff(() =>
              deinstallObject({
                deinstallationConditionAssessmentId:
                  assessmentId as Id<"conditionAssessments">,
                exhibitionObjectId: participant.exhibitionObjectId,
              }),
            )
          }
        >
          {t("deinstall")}
        </Button>
      ) : null}

      {participant.status === "deinstalled" &&
      !participant.hasReturnException ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={
              busy ||
              !assessmentId ||
              !returnDestination ||
              returnDestination === "__none__"
            }
            onClick={() =>
              submitHandoff(() =>
                returnObject({
                  returnConditionAssessmentId:
                    assessmentId as Id<"conditionAssessments">,
                  overrideLocationId:
                    returnDestination && returnDestination !== "__none__"
                      ? (returnDestination as Id<"locations">)
                      : undefined,
                  exhibitionObjectId: participant.exhibitionObjectId,
                  observedFromLocationId: toObservedLocationId(observedFrom),
                }),
              )
            }
          >
            {t("confirmReturn")}
          </Button>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("exceptionReason")}
              </Label>
              <Input
                value={exceptionReason}
                onChange={(event) =>
                  dispatch({
                    type: "set",
                    field: "exceptionReason",
                    value: event.target.value,
                  })
                }
                placeholder={t("exceptionPlaceholder")}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || exceptionReason.trim().length < 10}
              onClick={() =>
                submitHandoff(() =>
                  authorizeException({
                    exhibitionObjectId: participant.exhibitionObjectId,
                    reason: exceptionReason.trim(),
                  }),
                )
              }
            >
              {t("authorizeException")}
            </Button>
          </div>
        </div>
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
            className="space-y-1"
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
