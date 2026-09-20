"use client";

import { Droplets, ImageIcon, Thermometer } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

const LAST_AUDIT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

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
  lastAuditDate?: Date;
}

export function LocationHeader({
  actions,
  location,
  environmentalData,
  totalObjects,
  capacity,
  directObjectCount,
  lastAuditDate,
}: LocationHeaderProps) {
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
  const occupancyPercent =
    capacity > 0 ? Math.round((directObjectCount / capacity) * 100) : 0;

  const getStatusBadge = () => {
    if (!location.isActive) {
      return {
        text: "Inactive",
        className: "text-muted-foreground bg-muted border-muted-foreground/20",
      };
    }

    const type = location.type.toLowerCase();
    if (type.includes("gallery") || type.includes("exhibition")) {
      return {
        text: "Open to Public",
        className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      };
    }

    if (type.includes("storage") || type.includes("vault")) {
      return {
        text: "Restricted Access",
        className: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      };
    }

    return {
      text: "Active",
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
              <ImageIcon className="size-5" />
              <span className="text-[10px]">No location photo</span>
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
              {location.type.replaceAll("_", " ")}
            </span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
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
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Total objects
              </dt>
              <dd className="mt-1.5 text-lg font-medium tabular-nums text-foreground">
                {totalObjects.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt
                className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
                title="Capacity of objects assigned directly to this location"
              >
                Capacity
              </dt>
              <dd className="mt-1.5 flex flex-wrap items-center gap-3">
                <span className="text-sm tabular-nums text-foreground">
                  {capacity > 0
                    ? `${occupancyPercent}% full`
                    : "Not configured"}
                </span>
                {capacity > 0 ? (
                  <span className="h-1 w-20 overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                    />
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Last audit
              </dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">
                {lastAuditDate
                  ? LAST_AUDIT_DATE_FORMATTER.format(lastAuditDate)
                  : "No audit recorded"}
              </dd>
            </div>
              {actions ? (
                <div className="sm:justify-self-end">
                  <dt className="sr-only">Actions</dt>
                  <dd className="mt-1.5 flex min-h-[1.75rem] items-end justify-end">
                    {actions}
                  </dd>
                </div>
              ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}
