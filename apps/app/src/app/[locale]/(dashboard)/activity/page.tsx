"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { useOrganization } from "@/components/organization-provider";
import { useState } from "react";
import { ActivityFilters } from "./_components/activity-filters";
import { ActivityList } from "./_components/activity-list";

export default function ActivityPage() {
  const { currentOrganizationId, isLoading } = useOrganization();
  const [selectedEntityType, setSelectedEntityType] = useState<
    string | undefined
  >();
  const [dateRange, setDateRange] = useState<{ start?: number; end?: number }>(
    {},
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-white/10 bg-black p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Please select an organization from the dropdown above to view
              activity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-black px-6 py-8">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        {/* Left Filters Panel */}
        <div className="flex w-64 flex-shrink-0 flex-col">
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
