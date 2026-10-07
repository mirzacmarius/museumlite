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
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
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
  const { hasPermission } = usePermissions();
  const canUpdateTransit = hasPermission("loans.update");
  const canInstall = hasPermission("collections.update");

  const summary = useQuery(api.transit.getTransitHandoffSummary, {
    transitRecordId,
  });

  const markArrived = useMutation(api.transit.markTransitItemCarrierArrived);
  const recordReceipt = useMutation(api.transit.recordTransitItemReceipt);
  const recordInstallation = useMutation(api.transit.recordTransitItemInstallation);

  const [observedFromByItem, setObservedFromByItem] = useState<
    Record<string, string>
  >({});
  const [destinationByItem, setDestinationByItem] = useState<
    Record<string, string>
  >({});
  const [conditionByItem, setConditionByItem] = useState<Record<string, string>>(
    {},
  );
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
    action: () => Promise<void>,
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
          const observedFrom =
            observedFromByItem[itemKey] ??
            (item.status === "received" || item.status === "arrived"
              ? "__none__"
              : "__none__");
          const destination =
            destinationByItem[itemKey] ??
            defaultDestinationLocationId ??
            "";
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

              {canUpdateTransit ? (
                <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                  {item.status !== "arrived" &&
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

                  {(item.status === "arrived" ||
                    item.status === "in_transit" ||
                    item.status === "delivered") &&
                  item.status !== "received" ? (
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
                      <Button
                        size="sm"
                        disabled={busy || !destination}
                        onClick={() =>
                          runAction(item.transitItemId, () =>
                            recordReceipt({
                              transitItemId: item.transitItemId,
                              observedFromLocationId:
                                toObservedLocationId(observedFrom),
                              destinationLocationId:
                                destination as Id<"locations">,
                              conditionIn: condition || undefined,
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
                    <Button
                      size="sm"
                      className="mt-2"
                      disabled={busy}
                      onClick={() =>
                        runAction(item.transitItemId, () =>
                          recordInstallation({
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
