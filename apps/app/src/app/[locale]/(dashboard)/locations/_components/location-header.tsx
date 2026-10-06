"use client";

import { cn } from "@v1/ui/utils";
import { Droplets, Thermometer } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { occupancyBar } from "./location-occupancy";
import { LocationTypeIcon } from "./location-type-icon";

interface LocationHeaderProps {
  actions?: ReactNode;
  location: {
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
    imageUrl?: string;
    customFields?: Record<
      string,
      string | number | boolean | string[] | null | undefined
    >;
  };
  environmentalData: {
    temperature?: number;
    humidity?: number;
    recordedAt: number;
  } | null;
  totalObjects: number;
  capacity: number;
  directObjectCount: number;
}

export function LocationHeader({
  actions,
  location,
  environmentalData,
  totalObjects,
  capacity,
  directObjectCount,
}: LocationHeaderProps) {
  const t = useScopedI18n("locations.header");
  const locale = useCurrentLocale();
  const tCommon = useScopedI18n("common");
  const tLocations = useScopedI18n("locations");
  const formatLocationType = (type: string) =>
    [
      "building",
      "room",
      "gallery",
      "storage",
      "cabinet",
      "shelf",
      "vault",
      "other",
    ].includes(type)
      ? tLocations(`form.locationTypes.${type}`)
      : type;
  const bar = occupancyBar(directObjectCount, capacity);
  const capacityRatio = `${formatNumber(directObjectCount, locale)} / ${formatNumber(capacity, locale)}`;
  const capacityLabel =
    bar.kind === "unconfigured"
      ? t("notConfigured")
      : bar.kind === "over"
        ? `${capacityRatio} · ${t("overCapacity")}`
        : capacityRatio;
  const storedTemperature =
    typeof location.customFields?.temperature === "number"
      ? location.customFields.temperature
      : undefined;
  const storedHumidity =
    typeof location.customFields?.humidity === "number"
      ? location.customFields.humidity
      : undefined;
  const displayTemperature =
    environmentalData?.temperature ?? storedTemperature;
  const displayHumidity = environmentalData?.humidity ?? storedHumidity;
  const getStatusBadge = () => {
    if (!location.isActive) {
      return {
        text: tCommon("inactive"),
        className: "text-muted-foreground bg-muted border-muted-foreground/20",
      };
    }

    const type = location.type.toLowerCase();
    if (type.includes("gallery") || type.includes("exhibition")) {
      return {
        text: t("openToPublic"),
        className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      };
    }

    if (type.includes("storage") || type.includes("vault")) {
      return {
        text: t("restrictedAccess"),
        className: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      };
    }

    return {
      text: tCommon("active"),
      className: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <section className="mb-7 border-b border-border/60 pb-6 dark:border-white/10">
      <div className="flex min-w-0 items-start gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted/30 outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10 sm:size-28">
          {location.imageUrl ? (
            <Image
              src={location.imageUrl}
              alt={location.name}
              fill
              sizes="(min-width: 640px) 112px, 96px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 px-2 text-center text-muted-foreground">
              <LocationTypeIcon type={location.type} className="size-8" />
              <span className="text-[10px] capitalize">
                {formatLocationType(location.type)}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span className="font-mono tracking-wide text-muted-foreground">
              {location.locationCode}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="capitalize text-muted-foreground">
              {formatLocationType(location.type)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex flex-wrap items-center gap-3 text-xl font-medium tracking-tight text-foreground">
              {location.name}
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-normal tracking-normal ${statusBadge.className}`}
              >
                <span className="size-1 rounded-full bg-current" />
                {statusBadge.text}
              </span>
            </h2>
            {displayTemperature !== undefined ||
            displayHumidity !== undefined ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {displayTemperature !== undefined ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 dark:border-white/10">
                    <Thermometer className="size-3.5 text-blue-400" />
                    <span className="tabular-nums">
                      {displayTemperature.toFixed(1)}°C
                    </span>
                  </span>
                ) : null}
                {displayHumidity !== undefined ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 dark:border-white/10">
                    <Droplets className="size-3.5 text-cyan-400" />
                    <span className="tabular-nums">
                      {displayHumidity.toFixed(0)}%
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
            {actions}
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-flow-col sm:auto-cols-fr">
            <div className="min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("totalObjects")}
              </dt>
              <dd className="mt-1.5 text-lg font-medium tabular-nums text-foreground">
                {formatNumber(totalObjects, locale)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt
                className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
                title={t("capacityHint")}
              >
                {t("capacity")}
              </dt>
              <dd className="mt-1.5 flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "text-sm tabular-nums text-foreground",
                    bar.kind === "over" && "text-amber-400",
                  )}
                >
                  {capacityLabel}
                </span>
                {bar.kind === "unconfigured" ? null : (
                  <span className="h-1 w-20 overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        bar.kind === "over" ? "bg-amber-500" : "bg-emerald-500",
                      )}
                      style={{ width: `${bar.barWidthPercent}%` }}
                    />
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
