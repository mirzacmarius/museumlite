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
  const isOnDisplay = collection.displayStatus === "on_display";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <MapPin className="h-4 w-4 text-emerald-500" />
          Placement
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Current Location
              </span>
              <span className="text-sm text-foreground">{location || "-"}</span>
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
          <Boxes className="h-4 w-4 text-sky-500" />
          Relationships
        </h3>
        <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Parent Object
            </span>
            {parentObject === undefined ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
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
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : childObjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {childObjects.map((child) => (
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
