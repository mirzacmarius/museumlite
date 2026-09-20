"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronRight,
  GitBranch,
  LayoutGrid,
  ListTree,
  MapPin,
  MessagesSquare,
} from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { ComponentProps, ReactNode } from "react";
import { LocationHeader } from "../location-header";
import { LocationUnitCard } from "../location-unit-card";
import { LocationDiagram } from "./location-diagram";
import { LocationGrid } from "./location-grid";

type LocationDetail = NonNullable<FunctionReturnType<typeof api.locations.get>>;
type ObjectsAtLocation = FunctionReturnType<
  typeof api.locations.getObjectsAtLocation
>;
type ThreadLocation = FunctionReturnType<typeof api.locations.listAll>[number];

interface LocationLayoutContentProps {
  actions: ReactNode;
  selectedLocation: LocationDetail;
  environmentalData: ComponentProps<typeof LocationHeader>["environmentalData"];
  occupancy: FunctionReturnType<typeof api.locations.getOccupancy> | undefined;
  objectsAtLocation: ObjectsAtLocation | undefined;
  locations: ThreadLocation[];
}

function LocationBranch({
  location,
  ancestors,
  root = false,
  objects,
  childrenById,
  viewStyle,
}: {
  location: ThreadLocation | LocationDetail;
  ancestors: Set<Id<"locations">>;
  root?: boolean;
  objects: Map<Id<"locations">, ObjectsAtLocation>;
  childrenById: Map<Id<"locations">, ThreadLocation[]>;
  viewStyle: "thread" | "outline";
}): ReactNode {
  if (ancestors.has(location._id)) return null;
  const path = new Set(ancestors).add(location._id);
  const assigned = objects.get(location._id) ?? [];
  const nested = childrenById.get(location._id) ?? [];
  const content = (
    <>
      {assigned.length > 0 &&
        (viewStyle === "outline" ? (
          <div className="mb-3 divide-y divide-border/40">
            {assigned.map((object) => (
              <Link
                key={object._id}
                href={`/objects/${object._id}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded p-2 text-xs hover:bg-muted/40"
              >
                <span className="truncate">{object.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {object.accessionNumber}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] items-start gap-4 pb-5">
            <LocationUnitCard
              name={location.name}
              isActive={location.isActive}
              objects={assigned}
            />
          </div>
        ))}
      {nested.length > 0 && (
        <div className="space-y-3">
          {nested.map((child) => (
            <LocationBranch
              key={child._id}
              location={child}
              ancestors={path}
              objects={objects}
              childrenById={childrenById}
              viewStyle={viewStyle}
            />
          ))}
        </div>
      )}
      {assigned.length === 0 && nested.length === 0 && (
        <p className="pb-3 text-xs text-muted-foreground">
          No objects in this location
        </p>
      )}
    </>
  );
  if (root) return content;
  return (
    <details key={location._id} open className="group/thread min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-xs hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/thread:rotate-90" />
        <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-medium">{location.name}</span>
        <span className="text-[10px] capitalize text-muted-foreground">
          {location.type.replaceAll("_", " ")}
        </span>
        <span className="ms-auto shrink-0 pe-2 text-[10px] tabular-nums text-muted-foreground">
          {assigned.length} direct · {nested.length} locations
        </span>
      </summary>
      <div className="ms-1.5 border-s border-border/60 ps-3 pt-3 dark:border-white/10 sm:ps-4">
        {content}
      </div>
    </details>
  );
}

export function LocationLayoutContent({
  actions,
  selectedLocation,
  environmentalData,
  occupancy,
  objectsAtLocation,
  locations,
}: LocationLayoutContentProps) {
  const [viewStyle, setViewStyle] = useQueryState(
    "view",
    parseAsStringLiteral([
      "thread",
      "diagram",
      "outline",
      "grid",
    ] as const).withDefault("thread"),
  );
  const children = new Map<Id<"locations">, ThreadLocation[]>();
  for (const location of locations) {
    if (!location.parentLocationId) continue;
    const siblings = children.get(location.parentLocationId) ?? [];
    siblings.push(location);
    children.set(location.parentLocationId, siblings);
  }
  const objects = new Map<Id<"locations">, ObjectsAtLocation>();
  for (const object of objectsAtLocation ?? []) {
    if (!object.currentLocationId) continue;
    const siblings = objects.get(object.currentLocationId) ?? [];
    siblings.push(object);
    objects.set(object.currentLocationId, siblings);
  }

  return (
    <>
      <LocationHeader
        actions={actions}
        location={selectedLocation}
        environmentalData={environmentalData}
        totalObjects={objectsAtLocation?.length ?? occupancy?.objectCount ?? 0}
        capacity={occupancy?.capacity ?? 0}
        directObjectCount={occupancy?.objectCount ?? 0}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium">Locations & objects</span>
        <fieldset
          aria-label="Listing style"
          className="inline-flex rounded-md border border-border p-0.5"
        >
          {(
            [
              { value: "grid", label: "Grid", icon: LayoutGrid },
              { value: "thread", label: "Thread", icon: MessagesSquare },
              { value: "diagram", label: "Diagram", icon: GitBranch },
              { value: "outline", label: "Outline", icon: ListTree },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={viewStyle === value}
              onClick={() => setViewStyle(value)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs transition-colors focus-visible:outline focus-visible:outline-indigo-400",
                viewStyle === value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </fieldset>
      </div>
      {objectsAtLocation === undefined ? (
        <p className="text-xs text-muted-foreground">Loading objects…</p>
      ) : viewStyle === "grid" ? (
        <LocationGrid objects={objectsAtLocation} locations={locations} />
      ) : viewStyle === "diagram" ? (
        <section
          key={selectedLocation._id}
          aria-label="Location hierarchy diagram"
          className="min-w-0 overflow-hidden rounded-xl border border-border/60"
        >
          <LocationDiagram
            location={selectedLocation}
            childrenById={children}
            objectsById={objects}
          />
        </section>
      ) : (
        <div key={`${selectedLocation._id}-${viewStyle}`} className="min-w-0">
          <LocationBranch
            location={selectedLocation}
            ancestors={new Set()}
            root
            objects={objects}
            childrenById={children}
            viewStyle={viewStyle}
          />
        </div>
      )}
    </>
  );
}
