"use client";

import {
  ChevronRight,
  Droplets,
  Image as ImageIcon,
  Thermometer,
} from "lucide-react";

interface LocationHeaderProps {
  location: {
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
    imageUrl?: string;
  };
  environmentalData: {
    temperature?: number;
    humidity?: number;
    recordedAt: number;
  } | null;
}

export function LocationHeader({
  location,
  environmentalData,
}: LocationHeaderProps) {
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

  const getBreadcrumbCategory = () => {
    const type = location.type.toLowerCase();
    if (
      type.includes("gallery") ||
      type.includes("exhibition") ||
      type.includes("wing") ||
      type.includes("hall")
    ) {
      return "Exhibition Spaces";
    }
    if (
      type.includes("storage") ||
      type.includes("vault") ||
      type.includes("archive")
    ) {
      return "Secure Storage";
    }
    return "Locations";
  };

  return (
    <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
          <span>Locations</span>
          <ChevronRight className="h-3 w-3" />
          <span>{getBreadcrumbCategory()}</span>
        </div>
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-zinc-100">
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
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/70 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        {location.imageUrl ? (
          <>
            <img
              src={location.imageUrl}
              alt={location.name}
              className="h-52 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
          </>
        ) : (
          <div className="flex h-52 w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(10,10,10,1))]">
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
              {environmentalData?.temperature !== undefined
                ? `${environmentalData.temperature.toFixed(1)}°C`
                : "N/A"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-md">
            <Droplets className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-semibold text-white">
              {environmentalData?.humidity !== undefined
                ? `${environmentalData.humidity.toFixed(0)}%`
                : "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
