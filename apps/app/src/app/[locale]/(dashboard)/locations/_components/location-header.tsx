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
        className: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
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
      <div className="relative order-2 aspect-square w-44 max-w-full overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/70 shadow-[0_24px_80px_rgba(0,0,0,0.35)] xl:order-1">
        {location.imageUrl ? (
          <>
            <img
              src={location.imageUrl}
              alt={location.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(10,10,10,1))]">
            <div className="flex flex-col items-center gap-3 text-zinc-500">
              <div className="rounded-full border border-zinc-700 bg-zinc-900/80 p-3">
                <ImageIcon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">No location photo</span>
            </div>
          </div>
        )}

        <div className="absolute right-3 top-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-md">
            <Thermometer className="h-4 w-4 text-blue-300" />
            <span className="text-sm font-semibold text-white">
              {displayTemperature !== undefined
                ? `${displayTemperature.toFixed(1)}°C`
                : "N/A"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-md">
            <Droplets className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-semibold text-white">
              {displayHumidity !== undefined
                ? `${displayHumidity.toFixed(0)}%`
                : "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="order-1 min-w-0 xl:order-2">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-zinc-100">
          <span>{location.name}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-normal ${statusBadge.className}`}
          >
            {statusBadge.text}
          </span>
        </h2>
        <div className="mt-2 text-sm text-zinc-400">
          <span className="text-zinc-500">Location ID</span>
          <span className="mx-2 text-zinc-700">•</span>
          <span className="font-medium text-zinc-200">
            {location.locationCode}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-zinc-500">
              Capacity
            </div>
            <div className="text-xl font-semibold text-zinc-200">
              {occupancyPercent}% Full
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-zinc-500">
              Total Items
            </div>
            <div className="text-xl font-semibold text-zinc-200">
              {totalObjects.toLocaleString()} Objects
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-zinc-500">
              Last Audit
            </div>
            <div className="text-xl font-semibold text-zinc-200">
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
