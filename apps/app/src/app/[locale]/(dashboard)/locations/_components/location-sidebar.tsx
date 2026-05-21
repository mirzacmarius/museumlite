"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ChevronRight, Lock, Thermometer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  isStorageLocation,
  shouldShowInExhibitionSidebar,
} from "@/app/[locale]/(dashboard)/locations/location-view-helpers";

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
  const [expandedLocationIds, setExpandedLocationIds] = useState(
    () => new Set<Id<"locations">>(),
  );

  const getChildren = (parentLocationId: Id<"locations">) =>
    allLocations.filter(
      (location) => location.parentLocationId === parentLocationId,
    );
  const getExhibitionChildren = (parentLocationId: Id<"locations">) =>
    getChildren(parentLocationId).filter((location) =>
      shouldShowInExhibitionSidebar(location.type),
    );

  const toggleLocation = (locationId: Id<"locations">) => {
    setExpandedLocationIds((currentLocationIds) => {
      const nextLocationIds = new Set(currentLocationIds);

      if (nextLocationIds.has(locationId)) {
        nextLocationIds.delete(locationId);
      } else {
        nextLocationIds.add(locationId);
      }

      return nextLocationIds;
    });
  };

  const locationsStructureKey = useMemo(
    () =>
      allLocations
        .map(
          (location) =>
            `${location._id}:${location.parentLocationId ?? "root"}:${location.type}`,
        )
        .join("|"),
    [allLocations],
  );

  const initialExpandedLocationIds = useMemo(
    () =>
      getInitialExpandedLocationIds({
        exhibitionLocations,
        storageLocations,
        getExhibitionChildren,
        getStorageChildren: getChildren,
      }),
    [locationsStructureKey],
  );

  useEffect(() => {
    setExpandedLocationIds(initialExpandedLocationIds);
  }, [initialExpandedLocationIds]);

  return (
    <div className="h-full min-h-0 w-60 shrink-0 overflow-y-auto border-r border-border bg-card p-4 custom-scrollbar">
      {exhibitionLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Exhibition Spaces
          </div>
          <ul className="mb-6 space-y-1 text-xs">
            {exhibitionLocations.map((location) => (
              <LocationNavTreeItem
                key={location._id}
                location={location}
                childLocations={getExhibitionChildren(location._id)}
                getChildren={getExhibitionChildren}
                selectedLocationId={selectedLocationId}
                onSelectLocation={onSelectLocation}
                expandedLocationIds={expandedLocationIds}
                onToggleLocation={toggleLocation}
                isSecure={false}
              />
            ))}
          </ul>
        </>
      )}

      {storageLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                expandedLocationIds={expandedLocationIds}
                onToggleLocation={toggleLocation}
                isSecure={true}
              />
            ))}
          </ul>
        </>
      )}

      {exhibitionLocations.length === 0 && storageLocations.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-xs text-muted-foreground">No locations yet</p>
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
  expandedLocationIds: Set<Id<"locations">>;
  onToggleLocation: (id: Id<"locations">) => void;
  isSecure: boolean;
  depth?: number;
}

function LocationNavTreeItem({
  childLocations,
  getChildren,
  location,
  selectedLocationId,
  onSelectLocation,
  expandedLocationIds,
  onToggleLocation,
  isSecure,
  depth = 0,
}: LocationNavTreeItemProps) {
  const isLocationSecure = isSecure || isStorageLocation(location.type);
  const hasChildren = childLocations.length > 0;
  const isExpanded = hasChildren && expandedLocationIds.has(location._id);

  return (
    <li>
      <LocationNavItem
        location={location}
        isSelected={selectedLocationId === location._id}
        onSelect={() => onSelectLocation(location._id)}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => onToggleLocation(location._id)}
        isSecure={isLocationSecure}
        isColdStorage={location.type.toLowerCase().includes("cold")}
        depth={depth}
      />
      {isExpanded && (
        <ul className="mt-1 space-y-1" aria-label={`${location.name} children`}>
          {childLocations.map((childLocation) => (
            <LocationNavTreeItem
              key={childLocation._id}
              location={childLocation}
              childLocations={getChildren(childLocation._id)}
              getChildren={getChildren}
              selectedLocationId={selectedLocationId}
              onSelectLocation={onSelectLocation}
              expandedLocationIds={expandedLocationIds}
              onToggleLocation={onToggleLocation}
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
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isSecure: boolean;
  isColdStorage?: boolean;
  depth: number;
}

function LocationNavItem({
  location,
  isSelected,
  onSelect,
  hasChildren,
  isExpanded,
  onToggle,
  isSecure,
  isColdStorage,
  depth,
}: LocationNavItemProps) {
  const getStatusColor = () => {
    if (!location.isActive) return "bg-muted-foreground";
    if (isSecure) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const statusColor = getStatusColor();

  return (
    <div
      className={`flex w-full items-center rounded-r transition-all ${
        isSelected
          ? "border-l-2 border-primary bg-muted font-medium text-foreground shadow-sm"
          : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
      style={{ paddingLeft: `${depth * 14 + 12}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${location.name}`}
          aria-expanded={isExpanded}
        >
          <ChevronRight
            className={`size-3 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </button>
      ) : (
        <span className="h-7 w-5 shrink-0" />
      )}

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-3 text-left"
      >
        <span className="truncate">{location.name}</span>
        {isColdStorage ? (
          <span className="flex shrink-0 items-center gap-0.5 rounded border border-blue-500/20 bg-blue-500/10 px-1 text-[9px] text-blue-400">
            <Thermometer className="size-2.5" />
            4°C
          </span>
        ) : isSecure ? (
          <Lock className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <span className={`size-1.5 shrink-0 rounded-full ${statusColor}`} />
        )}
      </button>
    </div>
  );
}

function getInitialExpandedLocationIds({
  exhibitionLocations,
  storageLocations,
  getExhibitionChildren,
  getStorageChildren,
}: {
  exhibitionLocations: SidebarLocation[];
  storageLocations: SidebarLocation[];
  getExhibitionChildren: (
    parentLocationId: Id<"locations">,
  ) => SidebarLocation[];
  getStorageChildren: (parentLocationId: Id<"locations">) => SidebarLocation[];
}) {
  const firstExhibitionLocation = exhibitionLocations[0];
  if (firstExhibitionLocation) {
    return getFirstDeepestPathParentIds(
      firstExhibitionLocation,
      getExhibitionChildren,
    );
  }

  const firstStorageLocation = storageLocations[0];
  if (firstStorageLocation) {
    return getFirstDeepestPathParentIds(
      firstStorageLocation,
      getStorageChildren,
    );
  }

  return new Set<Id<"locations">>();
}

function getFirstDeepestPathParentIds(
  rootLocation: SidebarLocation,
  getChildren: (parentLocationId: Id<"locations">) => SidebarLocation[],
) {
  const expandedLocationIds = new Set<Id<"locations">>();
  const visitedLocationIds = new Set<Id<"locations">>();
  let currentLocation: SidebarLocation | undefined = rootLocation;

  while (currentLocation && !visitedLocationIds.has(currentLocation._id)) {
    visitedLocationIds.add(currentLocation._id);

    const children = getChildren(currentLocation._id);
    if (children.length === 0) {
      break;
    }

    expandedLocationIds.add(currentLocation._id);
    currentLocation = children[0];
  }

  return expandedLocationIds;
}
