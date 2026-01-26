"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Lock, Thermometer } from "lucide-react";

interface LocationSidebarNewProps {
  exhibitionLocations: Array<{
    _id: Id<"locations">;
    name: string;
    type: string;
    isActive: boolean;
  }>;
  storageLocations: Array<{
    _id: Id<"locations">;
    name: string;
    type: string;
    isActive: boolean;
  }>;
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
}

export function LocationSidebarNew({
  exhibitionLocations,
  storageLocations,
  selectedLocationId,
  onSelectLocation,
}: LocationSidebarNewProps) {
  return (
    <div className="w-60 border-r border-zinc-800/60 p-4 bg-zinc-950 overflow-y-auto custom-scrollbar">
      {exhibitionLocations.length > 0 && (
        <>
          <div className="text-[10px] font-bold text-zinc-500 mb-4 uppercase tracking-widest">
            Exhibition Spaces
          </div>
          <ul className="space-y-1 text-xs mb-6">
            {exhibitionLocations.map((location) => (
              <LocationNavItem
                key={location._id}
                location={location}
                isSelected={selectedLocationId === location._id}
                onSelect={() => onSelectLocation(location._id)}
                isSecure={false}
              />
            ))}
          </ul>
        </>
      )}

      {storageLocations.length > 0 && (
        <>
          <div className="text-[10px] font-bold text-zinc-500 mb-4 uppercase tracking-widest">
            Secure Storage
          </div>
          <ul className="space-y-1 text-xs">
            {storageLocations.map((location) => (
              <LocationNavItem
                key={location._id}
                location={location}
                isSelected={selectedLocationId === location._id}
                onSelect={() => onSelectLocation(location._id)}
                isSecure={true}
                isColdStorage={location.type.toLowerCase().includes("cold")}
              />
            ))}
          </ul>
        </>
      )}

      {exhibitionLocations.length === 0 && storageLocations.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-xs text-zinc-600">No locations yet</p>
        </div>
      )}
    </div>
  );
}

interface LocationNavItemProps {
  location: {
    _id: Id<"locations">;
    name: string;
    type: string;
    isActive: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
  isSecure: boolean;
  isColdStorage?: boolean;
}

function LocationNavItem({
  location,
  isSelected,
  onSelect,
  isSecure,
  isColdStorage,
}: LocationNavItemProps) {
  const getStatusColor = () => {
    if (!location.isActive) return "bg-zinc-700";
    if (isSecure) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const statusColor = getStatusColor();

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-r cursor-pointer transition-all ${
          isSelected
            ? "bg-zinc-900 border-l-2 border-indigo-500 text-zinc-100 font-medium shadow-sm"
            : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
        }`}
      >
        <span className="truncate">{location.name}</span>
        {isColdStorage ? (
          <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1 rounded border border-blue-500/20 flex items-center gap-0.5">
            <Thermometer className="w-2.5 h-2.5" />
            4°C
          </span>
        ) : isSecure ? (
          <Lock className="w-3 h-3 text-zinc-600 shrink-0" />
        ) : (
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`}
          />
        )}
      </button>
    </li>
  );
}
