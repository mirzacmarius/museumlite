"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Boxes, MapPin } from "lucide-react";
import Link from "next/link";
import type { CollectionData, LocationPathItem } from "./types";

interface PlacementRelationshipsTabProps {
  collection: CollectionData;
  collectionId: Id<"collections">;
  locationPath: LocationPathItem[];
}

export function PlacementRelationshipsTab({
  collection,
  collectionId,
  locationPath,
}: PlacementRelationshipsTabProps) {
  const parentObject = useQuery(api.collections.getParentObject, {
    collectionId,
  });
  const childObjects = useQuery(api.collections.getChildObjects, {
    collectionId,
  });
  const location = locationPath.map((item) => item.name).join(" / ");
  const currentLocation = locationPath.at(-1);
  const locationCodeFromPath = currentLocation?.locationCode?.trim();
  const currentLocationDetails = useQuery(
    api.locations.get,
    currentLocation && !locationCodeFromPath
      ? { locationId: currentLocation._id }
      : "skip",
  );
  const locationCode =
    locationCodeFromPath || currentLocationDetails?.locationCode.trim();
  const isOnDisplay = collection.displayStatus === "on_display";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <MapPin className="size-4 text-emerald-500" />
          Placement
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Current Location
              </span>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm text-foreground">
                  {location || "-"}
                </span>
                {collection.currentLocationId && locationCode && (
                  <div className="shrink-0 rounded bg-secondary/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {locationCode}
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                On Display
              </span>
              <span
                className={
                  isOnDisplay
                    ? "inline-flex rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400"
                    : "text-sm text-muted-foreground"
                }
              >
                {isOnDisplay ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Boxes className="size-4 text-sky-500" />
          Relationships
        </h3>
        <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Parent Object
            </span>
            {parentObject === undefined ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : parentObject ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/objects/${parentObject._id}`}>
                  {parentObject.title} ({parentObject.accessionNumber})
                </Link>
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                No parent object assigned.
              </span>
            )}
          </div>

          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Child Objects
            </span>
            {childObjects === undefined ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : childObjects.children.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {childObjects.children.map((child) => (
                  <Button key={child._id} variant="outline" size="sm" asChild>
                    <Link href={`/objects/${child._id}`}>
                      {child.title} ({child.accessionNumber})
                    </Link>
                  </Button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                No child objects assigned.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
