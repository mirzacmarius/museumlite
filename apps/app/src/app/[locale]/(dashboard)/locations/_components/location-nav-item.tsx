"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ChevronRight } from "lucide-react";
import { createContext, type ReactNode, use, useMemo } from "react";
import { useI18n } from "@/locales/client";

export interface SidebarLocation {
  _id: Id<"locations">;
  name: string;
  locationCode: string;
  type: string;
  isActive: boolean;
  parentLocationId?: Id<"locations">;
}

interface LocationNavItemContextValue {
  location: SidebarLocation;
  selection: "selected" | "idle";
  onSelect: () => void;
  expansion: "leaf" | "expanded" | "collapsed";
  onToggle: () => void;
  toggleLabel: (name: string, isExpanded: boolean) => string;
  depth: number;
}

const LocationNavItemContext =
  createContext<LocationNavItemContextValue | null>(null);

function useLocationNavItem() {
  const context = use(LocationNavItemContext);
  if (!context) {
    throw new Error(
      "LocationNavItem subcomponents must be used within LocationNavItem.Root",
    );
  }
  return context;
}

interface LocationNavItemRootProps {
  location: SidebarLocation;
  state: Pick<LocationNavItemContextValue, "selection" | "expansion">;
  onSelect: () => void;
  onToggle: () => void;
  toggleLabel: (name: string, isExpanded: boolean) => string;
  depth: number;
  children: ReactNode;
}

function LocationNavItemRoot({
  location,
  state,
  onSelect,
  onToggle,
  toggleLabel,
  depth,
  children,
}: LocationNavItemRootProps) {
  const { selection, expansion } = state;
  const value = useMemo(
    () => ({
      location,
      selection,
      onSelect,
      expansion,
      onToggle,
      toggleLabel,
      depth,
    }),
    [location, selection, onSelect, expansion, onToggle, toggleLabel, depth],
  );

  return (
    <LocationNavItemContext.Provider value={value}>
      <div
        className={`flex h-7 w-full items-center rounded-md border transition-colors duration-150 ${
          selection === "selected"
            ? "border-indigo-500/20 bg-indigo-500/10 font-medium text-indigo-600 dark:text-indigo-300"
            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
        style={{
          paddingInlineStart: `${depth * 8 + (expansion === "leaf" ? 20 : 0)}px`,
        }}
      >
        {children}
      </div>
    </LocationNavItemContext.Provider>
  );
}

function LocationNavItemTrigger() {
  const { location, expansion, onToggle, toggleLabel } = useLocationNavItem();
  const isExpanded = expansion === "expanded";

  if (expansion === "leaf") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      aria-label={toggleLabel(location.name, isExpanded)}
      aria-expanded={isExpanded}
    >
      <ChevronRight
        className={`size-3 transition-transform ${
          isExpanded ? "rotate-90" : ""
        }`}
      />
    </button>
  );
}

function LocationNavItemLink() {
  const { location, onSelect, selection } = useLocationNavItem();

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selection === "selected" ? "location" : undefined}
      title={location.name}
      className="h-7 min-w-0 flex-1 truncate pe-2 text-start text-xs font-medium"
    >
      {location.name}
    </button>
  );
}

export const LocationNavItem = {
  Root: LocationNavItemRoot,
  Trigger: LocationNavItemTrigger,
  Link: LocationNavItemLink,
};

interface LocationNavTreeItemProps {
  childLocations: SidebarLocation[];
  getChildren: (parentLocationId: Id<"locations">) => SidebarLocation[];
  location: SidebarLocation;
  selectedLocationId: Id<"locations"> | null;
  onSelectLocation: (id: Id<"locations">) => void;
  expandedLocationIds: Set<Id<"locations">>;
  onToggleLocation: (id: Id<"locations">) => void;
  toggleLabel: (name: string, isExpanded: boolean) => string;
  depth?: number;
}

export function LocationNavTreeItem({
  childLocations,
  getChildren,
  location,
  selectedLocationId,
  onSelectLocation,
  expandedLocationIds,
  onToggleLocation,
  toggleLabel,
  depth = 0,
}: LocationNavTreeItemProps) {
  const t = useI18n();
  const hasChildren = childLocations.length > 0;
  const isExpanded = hasChildren && expandedLocationIds.has(location._id);

  return (
    <li>
      <LocationNavItem.Root
        location={location}
        state={{
          selection: selectedLocationId === location._id ? "selected" : "idle",
          expansion: hasChildren
            ? isExpanded
              ? "expanded"
              : "collapsed"
            : "leaf",
        }}
        onSelect={() => onSelectLocation(location._id)}
        onToggle={() => onToggleLocation(location._id)}
        toggleLabel={toggleLabel}
        depth={depth}
      >
        <LocationNavItem.Trigger />
        <LocationNavItem.Link />
      </LocationNavItem.Root>
      {isExpanded && (
        <ul
          className="mt-0.5"
          aria-label={t("untranslatedDashboard.locationViews.childrenLabel", {
            name: location.name,
          })}
        >
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
              toggleLabel={toggleLabel}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function getLocationPathIds(
  locations: SidebarLocation[],
  selectedLocationId: Id<"locations"> | null,
) {
  const pathIds = new Set<Id<"locations">>();
  if (!selectedLocationId) {
    return pathIds;
  }

  const locationsById = new Map(
    locations.map((location) => [location._id, location]),
  );
  let currentLocation = locationsById.get(selectedLocationId);
  const visitedIds = new Set<Id<"locations">>();

  while (currentLocation && !visitedIds.has(currentLocation._id)) {
    visitedIds.add(currentLocation._id);
    pathIds.add(currentLocation._id);
    currentLocation = currentLocation.parentLocationId
      ? locationsById.get(currentLocation.parentLocationId)
      : undefined;
  }

  return pathIds;
}

export function getInitialExpandedLocationIds({
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
