"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import type { FunctionReturnType } from "convex/server";
import { MapPin } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { LocationUnitCard } from "../location-unit-card";

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

interface LocationGridProps {
  objects: FunctionReturnType<typeof api.locations.getObjectsAtLocation>;
  locations: FunctionReturnType<typeof api.locations.listAll>;
  showLocationIndicator: boolean;
}

export function LocationGrid({
  objects,
  locations,
  showLocationIndicator,
}: LocationGridProps) {
  const t = useScopedI18n("untranslatedDashboard.locations");
  const tView = useScopedI18n("untranslatedDashboard.locationViews");
  const tLocations = useScopedI18n("locations");
  const formatLocationType = (type: string) =>
    knownLocationTypes.has(type)
      ? tLocations(`form.locationTypes.${type}`)
      : type;
  const locationsById = new Map(
    locations.map((location) => [location._id, location]),
  );

  if (objects.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {t("noObjectsInLocationAndChildren")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] items-start gap-4">
      {objects.map((object) => {
        const location = object.currentLocationId
          ? locationsById.get(object.currentLocationId)
          : undefined;
        const path: string[] = [];
        const visited = new Set<Id<"locations">>();
        let current = location;
        while (current && !visited.has(current._id)) {
          visited.add(current._id);
          path.unshift(current.name);
          current = current.parentLocationId
            ? locationsById.get(current.parentLocationId)
            : undefined;
        }

        return (
          <LocationUnitCard
            key={object._id}
            name={location?.name ?? t("unknownLocation")}
            isActive={location?.isActive}
            objects={[object]}
            locationIndicator={
              showLocationIndicator ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        location
                          ? t("locationPath", { path: path.join(" / ") })
                          : t("locationUnavailable")
                      }
                      className="ms-auto inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-indigo-400"
                    >
                      <MapPin className="size-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
                  >
                    {location ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">{location.name}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {path.join(" / ")}
                        </p>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[10px]">
                          <dt className="text-muted-foreground">ID</dt>
                          <dd className="font-mono">{location.locationCode}</dd>
                          <dt className="text-muted-foreground">
                            {tView("locationType")}
                          </dt>
                          <dd className="capitalize">
                            {formatLocationType(location.type)}
                          </dd>
                          <dt className="text-muted-foreground">
                            {tView("locationStatus")}
                          </dt>
                          <dd>
                            {location.isActive
                              ? tLocations("active")
                              : tLocations("inactive")}
                          </dd>
                        </dl>
                      </div>
                    ) : (
                      <span className="text-xs">
                        {t("locationDetailsUnavailable")}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
