"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import {
  getInitialExpandedLocationIds,
  LocationNavTreeItem,
  type SidebarLocation,
} from "./location-nav-item";

interface LocationSidebarProps {
  allLocations: SidebarLocation[];
  storageLocations: SidebarLocation[];
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
}

export function LocationSidebar(props: LocationSidebarProps) {
  if (props.storageLocations.length === 0) return null;

  return <LocationSidebarKeyed {...props} />;
}

function LocationSidebarKeyed(props: LocationSidebarProps) {
  const locationsStructureKey = useMemo(
    () =>
      props.allLocations
        .map(
          (location) =>
            `${location._id}:${location.parentLocationId ?? "root"}:${location.type}`,
        )
        .join("|"),
    [props.allLocations],
  );

  return <LocationSidebarNav key={locationsStructureKey} {...props} />;
}

function LocationSidebarNav({
  allLocations,
  storageLocations,
  selectedLocationId,
  onSelectLocation,
}: LocationSidebarProps) {
  const [expandedOverrides, setExpandedOverrides] = useState<Set<
    Id<"locations">
  > | null>(null);

  const getChildren = (parentLocationId: Id<"locations">) =>
    allLocations.filter(
      (location) => location.parentLocationId === parentLocationId,
    );

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
        storageLocations,
        getStorageChildren: getChildren,
      }),
    [locationsStructureKey],
  );

  const toggleLocation = (locationId: Id<"locations">) => {
    setExpandedOverrides((currentLocationIds) => {
      const baseLocationIds = currentLocationIds ?? initialExpandedLocationIds;
      const nextLocationIds = new Set(baseLocationIds);

      if (nextLocationIds.has(locationId)) {
        nextLocationIds.delete(locationId);
      } else {
        nextLocationIds.add(locationId);
      }

      return nextLocationIds;
    });
  };

  const expandedLocationIds = expandedOverrides ?? initialExpandedLocationIds;

  return (
    <div className="h-full min-h-0 w-60 shrink-0 overflow-y-auto border-r border-border bg-card p-4 custom-scrollbar">
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
    </div>
  );
}
