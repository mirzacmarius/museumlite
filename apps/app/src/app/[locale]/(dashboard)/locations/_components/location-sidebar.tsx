"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { shouldShowInExhibitionSidebar } from "@/app/[locale]/(dashboard)/locations/location-view-helpers";
import { useScopedI18n } from "@/locales/client";
import {
  getInitialExpandedLocationIds,
  getLocationPathIds,
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
  const t = useScopedI18n("locations");
  const tSidebar = useScopedI18n("locations.sidebar");
  const tForm = useScopedI18n("locations.form");
  const [expandedOverrides, setExpandedOverrides] = useState<Set<
    Id<"locations">
  > | null>(null);
  const [expandedForSelectedId, setExpandedForSelectedId] =
    useState(selectedLocationId);

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

  const selectedPathIds = useMemo(
    () => getLocationPathIds(allLocations, selectedLocationId),
    [allLocations, selectedLocationId],
  );

  const initialExpandedLocationIds = useMemo(() => {
    const expandedIds = getInitialExpandedLocationIds({
      exhibitionLocations,
      storageLocations,
      getExhibitionChildren,
      getStorageChildren: getChildren,
    });
    for (const locationId of selectedPathIds) {
      expandedIds.add(locationId);
    }
    return expandedIds;
  }, [locationsStructureKey, selectedPathIds]);

  if (selectedLocationId !== expandedForSelectedId) {
    setExpandedForSelectedId(selectedLocationId);
    setExpandedOverrides((currentLocationIds) => {
      if (!currentLocationIds) {
        return currentLocationIds;
      }

      const nextLocationIds = new Set(currentLocationIds);
      for (const locationId of selectedPathIds) {
        nextLocationIds.add(locationId);
      }
      return nextLocationIds;
    });
  }

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
  const toggleLabel = (name: string, isExpanded: boolean) =>
    tSidebar(isExpanded ? "collapse" : "expand", { name });

  return (
    <nav
      aria-label={t("locations")}
      className="custom-scrollbar max-h-56 w-full shrink-0 overflow-x-hidden overflow-y-auto border-b border-border/60 bg-background px-2 py-3 dark:border-white/10 dark:bg-zinc-950 md:h-full md:max-h-none md:w-56 md:border-b-0 md:border-e"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          {t("locations")}
        </span>
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
              toggleLabel={toggleLabel}
            />
          ))}
        </ul>
      )}

      {storageLocations.length > 0 && (
        <>
          <div className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {tForm("locationTypes.storage")}
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
                toggleLabel={toggleLabel}
              />
            ))}
          </ul>
        </>
      )}

      {exhibitionLocations.length === 0 && storageLocations.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-xs text-muted-foreground">{tSidebar("empty")}</p>
        </div>
      )}
    </nav>
  );
}
