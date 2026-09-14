"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { shouldShowInExhibitionSidebar } from "@/app/[locale]/(dashboard)/locations/location-view-helpers";
import {
  getInitialExpandedLocationIds,
  LocationNavTreeItem,
  type SidebarLocation,
} from "./location-nav-item";

interface LocationSidebarProps {
  allLocations: SidebarLocation[];
  exhibitionLocations: SidebarLocation[];
  storageLocations: SidebarLocation[];
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
}

export function LocationSidebar(props: LocationSidebarProps) {
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
  exhibitionLocations,
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
  const getExhibitionChildren = (parentLocationId: Id<"locations">) =>
    getChildren(parentLocationId).filter((location) =>
      shouldShowInExhibitionSidebar(location.type),
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
        exhibitionLocations,
        storageLocations,
        getExhibitionChildren,
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
    <div className="h-full min-h-0 w-52 shrink-0 overflow-y-auto border-r border-border bg-card py-4 custom-scrollbar">
      {exhibitionLocations.length > 0 && (
        <>
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Exhibition Spaces
          </div>
          <ul className="mb-6 text-xs">
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
          <ul className="text-xs">
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
