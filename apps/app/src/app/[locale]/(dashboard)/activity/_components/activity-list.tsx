"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ActivityItem } from "./activity-item";

interface ActivityListProps {
  organizationId: Id<"organizations">;
  entityType?: string;
  startDate?: number;
  endDate?: number;
}

type Activity = FunctionReturnType<
  typeof api.audit.activityPage
>["page"][number];

function groupByMonth(activities: Activity[], locale: string) {
  const groups: Record<string, Activity[]> = {};

  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    const monthKey = formatDate(date, locale, {
      month: "long",
      year: "numeric",
    });

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
  const locale = useCurrentLocale();
  const t = useScopedI18n("activity");
  const common = useScopedI18n("common");
  const {
    results: allActivities,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.audit.activityPage,
    {
      organizationId,
      entityType,
      startDate,
      endDate,
    },
    { initialNumItems: 50 },
  );

  const groupedActivities = useMemo(
    () => groupByMonth(allActivities, locale),
    [allActivities, locale],
  );

  const sortedMonths = Object.keys(groupedActivities);

  if (status === "LoadingFirstPage")
    return <p className="text-muted-foreground">{common("loading")}</p>;

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
                    timestamp={activity.timestamp}
                    changes={activity.changes}
                    subjectLabel={
                      activity.subjectSnapshot?.label ??
                      activity.subjectSnapshot?.identifier
                    }
                  />
                ))}
              </div>
            </div>
          ))}

          {status !== "Exhausted" && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                disabled={status !== "CanLoadMore"}
                onClick={() => loadMore(50)}
              >
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
