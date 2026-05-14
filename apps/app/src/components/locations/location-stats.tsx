"use client";

import { Droplets, Thermometer } from "lucide-react";

interface LocationStatsProps {
  temperature: number | null | undefined;
  humidity: number | null | undefined;
  status?: string;
}

export function LocationStats({
  temperature,
  humidity,
  status = "Active",
}: LocationStatsProps) {
  const statusColors = {
    Active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Restricted: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    Warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Critical: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  const colorClass =
    statusColors[status as keyof typeof statusColors] || statusColors.Active;

  return (
    <>
      <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center gap-3">
        <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
          <Thermometer className="size-4" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold">
            Temp
          </div>
          <div className="text-sm font-mono text-zinc-200">
            {temperature != null ? `${temperature.toFixed(1)}°C` : "N/A"}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center gap-3">
        <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400">
          <Droplets className="size-4" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold">
            Humidity
          </div>
          <div className="text-sm font-mono text-zinc-200">
            {humidity != null ? `${humidity}% RH` : "N/A"}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border rounded-lg flex items-center gap-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}
        >
          {status}
        </span>
      </div>
    </>
  );
}
