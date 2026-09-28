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

  const initialExpandedLocationIds = useMemo(() => {
    const expandedIds = getInitialExpandedLocationIds({
      exhibitionLocations,
      storageLocations,
      getExhibitionChildren,
      getStorageChildren: getChildren,
    });
    const locationsById = new Map(
      allLocations.map((location) => [location._id, location]),
    );
    let currentLocation = selectedLocationId
      ? locationsById.get(selectedLocationId)
      : undefined;
    const visitedIds = new Set<Id<"locations">>();

    while (currentLocation && !visitedIds.has(currentLocation._id)) {
      visitedIds.add(currentLocation._id);
      expandedIds.add(currentLocation._id);
      currentLocation = currentLocation.parentLocationId
        ? locationsById.get(currentLocation.parentLocationId)
        : undefined;
    }

    return expandedIds;
  }, [locationsStructureKey, selectedLocationId]);

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
    <nav
      aria-label="Locations"
      className="custom-scrollbar max-h-56 w-full shrink-0 overflow-y-auto border-b border-border/60 bg-background p-4 dark:border-white/10 dark:bg-zinc-950 md:h-full md:max-h-none md:w-56 md:border-b-0 md:border-e"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Locations</span>
        <span className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-white/10">
          {allLocations.length}
        </span>
      </div>
      {exhibitionLocations.length > 0 && (
        <ul className="mb-4 text-xs">
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
            />
          ))}
        </ul>
      )}

      {storageLocations.length > 0 && (
        <>
          <div className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Storage
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
    </nav>
  );
}
