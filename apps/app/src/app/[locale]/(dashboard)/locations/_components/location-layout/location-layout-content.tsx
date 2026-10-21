"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Highlight, HighlightScope } from "@v1/ui/motion-highlight";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronRight,
  GitBranch,
  LayoutGrid,
  ListTree,
  MessagesSquare,
} from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { ComponentProps, ReactNode } from "react";
import { useScopedI18n } from "@/locales/client";
import { LocationHeader } from "../location-header";
import { LocationTypeIcon } from "../location-type-icon";
import { LocationUnitCard } from "../location-unit-card";
import { LocationDiagram } from "./location-diagram";
import { LocationGrid } from "./location-grid";

const knownLocationTypes = new Set([
  "building",
  "room",
  "gallery",
  "storage",
  "cabinet",
  "shelf",
  "vault",
  "other",
]);

type LocationDetail = NonNullable<FunctionReturnType<typeof api.locations.get>>;
type ObjectsAtLocation = FunctionReturnType<
  typeof api.locations.getObjectsAtLocation
>;
type ThreadLocation = FunctionReturnType<typeof api.locations.listAll>[number];

interface LocationLayoutContentProps {
  actions?: ReactNode;
  selectedLocation: LocationDetail;
  environmentalData: ComponentProps<typeof LocationHeader>["environmentalData"];
  occupancy: FunctionReturnType<typeof api.locations.getOccupancy> | undefined;
  objectsAtLocation: ObjectsAtLocation | undefined;
  locations: ThreadLocation[];
  onSelectLocation: (id: Id<"locations">) => void;
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
  const t = useScopedI18n("untranslatedDashboard.locations");
  const tLocations = useScopedI18n("locations");
  const formatLocationType = (type: string) =>
    knownLocationTypes.has(type)
      ? tLocations(`form.locationTypes.${type}`)
      : type;
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
          {t("noObjectsInLocation")}
        </p>
      )}
    </>
  );
  if (root) return content;
  return (
    <details key={location._id} open className="group/thread min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-xs hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/thread:rotate-90" />
        <LocationTypeIcon
          type={location.type}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 truncate font-medium">{location.name}</span>
        <span className="text-[10px] capitalize text-muted-foreground">
          {formatLocationType(location.type)}
        </span>
        <span className="ms-auto shrink-0 pe-2 text-[10px] tabular-nums text-muted-foreground">
          {t("directAndNestedCounts", {
            direct: assigned.length,
            locations: nested.length,
          })}
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
  onSelectLocation,
}: LocationLayoutContentProps) {
  const t = useScopedI18n("untranslatedDashboard.locations");
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

  const hasSublocations = selectedLocation.children.length > 0;

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
        <span className="text-xs font-medium">
          {hasSublocations ? t("locationsAndObjects") : t("objects")}
        </span>
        {hasSublocations && (
          <HighlightScope>
            <fieldset
              aria-label={t("listingStyle")}
              className="isolate inline-flex rounded-md border border-border p-0.5"
            >
              {(
                [
                  { value: "grid", label: "grid", icon: LayoutGrid },
                  { value: "thread", label: "thread", icon: MessagesSquare },
                  { value: "diagram", label: "diagram", icon: GitBranch },
                  { value: "outline", label: "outline", icon: ListTree },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={viewStyle === value}
                  onClick={() => setViewStyle(value)}
                  className={cn(
                    "relative flex h-7 items-center gap-1.5 rounded px-2.5 text-xs transition-colors focus-visible:outline focus-visible:outline-indigo-400",
                    viewStyle === value
                      ? "text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {viewStyle === value && <Highlight className="bg-accent" />}
                  <Icon className="size-3.5" />
                  {t(label)}
                </button>
              ))}
            </fieldset>
          </HighlightScope>
        )}
      </div>
      {objectsAtLocation === undefined ? (
        <p className="text-xs text-muted-foreground">{t("loadingObjects")}</p>
      ) : !hasSublocations || viewStyle === "grid" ? (
        <LocationGrid
          objects={objectsAtLocation}
          locations={locations}
          showLocationIndicator={hasSublocations}
        />
      ) : viewStyle === "diagram" ? (
        <section
          key={selectedLocation._id}
          aria-label={t("locationHierarchyDiagram")}
          className="min-w-0 overflow-hidden rounded-xl border border-border/60"
        >
          <LocationDiagram
            location={selectedLocation}
            childrenById={children}
            objectsById={objects}
            onSelectLocation={onSelectLocation}
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
