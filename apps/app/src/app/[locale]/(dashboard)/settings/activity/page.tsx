"use client";

import { useOrganization } from "@/components/organization-provider";
import { useState } from "react";
import { ActivityFilters } from "../../activity/_components/activity-filters";
import { ActivityList } from "../../activity/_components/activity-list";

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
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view
              activity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Filters at the top */}
      <div className="mb-6">
        <ActivityFilters
          selectedEntityType={selectedEntityType}
          onEntityTypeChange={setSelectedEntityType}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Activity List below filters */}
      <div className="flex flex-1 flex-col">
        <ActivityList
          organizationId={currentOrganizationId}
          entityType={selectedEntityType}
          startDate={dateRange.start}
          endDate={dateRange.end}
        />
      </div>
    </div>
  );
}
