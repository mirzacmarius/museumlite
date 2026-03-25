"use client";

import { ChevronRight, Droplets, Thermometer } from "lucide-react";

interface LocationHeaderProps {
  location: {
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
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
    <div className="flex items-end justify-between mb-8">
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
          <span>Locations</span>
          <ChevronRight className="w-3 h-3" />
          <span>{getBreadcrumbCategory()}</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-3">
          <span>{location.name}</span>
          <span
            className={`text-xs font-normal px-2 py-0.5 rounded-full border ${statusBadge.className}`}
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

      <div className="flex gap-4">
        <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center gap-3">
          <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
            <Thermometer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
              Temperature
            </div>
            <div className="text-sm font-semibold text-zinc-200">
              {environmentalData?.temperature !== undefined
                ? `${environmentalData.temperature.toFixed(1)}°C`
                : "N/A"}
            </div>
          </div>
        </div>

        <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center gap-3">
          <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
              Humidity
            </div>
            <div className="text-sm font-semibold text-zinc-200">
              {environmentalData?.humidity !== undefined
                ? `${environmentalData.humidity.toFixed(0)}% RH`
                : "N/A"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
