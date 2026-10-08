"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import { Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { ClientDate } from "@/components/client-date";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ExhibitionScheduleConflictsAlert } from "../../_components/exhibition-schedule-conflicts-alert";

interface ExhibitionPhysicalHandoffsPanelProps {
  exhibitionId: string;
  organizationId: Id<"organizations">;
  startDate: number;
  endDate?: number;
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
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions.handoffs");
  const evidenceT = useScopedI18n("conditionAssessments");
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

  const installObject = useMutation(api.exhibitions.installObject);
  const deinstallObject = useMutation(api.exhibitions.deinstallObject);
  const returnObject = useMutation(
    api.exhibitions.returnObjectToOriginalLocation,
  );
  const authorizeException = useMutation(
    api.exhibitions.authorizeReturnException,
  );

  const [observedFromByObject, setObservedFromByObject] = useState<
    Record<string, string>
  >({});
  const [exceptionReasonByObject, setExceptionReasonByObject] = useState<
    Record<string, string>
  >({});
  const [assessmentByObject, setAssessmentByObject] = useState<
    Record<string, string>
  >({});
  const [returnDestinationByObject, setReturnDestinationByObject] = useState<
    Record<string, string>
  >({});
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
      setAssessmentByObject((previous) => ({
        ...previous,
        [exhibitionObjectId]: "",
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("actionFailed"));
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
        {summary.participants.map((participant) => {
          const objectKey = participant.exhibitionObjectId;
          const observedFrom = observedFromByObject[objectKey] ?? "__none__";
          const assessmentId = assessmentByObject[objectKey] ?? "";
          const returnDestination =
            returnDestinationByObject[objectKey] ??
            participant.originalLocationId ??
            "";
          const exceptionReason = exceptionReasonByObject[objectKey] ?? "";
          const label =
            participant.collectionAccessionNumber ??
            participant.collectionTitle ??
            participant.collectionId;
          const busy = busyObjectId === objectKey;

          return (
            <li
              key={objectKey}
              className="rounded-lg border border-border/60 bg-background/40 p-4"
            >
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
                <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                  {participant.status !== "returned" ? (
                    <AcceptedConditionAssessmentSelector
                      collectionId={participant.collectionId}
                      value={assessmentId}
                      onValueChange={(value) =>
                        setAssessmentByObject((previous) => ({
                          ...previous,
                          [objectKey]: value,
                        }))
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
                          setReturnDestinationByObject((previous) => ({
                            ...previous,
                            [objectKey]: value,
                          }))
                        }
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
                          setObservedFromByObject((prev) => ({
                            ...prev,
                            [objectKey]: value,
                          }))
                        }
                      />
                    </div>
                  )}

                  {participant.status === "pending" ? (
                    <Button
                      size="sm"
                      disabled={busy || !assessmentId}
                      onClick={() =>
                        runHandoff(participant.exhibitionObjectId, () =>
                          installObject({
                            exhibitionObjectId: participant.exhibitionObjectId,
                            installationConditionAssessmentId:
                              assessmentId as Id<"conditionAssessments">,
                            observedFromLocationId:
                              toObservedLocationId(observedFrom),
                          }),
                        )
                      }
                    >
                      {busy ? (
                        <RefreshCw className="mr-2 size-3 animate-spin" />
                      ) : null}
                      {t("install")}
                    </Button>
                  ) : null}

                  {participant.status === "installed" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || !assessmentId}
                      onClick={() =>
                        runHandoff(participant.exhibitionObjectId, () =>
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
                          runHandoff(participant.exhibitionObjectId, () =>
                            returnObject({
                              returnConditionAssessmentId:
                                assessmentId as Id<"conditionAssessments">,
                              overrideLocationId:
                                returnDestination &&
                                returnDestination !== "__none__"
                                  ? (returnDestination as Id<"locations">)
                                  : undefined,
                              exhibitionObjectId:
                                participant.exhibitionObjectId,
                              observedFromLocationId:
                                toObservedLocationId(observedFrom),
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
                              setExceptionReasonByObject((prev) => ({
                                ...prev,
                                [objectKey]: event.target.value,
                              }))
                            }
                            placeholder={t("exceptionPlaceholder")}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || exceptionReason.trim().length < 10}
                          onClick={() =>
                            runHandoff(participant.exhibitionObjectId, () =>
                              authorizeException({
                                exhibitionObjectId:
                                  participant.exhibitionObjectId,
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
              ) : null}
            </li>
          );
        })}
      </ul>
      {summary.timeline.length > 0 ? (
        <section className="mt-6 space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">
            {evidenceT("handoffTimeline")}
          </h3>
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
                    summary.participants.find(
                      (participant) =>
                        participant.exhibitionObjectId ===
                        event.exhibitionObjectId,
                    )?.collectionAccessionNumber
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
      ) : null}
    </div>
  );
}
