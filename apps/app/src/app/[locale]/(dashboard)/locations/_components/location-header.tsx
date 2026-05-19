"use client";

import { Droplets, Image as ImageIcon, Thermometer } from "lucide-react";

interface LocationHeaderProps {
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
  lastAuditDate?: Date;
}

export function LocationHeader({
  location,
  environmentalData,
  totalObjects,
  capacity,
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
    capacity > 0 ? Math.round((totalObjects / capacity) * 100) : 0;

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
    <div className="mb-8 grid gap-6 xl:grid-cols-[176px_minmax(0,1fr)] xl:items-start">
      <div className="relative order-2 aspect-square w-44 max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:order-1">
        {location.imageUrl ? (
          <>
            <img
              src={location.imageUrl}
              alt={location.name}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
          </>
        ) : (
          <div className="flex size-full items-center justify-center bg-muted/40">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="rounded-full border border-border bg-background/80 p-3">
                <ImageIcon className="size-6" />
              </div>
              <span className="text-sm font-medium">No location photo</span>
            </div>
          </div>
        )}

        {displayTemperature !== undefined || displayHumidity !== undefined ? (
          <div className="absolute right-2 top-2 flex flex-wrap items-center gap-1.5">
            {displayTemperature !== undefined ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2 py-1 backdrop-blur-md">
                <Thermometer className="size-3 text-blue-300" />
                <span className="text-xs font-semibold text-foreground">
                  {displayTemperature.toFixed(1)}°C
                </span>
              </div>
            ) : null}

            {displayHumidity !== undefined ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2 py-1 backdrop-blur-md">
                <Droplets className="size-3 text-cyan-300" />
                <span className="text-xs font-semibold text-foreground">
                  {displayHumidity.toFixed(0)}%
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="order-1 min-w-0 xl:order-2">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-foreground">
          <span>{location.name}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-normal ${statusBadge.className}`}
          >
            {statusBadge.text}
          </span>
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">
          <span className="text-muted-foreground">Location ID</span>
          <span className="mx-2 text-muted-foreground/60">•</span>
          <span className="font-medium text-foreground">
            {location.locationCode}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
              Capacity
            </div>
            <div className="text-xl font-semibold text-foreground">
              {occupancyPercent}% Full
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
              Total Items
            </div>
            <div className="text-xl font-semibold text-foreground">
              {totalObjects.toLocaleString()} Objects
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
              Last Audit
            </div>
            <div className="text-xl font-semibold text-foreground">
              {lastAuditDate
                ? new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(lastAuditDate)
                : "Never"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
