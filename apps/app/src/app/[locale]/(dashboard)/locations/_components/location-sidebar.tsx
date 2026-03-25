"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Lock, Thermometer } from "lucide-react";
import { formatLocationLabel } from "../location-label";

interface SidebarLocation {
  _id: Id<"locations">;
  name: string;
  locationCode: string;
  type: string;
  isActive: boolean;
  parentLocationId?: Id<"locations">;
}

interface LocationSidebarProps {
  allLocations: SidebarLocation[];
  exhibitionLocations: SidebarLocation[];
  storageLocations: SidebarLocation[];
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
}

export function LocationSidebar({
  allLocations,
  exhibitionLocations,
  storageLocations,
  selectedLocationId,
  onSelectLocation,
}: LocationSidebarProps) {
  const getChildren = (parentLocationId: Id<"locations">) =>
    allLocations.filter(
      (location) => location.parentLocationId === parentLocationId,
    );

  return (
    <div className="h-full min-h-0 w-60 shrink-0 overflow-y-auto border-r border-zinc-800/60 bg-zinc-950 p-4 custom-scrollbar">
      {exhibitionLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Exhibition Spaces
          </div>
          <ul className="mb-6 space-y-1 text-xs">
            {exhibitionLocations.map((location) => (
              <LocationNavTreeItem
                key={location._id}
                location={location}
                childLocations={getChildren(location._id)}
                getChildren={getChildren}
                selectedLocationId={selectedLocationId}
                onSelectLocation={onSelectLocation}
                isSecure={false}
              />
            ))}
          </ul>
        </>
      )}

      {storageLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Secure Storage
          </div>
          <ul className="space-y-1 text-xs">
            {storageLocations.map((location) => (
              <LocationNavTreeItem
                key={location._id}
                location={location}
                childLocations={getChildren(location._id)}
                getChildren={getChildren}
                selectedLocationId={selectedLocationId}
                onSelectLocation={onSelectLocation}
                isSecure={true}
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

interface LocationNavTreeItemProps {
  childLocations: SidebarLocation[];
  getChildren: (parentLocationId: Id<"locations">) => SidebarLocation[];
  location: SidebarLocation;
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
  isSecure: boolean;
  depth?: number;
}

function LocationNavTreeItem({
  childLocations,
  getChildren,
  location,
  selectedLocationId,
  onSelectLocation,
  isSecure,
  depth = 0,
}: LocationNavTreeItemProps) {
  const isLocationSecure =
    isSecure ||
    ["storage", "vault", "cabinet", "shelf", "archive"].some((type) =>
      location.type.toLowerCase().includes(type),
    );

  return (
    <li>
      <LocationNavItem
        location={location}
        isSelected={selectedLocationId === location._id}
        onSelect={() => onSelectLocation(location._id)}
        isSecure={isLocationSecure}
        isColdStorage={location.type.toLowerCase().includes("cold")}
        depth={depth}
      />
      {childLocations.length > 0 && (
        <ul className="mt-1 space-y-1">
          {childLocations.map((childLocation) => (
            <LocationNavTreeItem
              key={childLocation._id}
              location={childLocation}
              childLocations={getChildren(childLocation._id)}
              getChildren={getChildren}
              selectedLocationId={selectedLocationId}
              onSelectLocation={onSelectLocation}
              isSecure={isLocationSecure}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface LocationNavItemProps {
  location: SidebarLocation;
  isSelected: boolean;
  onSelect: () => void;
  isSecure: boolean;
  isColdStorage?: boolean;
  depth: number;
}

function LocationNavItem({
  location,
  isSelected,
  onSelect,
  isSecure,
  isColdStorage,
  depth,
}: LocationNavItemProps) {
  const getStatusColor = () => {
    if (!location.isActive) return "bg-zinc-700";
    if (isSecure) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const statusColor = getStatusColor();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-r px-3 py-2 transition-all ${
        isSelected
          ? "border-l-2 border-indigo-500 bg-zinc-900 font-medium text-zinc-100 shadow-sm"
          : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
      }`}
      style={{ paddingLeft: `${depth * 14 + 12}px` }}
    >
      <span className="truncate">
        {formatLocationLabel(location.locationCode, location.name)}
      </span>
      {isColdStorage ? (
        <span className="flex items-center gap-0.5 rounded border border-blue-500/20 bg-blue-500/10 px-1 text-[9px] text-blue-400">
          <Thermometer className="h-2.5 w-2.5" />
          4°C
        </span>
      ) : isSecure ? (
        <Lock className="h-3 w-3 shrink-0 text-zinc-600" />
      ) : (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
      )}
    </button>
  );
}
