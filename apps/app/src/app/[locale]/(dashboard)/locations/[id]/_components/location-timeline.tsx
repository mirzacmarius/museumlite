"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Skeleton } from "@v1/ui/skeleton";
import { Timeline } from "@v1/ui/timeline";
import { useQuery } from "convex/react";

interface LocationTimelineProps {
  locationId: string;
}

export function LocationTimeline({ locationId }: LocationTimelineProps) {
  const history = useQuery(api.locations.getLocationHistory, {
    locationId: locationId as Id<"locations">,
  });

  if (history === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (history.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No location history
      </div>
    );
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const timelineItems = history.map((event) => {
    const isMovedIn = event.eventType === "moved_in";
    const actionText = isMovedIn ? "moved in from" : "moved out to";
    const otherLocation = event.otherLocationName || "unknown location";

    return {
      title: `${event.accessionNumber}`,
      description: `${event.collectionTitle} ${actionText} ${otherLocation}${event.movedByName ? ` by ${event.movedByName}` : ""}`,
      date: formatTimestamp(event.timestamp),
      status: isMovedIn ? ("completed" as const) : ("pending" as const),
    };
  });

  return <Timeline items={timelineItems} />;
}
