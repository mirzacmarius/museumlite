"use client";

import { Package, Users } from "lucide-react";

interface OccupancyDisplayProps {
  objectCount: number;
  capacity?: number;
  occupancyPercent?: number;
  isOverCapacity: boolean;
}

export function OccupancyDisplay({
  objectCount,
  capacity,
  occupancyPercent,
  isOverCapacity,
}: OccupancyDisplayProps) {
  const getStatusColor = () => {
    if (!capacity) return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    if (isOverCapacity)
      return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (occupancyPercent && occupancyPercent >= 90)
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    if (occupancyPercent && occupancyPercent >= 75)
      return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  };

  const getStatusText = () => {
    if (!capacity) return "No limit";
    if (isOverCapacity) return "Over capacity";
    if (occupancyPercent && occupancyPercent >= 90) return "Near capacity";
    if (occupancyPercent && occupancyPercent >= 75) return "Filling up";
    return "Available";
  };

  return (
<>
      <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center gap-3">
        <div className="p-1.5 rounded bg-violet-500/10 text-violet-400">
          <Package className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold">
            Objects
          </div>
          <div className="text-sm font-mono text-zinc-200">
            {objectCount}
            {capacity ? ` / ${capacity}` : ""}
          </div>
        </div>
      </div>
      {capacity && (
        <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center gap-3">
          <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-bold">
              Occupancy
            </div>
            <div className="text-sm font-mono text-zinc-200">
              {occupancyPercent ?? 0}%
            </div>
          </div>
        </div>
      )}
      <div className="px-3 py-2 border rounded-lg flex items-center gap-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor()}`}
        >
          {getStatusText()}
        </span>
      </div>
    </>
  );
}
