"use client";

import { cn } from "@v1/ui/utils";
import {
  Calendar,
  DollarSign,
  Droplets,
  GlassWater,
  Grape,
  MapPin,
  Wine,
} from "lucide-react";
import { RecordedValue } from "@/components/recorded-value";
import { useI18n, useScopedI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"wine">;

interface WineDetailsContentProps {
  details: DetailsDoc;
  isInPeakWindow: boolean;
  isPastPeak: boolean;
}

export function WineDetailsContent({
  details,
  isInPeakWindow,
  isPastPeak,
}: WineDetailsContentProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("modules.wine");
  const common = useScopedI18n("modules.common");
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Grape className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("vintage")}
            </span>
          </div>
          <span className="text-3xl font-light text-foreground">
            {details.vintage || t("nv")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wine className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("producer")}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.producer || common("unknown")}
          </span>
          {details.region && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.region}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("cellarLocation")}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            {details.binNumber && (
              <span className="rounded bg-secondary px-2 py-0.5 font-mono text-sm text-foreground">
                {t("bin")} {details.binNumber}
              </span>
            )}
            {details.rackNumber && (
              <span className="text-xs text-muted-foreground">
                {t("rack")} {details.rackNumber}
              </span>
            )}
            {details.rowNumber && (
              <span className="text-xs text-muted-foreground">
                {t("row")} {details.rowNumber}
              </span>
            )}
            {!details.binNumber && !details.rackNumber && (
              <span className="text-sm text-muted-foreground">
                {common("notSpecified")}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <GlassWater className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("quantity")}
            </span>
          </div>
          <span className="text-2xl font-light text-foreground">
            {details.quantity || 1}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">
            {details.bottleSize || t("bottleSize")}
          </span>
        </div>
      </div>

      {(details.peakWindowStart || details.peakWindowEnd) && (
        <div
          className={cn(
            "rounded-lg border p-4",
            isInPeakWindow
              ? "border-emerald-500/30 bg-emerald-500/5"
              : isPastPeak
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border/60 bg-secondary/20",
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar
              className={cn(
                "size-4",
                isInPeakWindow
                  ? "text-emerald-700 dark:text-emerald-400"
                  : isPastPeak
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                isInPeakWindow
                  ? "text-emerald-700 dark:text-emerald-400"
                  : isPastPeak
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-foreground",
              )}
            >
              {t("peakDrinkingWindow")}: {details.peakWindowStart} –{" "}
              {details.peakWindowEnd}
            </span>
            {isInPeakWindow && (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                {t("drinkNow")}
              </span>
            )}
            {isPastPeak && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                {t("pastPeak")}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DetailSection title={t("bottleCondition")} icon={Droplets}>
          <DetailGrid>
            <DetailField label={t("fillLevel")}>
              <div
                className={cn(
                  "text-sm font-medium",
                  details.fillLevel === "into_neck" ||
                    details.fillLevel === "top_shoulder"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : details.fillLevel === "below_shoulder"
                      ? "text-rose-700 dark:text-rose-400"
                      : "text-foreground",
                )}
              >
                {details.fillLevel === "into_neck"
                  ? tRoot("untranslatedRecords.objects.enums.fillIntoNeck")
                  : details.fillLevel === "top_shoulder"
                    ? tRoot("untranslatedRecords.objects.enums.fillTopShoulder")
                    : details.fillLevel === "high_shoulder"
                      ? tRoot(
                          "untranslatedRecords.objects.enums.fillHighShoulder",
                        )
                      : details.fillLevel === "mid_shoulder"
                        ? tRoot(
                            "untranslatedRecords.objects.enums.fillMidShoulder",
                          )
                        : details.fillLevel === "low_shoulder"
                          ? tRoot(
                              "untranslatedRecords.objects.enums.fillLowShoulder",
                            )
                          : details.fillLevel === "below_shoulder"
                            ? tRoot(
                                "untranslatedRecords.objects.enums.fillBelowShoulder",
                              )
                            : (details.fillLevel ?? common("notChecked"))}
              </div>
            </DetailField>
            <DetailField label={t("closure")}>
              <div className="text-sm text-foreground">
                {details.closureType || common("unknown")}
              </div>
            </DetailField>
            <DetailField label={t("label")}>
              <div className="text-sm text-foreground">
                {details.labelCondition || common("notAssessed")}
              </div>
            </DetailField>
            <DetailField label={t("capsule")}>
              <div className="text-sm text-foreground">
                {details.capsuleCondition || common("notAssessed")}
              </div>
            </DetailField>
          </DetailGrid>
        </DetailSection>

        <WineValuationSection details={details} />
      </div>

      <DetailSection title={t("wineDetails")} icon={Wine}>
        <DetailGrid className="md:grid-cols-4">
          <DetailField label={t("appellation")} value={details.appellation} />
          <DetailField label={t("varietal")} value={details.varietal} />
          <DetailField label={t("alcohol")}>
            <div className="text-sm text-foreground">
              {details.alcoholContent ? `${details.alcoholContent}%` : "—"}
            </div>
          </DetailField>
          <DetailField label={t("region")} value={details.region} />
        </DetailGrid>
      </DetailSection>

      {details.drinkingNotes && (
        <DetailSection title={t("tastingNotes")}>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {details.drinkingNotes}
          </p>
        </DetailSection>
      )}
    </div>
  );
}

function WineValuationSection({ details }: { details: DetailsDoc }) {
  const t = useScopedI18n("modules.wine");

  return (
    <DetailSection title={t("valuation")} icon={DollarSign}>
      <DetailGrid>
        <DetailField label={t("purchasePrice")}>
          <RecordedValue
            value={details.purchasePrice}
            className="text-lg font-light text-foreground"
          />
        </DetailField>
        <DetailField label={t("currentValue")}>
          <RecordedValue
            value={details.currentValue}
            className="text-lg font-light text-emerald-700 dark:text-emerald-400"
          />
        </DetailField>
      </DetailGrid>
    </DetailSection>
  );
}
