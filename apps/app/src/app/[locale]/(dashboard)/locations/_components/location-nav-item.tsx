"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ChevronRight, Lock, Thermometer } from "lucide-react";
import { createContext, type ReactNode, use, useMemo } from "react";
import { isStorageLocation } from "@/app/[locale]/(dashboard)/locations/location-view-helpers";

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
  storage: "standard" | "secure" | "cold";
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
  state: Pick<
    LocationNavItemContextValue,
    "selection" | "expansion" | "storage"
  >;
  onSelect: () => void;
  onToggle: () => void;
  depth: number;
  children: ReactNode;
}

function LocationNavItemRoot({
  location,
  state,
  onSelect,
  onToggle,
  depth,
  children,
}: LocationNavItemRootProps) {
  const { selection, expansion, storage } = state;
  const value = useMemo(
    () => ({
      location,
      selection,
      onSelect,
      expansion,
      onToggle,
      storage,
      depth,
    }),
    [location, selection, onSelect, expansion, onToggle, storage, depth],
  );

  return (
    <LocationNavItemContext.Provider value={value}>
      <div
        className={`flex w-full items-center rounded-r transition-all ${
          selection === "selected"
            ? "border-l-2 border-primary bg-muted font-medium text-foreground shadow-sm"
            : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        {children}
      </div>
    </LocationNavItemContext.Provider>
  );
}

function LocationNavItemTrigger() {
  const { location, expansion, onToggle } = useLocationNavItem();
  const isExpanded = expansion === "expanded";

  if (expansion === "leaf") {
    return <span className="h-7 w-5 shrink-0" />;
  }

  return (
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
  );
}

function LocationNavItemLink() {
  const { location, onSelect, storage } = useLocationNavItem();
  const isColdStorage = storage === "cold";
  const isSecure = storage !== "standard";

  const getStatusColor = () => {
    if (!location.isActive) return "bg-muted-foreground";
    if (isSecure) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const statusColor = getStatusColor();

  return (
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
  isSecure: boolean;
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
  isSecure,
  depth = 0,
}: LocationNavTreeItemProps) {
  const isLocationSecure = isSecure || isStorageLocation(location.type);
  const hasChildren = childLocations.length > 0;
  const isExpanded = hasChildren && expandedLocationIds.has(location._id);
  const storage = location.type.toLowerCase().includes("cold")
    ? "cold"
    : isLocationSecure
      ? "secure"
      : "standard";

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
          storage,
        }}
        onSelect={() => onSelectLocation(location._id)}
        onToggle={() => onToggleLocation(location._id)}
        depth={depth}
      >
        <LocationNavItem.Trigger />
        <LocationNavItem.Link />
      </LocationNavItem.Root>
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
