"use client";

import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityItem } from "./activity-item";

interface ActivityListProps {
  organizationId: Id<"organizations">;
  entityType?: string;
  startDate?: number;
  endDate?: number;
}

type Activity = {
  _id: Id<"auditLog">;
  userId: Id<"users">;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  timestamp: number;
};

function groupByMonth(activities: Activity[]) {
  const groups: Record<string, Activity[]> = {};

  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    const monthKey = `${date.toLocaleString("default", {
      month: "long",
    })} ${date.getFullYear()}`;

    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(activity);
  }

  return groups;
}

export function ActivityList({
  organizationId,
  entityType,
  startDate,
  endDate,
}: ActivityListProps) {
  const t = useScopedI18n("activity");
  const common = useScopedI18n("common");
  const [cursor, setCursor] = useState<string | undefined>();
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const lastProcessedCursor = useRef<string | undefined>(undefined);
  const lastProcessedActivityIds = useRef<Set<string>>(new Set());

  const { activities, isDone, continueCursor } = useQuery(
    api.audit.listOrganizationActivity,
    {
      organizationId,
      entityType,
      startDate,
      endDate,
      limit: 50,
      cursor,
    },
  ) ?? { activities: [], isDone: true, continueCursor: undefined };

  // Reset activities when filters or organization changes
  useEffect(() => {
    setAllActivities([]);
    setCursor(undefined);
    lastProcessedCursor.current = undefined;
    lastProcessedActivityIds.current = new Set();
  }, [organizationId, entityType, startDate, endDate]);

  // Update activities when query results change
  useEffect(() => {
    if (!activities) return;

    const currentActivityIds = new Set(activities.map((a) => a._id));

    if (cursor) {
      // Appending new page - prevent processing the same cursor twice
      if (cursor === lastProcessedCursor.current) {
        return;
      }
      lastProcessedCursor.current = cursor;
      setAllActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a._id));
        const newActivities = activities.filter((a) => !existingIds.has(a._id));
        // Only update if there are actually new activities
        if (newActivities.length === 0) return prev;
        // Update ref with new IDs
        newActivities.forEach((a) =>
          lastProcessedActivityIds.current.add(a._id),
        );
        return [...prev, ...newActivities];
      });
    } else {
      // New query or filter change - replace all
      // Check if these are the same activities we already processed
      const prevIds = lastProcessedActivityIds.current;
      if (
        prevIds.size === currentActivityIds.size &&
        [...prevIds].every((id) =>
          currentActivityIds.has(id as Id<"auditLog">),
        ) &&
        [...currentActivityIds].every((id) => prevIds.has(id as Id<"auditLog">))
      ) {
        // Same activities, don't update to prevent infinite loop
        return;
      }

      lastProcessedCursor.current = undefined;
      lastProcessedActivityIds.current = new Set(currentActivityIds);
      setAllActivities(activities);
    }
  }, [activities, cursor]);

  const groupedActivities = useMemo(
    () => groupByMonth(allActivities),
    [allActivities],
  );

  const sortedMonths = useMemo(
    () =>
      Object.keys(groupedActivities).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB.getTime() - dateA.getTime();
      }),
    [groupedActivities],
  );

  const handleLoadMore = () => {
    if (continueCursor && !isDone) {
      setCursor(continueCursor);
    }
  };

  if (activities === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sortedMonths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-muted-foreground">{t("noActivity")}</p>
        </div>
      ) : (
        <>
          {sortedMonths.map((month) => (
            <div key={month} className="mb-8">
              <h2 className="mb-4 text-base font-semibold">{month}</h2>
              <div className="flex flex-col">
                {groupedActivities[month]?.map((activity) => (
                  <ActivityItem
                    key={activity._id}
                    action={activity.action}
                    entityType={activity.entityType}
                    entityId={activity.entityId}
                    userName={activity.userName}
                    userImage={activity.userImage}
                    timestamp={activity.timestamp}
                    changes={activity.changes}
                  />
                ))}
              </div>
            </div>
          ))}

          {!isDone && continueCursor && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={handleLoadMore}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
