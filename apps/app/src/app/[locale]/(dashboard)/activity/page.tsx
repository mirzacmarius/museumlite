"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { Suspense } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { ActivityFilters } from "./_components/activity-filters";
import { ActivityList } from "./_components/activity-list";
import { ActivityPageSkeleton } from "./activity-page-skeleton";

function ActivityPageContent() {
  const t = useScopedI18n("activity");
  const { currentOrganizationId, isLoading } = useOrganization();
  const [filters, setFilters] = useQueryStates(
    { entityType: parseAsString, start: parseAsInteger, end: parseAsInteger },
    { history: "push" },
  );
  const selectedEntityType = filters.entityType ?? undefined;
  const dateRange = {
    start: filters.start ?? undefined,
    end: filters.end ?? undefined,
  };
  const setSelectedEntityType = (type: string | undefined) => {
    void setFilters({ entityType: type ?? null });
  };
  const setDateRange = (range: { start?: number; end?: number }) => {
    void setFilters({ start: range.start ?? null, end: range.end ?? null });
  };

  if (isLoading) {
    return <ActivityPageSkeleton />;
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-white/10 bg-zinc-950 p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">
              {t("selectOrganization")}
            </h3>
            <p className="mt-2 text-sm text-white/60">
              {t("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-zinc-950 px-6 py-8">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 md:flex-row md:gap-12">
        {/* Left Filters Panel */}
        <div className="flex w-full flex-shrink-0 flex-col md:w-64">
          <ActivityFilters
            selectedEntityType={selectedEntityType}
            onEntityTypeChange={setSelectedEntityType}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* Right Activity List */}
        <div className="flex flex-1 flex-col">
          <ActivityList
            organizationId={currentOrganizationId}
            entityType={selectedEntityType}
            startDate={dateRange.start}
            endDate={dateRange.end}
          />
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<ActivityPageSkeleton />}>
      <ActivityPageContent />
    </Suspense>
  );
}
