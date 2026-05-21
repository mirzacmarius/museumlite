"use client";

import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { api } from "@v1/backend/convex/_generated/api";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  Calendar,
  DollarSign,
  Droplets,
  GlassWater,
  Grape,
  MapPin,
  Wine,
} from "lucide-react";

type DetailsDoc = NonNullable<FunctionReturnType<typeof api.wineDetails.get>>;

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
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.wine");
  const common = useScopedI18n("modules.common");
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Grape className="size-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("vintage")}
            </span>
          </div>
          <span className="text-3xl font-light text-foreground">
            {details.vintage || t("nv")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wine className="size-4 text-rose-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
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

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="size-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
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

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <GlassWater className="size-4 text-cyan-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
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
                  ? "text-emerald-500"
                  : isPastPeak
                    ? "text-amber-500"
                    : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                isInPeakWindow
                  ? "text-emerald-500"
                  : isPastPeak
                    ? "text-amber-500"
                    : "text-foreground",
              )}
            >
              {t("peakDrinkingWindow")}: {details.peakWindowStart} –{" "}
              {details.peakWindowEnd}
            </span>
            {isInPeakWindow && (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-500">
                {t("drinkNow")}
              </span>
            )}
            {isPastPeak && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500">
                {t("pastPeak")}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <Droplets className="size-4 text-blue-500" />
            {t("bottleCondition")}
          </h3>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("fillLevel")}
                </span>
                <p
                  className={cn(
                    "mt-1 text-sm font-medium",
                    details.fillLevel === "into_neck" ||
                      details.fillLevel === "top_shoulder"
                      ? "text-emerald-500"
                      : details.fillLevel === "below_shoulder"
                        ? "text-rose-500"
                        : "text-foreground",
                  )}
                >
                  {details.fillLevel?.replace(/_/g, " ") ||
                    common("notChecked")}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("closure")}
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {details.closureType || common("unknown")}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("label")}
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {details.labelCondition || common("notAssessed")}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("capsule")}
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {details.capsuleCondition || common("notAssessed")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <DollarSign className="size-4 text-emerald-500" />
            {t("valuation")}
          </h3>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("purchasePrice")}
                </span>
                <p className="mt-1 text-lg font-light text-foreground">
                  {details.purchasePrice
                    ? formatCurrency(details.purchasePrice, locale, "USD")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("currentValue")}
                </span>
                <p className="mt-1 text-lg font-light text-emerald-500">
                  {details.currentValue
                    ? formatCurrency(details.currentValue, locale, "USD")
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Wine className="size-4 text-rose-500" />
          {t("wineDetails")}
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("appellation")}
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.appellation || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("varietal")}
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.varietal || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("alcohol")}
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.alcoholContent ? `${details.alcoholContent}%` : "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("region")}
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.region || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {details.drinkingNotes && (
        <div>
          <h3 className="mb-4 text-xs font-medium text-foreground">
            {t("tastingNotes")}
          </h3>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {details.drinkingNotes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
