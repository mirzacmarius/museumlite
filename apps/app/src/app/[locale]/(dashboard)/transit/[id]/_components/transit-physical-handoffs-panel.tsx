"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import { PackageCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface TransitPhysicalHandoffsPanelProps {
  transitRecordId: Id<"transitRecords">;
  organizationId: Id<"organizations">;
  defaultDestinationLocationId?: Id<"locations">;
  linkedExhibitionId?: Id<"exhibitions">;
}

function toObservedLocationId(value: string): Id<"locations"> | null {
  if (!value || value === "__none__") {
    return null;
  }
  return value as Id<"locations">;
}

export function TransitPhysicalHandoffsPanel({
  transitRecordId,
  organizationId,
  defaultDestinationLocationId,
  linkedExhibitionId,
}: TransitPhysicalHandoffsPanelProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("untranslatedDashboard.transit.handoffs");
  const evidenceT = useScopedI18n("conditionAssessments");
  const { hasFeature } = useFeatureAccess();
  const { hasPermission } = usePermissions();
  const canUpdateTransit = hasPermission("loans.update");
  const canInstall = hasPermission("collections.update");

  const summary = useQuery(api.transit.getTransitHandoffSummary, {
    transitRecordId,
  });

  const tasks = useQuery(
    api.installations.listTasks,
    linkedExhibitionId &&
      canInstall &&
      hasPermission("collections.read") &&
      hasFeature("installations")
      ? { organizationId, exhibitionId: linkedExhibitionId }
      : "skip",
  );
  const markArrived = useMutation(api.transit.markTransitItemCarrierArrived);
  const recordReceipt = useMutation(api.transit.recordTransitItemReceipt);
  const recordInstallation = useMutation(
    api.transit.recordTransitItemInstallation,
  );

  const [observedFromByItem, setObservedFromByItem] = useState<
    Record<string, string>
  >({});
  const [destinationByItem, setDestinationByItem] = useState<
    Record<string, string>
  >({});
  const [installationDestinationByItem, setInstallationDestinationByItem] =
    useState<Record<string, string>>({});
  const [conditionByItem, setConditionByItem] = useState<
    Record<string, string>
  >({});
  const [assessmentByItem, setAssessmentByItem] = useState<
    Record<string, string>
  >({});
  const [taskByItem, setTaskByItem] = useState<Record<string, string>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (summary === undefined) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (summary.itemCount === 0) {
    return null;
  }

  async function runAction(
    transitItemId: Id<"transitItems">,
    action: () => Promise<unknown>,
  ) {
    setError("");
    setBusyItemId(transitItemId);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("actionFailed"));
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <PackageCheck className="size-4" />
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("outstandingReceipt", { count: summary.outstandingReceiptCount })}
          {linkedExhibitionId
            ? ` · ${t("outstandingInstallation", {
                count: summary.outstandingInstallationCount,
              })}`
            : ""}
        </p>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-4">
        {summary.items.map((item) => {
          const itemKey = item.transitItemId;
          const observedFrom = observedFromByItem[itemKey] ?? "__none__";
          const destination =
            destinationByItem[itemKey] ?? defaultDestinationLocationId ?? "";
          const installationDestination =
            installationDestinationByItem[itemKey] ?? "";
          const assessmentId = assessmentByItem[itemKey] ?? "";
          const taskId = taskByItem[itemKey] ?? "";
          const condition = conditionByItem[itemKey] ?? "";
          const label = item.accessionNumber ?? item.title ?? item.collectionId;
          const busy = busyItemId === itemKey;

          return (
            <li
              key={itemKey}
              className="rounded-lg border border-border/60 bg-background/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`itemStatus.${item.status}`)}
                    {item.receiptMovementId ? ` · ${t("receiptRecorded")}` : ""}
                    {item.installationMovementId
                      ? ` · ${t("installationRecorded")}`
                      : ""}
                  </p>
                  <Link
                    href={`/${locale}/objects/${item.collectionId}`}
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    {t("viewObject")}
                  </Link>
                </div>
              </div>

              {canUpdateTransit || canInstall ? (
                <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                  {canUpdateTransit &&
                  item.status !== "arrived" &&
                  item.status !== "received" &&
                  item.status !== "missing" &&
                  item.status !== "damaged" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        runAction(item.transitItemId, () =>
                          markArrived({ transitItemId: item.transitItemId }),
                        )
                      }
                    >
                      {busy ? (
                        <RefreshCw className="mr-2 size-3 animate-spin" />
                      ) : null}
                      {t("markCarrierArrived")}
                    </Button>
                  ) : null}

                  {canUpdateTransit &&
                  (item.status === "arrived" ||
                    item.status === "in_transit" ||
                    item.status === "delivered") ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("observedFrom")}
                        </Label>
                        <LocationSelector
                          organizationId={organizationId}
                          value={observedFrom}
                          onValueChange={(value) =>
                            setObservedFromByItem((prev) => ({
                              ...prev,
                              [itemKey]: value,
                            }))
                          }
                          allowNone
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("receiptDestination")}
                        </Label>
                        <LocationSelector
                          organizationId={organizationId}
                          value={destination}
                          onValueChange={(value) =>
                            setDestinationByItem((prev) => ({
                              ...prev,
                              [itemKey]: value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("conditionNotes")}
                        </Label>
                        <Input
                          value={condition}
                          onChange={(event) =>
                            setConditionByItem((prev) => ({
                              ...prev,
                              [itemKey]: event.target.value,
                            }))
                          }
                          placeholder={t("conditionPlaceholder")}
                          className="text-xs"
                        />
                      </div>
                      {hasPermission("collections.read") ? (
                        <AcceptedConditionAssessmentSelector
                          collectionId={item.collectionId}
                          value={assessmentId}
                          onValueChange={(value) =>
                            setAssessmentByItem((previous) => ({
                              ...previous,
                              [itemKey]: value,
                            }))
                          }
                          disabled={busy}
                        />
                      ) : null}
                      <Button
                        size="sm"
                        disabled={
                          busy ||
                          !destination ||
                          (!condition.trim() && !assessmentId)
                        }
                        onClick={() =>
                          runAction(item.transitItemId, () =>
                            recordReceipt({
                              transitItemId: item.transitItemId,
                              observedFromLocationId:
                                toObservedLocationId(observedFrom),
                              destinationLocationId:
                                destination as Id<"locations">,
                              conditionIn: condition || undefined,
                              conditionAssessmentId: assessmentId
                                ? (assessmentId as Id<"conditionAssessments">)
                                : undefined,
                            }),
                          )
                        }
                      >
                        {busy ? (
                          <RefreshCw className="mr-2 size-3 animate-spin" />
                        ) : null}
                        {t("recordReceipt")}
                      </Button>
                    </div>
                  ) : null}

                  {linkedExhibitionId &&
                  canInstall &&
                  item.status === "received" &&
                  !item.installedAt ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          {t("installationDestination")}
                        </Label>
                        <LocationSelector
                          organizationId={organizationId}
                          value={installationDestination}
                          onValueChange={(value) =>
                            setInstallationDestinationByItem((previous) => ({
                              ...previous,
                              [itemKey]: value,
                            }))
                          }
                          allowNone={false}
                        />
                      </div>
                      <Label>{t("observedFrom")}</Label>
                      <LocationSelector
                        organizationId={organizationId}
                        value={observedFrom}
                        onValueChange={(value) =>
                          setObservedFromByItem((previous) => ({
                            ...previous,
                            [itemKey]: value,
                          }))
                        }
                        allowNone
                      />
                      <AcceptedConditionAssessmentSelector
                        collectionId={item.collectionId}
                        value={assessmentId}
                        onValueChange={(value) =>
                          setAssessmentByItem((previous) => ({
                            ...previous,
                            [itemKey]: value,
                          }))
                        }
                        disabled={busy}
                      />
                      {tasks ? (
                        <select
                          aria-label={evidenceT("installationTask")}
                          value={taskId}
                          onChange={(event) =>
                            setTaskByItem((previous) => ({
                              ...previous,
                              [itemKey]: event.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-border bg-background p-2 text-sm"
                          disabled={busy}
                        >
                          <option value="">
                            {evidenceT("installationTask")}
                          </option>
                          {tasks
                            .filter((task) => task.status !== "completed")
                            .map((task) => (
                              <option key={task._id} value={task._id}>
                                {task.title}
                              </option>
                            ))}
                        </select>
                      ) : null}
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={
                          busy ||
                          !assessmentId ||
                          !installationDestination ||
                          installationDestination === "__none__"
                        }
                        onClick={() =>
                          runAction(item.transitItemId, () =>
                            recordInstallation({
                              exhibitionLocationId:
                                installationDestination as Id<"locations">,
                              installationConditionAssessmentId:
                                assessmentId as Id<"conditionAssessments">,
                              installationTaskId: taskId
                                ? (taskId as Id<"installationTasks">)
                                : undefined,
                              transitItemId: item.transitItemId,
                              observedFromLocationId:
                                toObservedLocationId(observedFrom),
                            }),
                          )
                        }
                      >
                        {busy ? (
                          <RefreshCw className="mr-2 size-3 animate-spin" />
                        ) : null}
                        {t("recordInstallation")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
