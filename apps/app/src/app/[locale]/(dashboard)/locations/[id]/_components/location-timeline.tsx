"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Skeleton } from "@v1/ui/skeleton";
import { Timeline } from "@v1/ui/timeline";
import { useQuery } from "convex/react";
import { getRelativeTimeFormatter } from "@/lib/relative-time-formatters";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface LocationTimelineProps {
  locationId: string;
}

export function LocationTimeline({ locationId }: LocationTimelineProps) {
  const t = useScopedI18n("untranslatedDashboard.locationViews");
  const locale = useCurrentLocale();
  const relativeTimeFormatter = getRelativeTimeFormatter(locale);
  const history = useQuery(api.locations.getLocationHistory, {
    locationId: locationId as Id<"locations">,
  });

  if (history === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (history.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {t("noLocationHistory")}
      </div>
    );
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return relativeTimeFormatter.format(-minutes, "minute");
    if (hours < 24) return relativeTimeFormatter.format(-hours, "hour");
    return relativeTimeFormatter.format(-days, "day");
  };

  const timelineItems = history.map((event) => {
    const isMovedIn = event.eventType === "moved_in";
    const actionText = isMovedIn ? t("movedInFrom") : t("movedOutTo");
    const otherLocation = event.otherLocationName || t("unknownLocation");

    return {
      title: `${event.accessionNumber}`,
      description: `${event.collectionTitle} ${actionText} ${otherLocation}${event.movedByName ? ` ${t("by")} ${event.movedByName}` : ""}`,
      date: formatTimestamp(event.timestamp),
      status: isMovedIn ? ("completed" as const) : ("pending" as const),
    };
  });

  return <Timeline items={timelineItems} />;
}
