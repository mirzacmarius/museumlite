"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Lock } from "lucide-react";

interface LocationItem {
  _id: Id<"locations">;
  name: string;
  type: string;
  isActive: boolean;
  isSecure?: boolean;
}

interface LocationSidebarProps {
  exhibitionLocations: LocationItem[];
  storageLocations: LocationItem[];
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
}

export function LocationSidebar({
  exhibitionLocations,
  storageLocations,
  selectedLocationId,
  onSelectLocation,
}: LocationSidebarProps) {
  return (
    <div className="w-60 border-r border-white/10 bg-zinc-950 p-4 overflow-y-auto custom-scrollbar">
      {exhibitionLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Exhibition Spaces
          </div>
          <ul className="mb-6 space-y-1 text-xs">
            {exhibitionLocations.map((location) => (
              <LocationNavItem
                key={location._id}
                location={location}
                isSelected={selectedLocationId === location._id}
                onSelect={() => onSelectLocation(location._id)}
              />
            ))}
          </ul>
        </>
      )}

      {storageLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Secure Storage
          </div>
          <ul className="space-y-1 text-xs">
            {storageLocations.map((location) => (
              <LocationNavItem
                key={location._id}
                location={{ ...location, isSecure: true }}
                isSelected={selectedLocationId === location._id}
                onSelect={() => onSelectLocation(location._id)}
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
  location: LocationItem;
  isSelected: boolean;
  onSelect: () => void;
}

function LocationNavItem({
  location,
  isSelected,
  onSelect,
}: LocationNavItemProps) {
  const isExhibition = !location.isSecure;
  const statusColor = location.isActive
    ? isExhibition
      ? "bg-emerald-500"
      : "bg-amber-500"
    : "bg-zinc-700";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`location-nav-item w-full flex items-center justify-between px-3 py-2 rounded-r cursor-pointer transition-all ${
          isSelected
            ? "bg-zinc-900 border-l-2 border-indigo-500 text-zinc-100 font-medium shadow-sm"
            : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
        }`}
      >
        <span>{location.name}</span>
        {location.isSecure ? (
          <Lock className="size-3 text-zinc-600" />
        ) : (
          <span className={`size-1.5 rounded-full ${statusColor}`} />
        )}
      </button>
    </li>
  );
}
