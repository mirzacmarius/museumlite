"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Link from "next/link";

interface ObjectsAtLocationProps {
  locationId: string;
}

export function ObjectsAtLocation({ locationId }: ObjectsAtLocationProps) {
  const objects = useQuery(
    api.locations.getObjectsAtLocation,
    locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );

  if (objects === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading objects...</p>
      </div>
    );
  }

  if (objects.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          No objects at this location
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {objects.map((obj) => (
        <Link
          key={obj._id}
          href={`/objects/${obj._id}`}
          className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{obj.title}</h4>
              <p className="text-sm text-muted-foreground">
                {obj.accessionNumber}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize text-muted-foreground">
              {obj.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
