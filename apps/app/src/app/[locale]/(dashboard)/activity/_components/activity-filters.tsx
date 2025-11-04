"use client";

import { Button } from "@v1/ui/button";
import { Calendar, ChevronRight } from "lucide-react";

interface ActivityFiltersProps {
  selectedEntityType: string | undefined;
  onEntityTypeChange: (type: string | undefined) => void;
  dateRange: { start?: number; end?: number };
  onDateRangeChange: (range: { start?: number; end?: number }) => void;
}

const entityTypes = [
  { value: "organization", label: "Organization" },
  { value: "collection", label: "Collection" },
  { value: "loan", label: "Loan" },
  { value: "accession", label: "Accession" },
  { value: "deaccession", label: "Deaccession" },
  { value: "location", label: "Location" },
  { value: "user", label: "User" },
];

export function ActivityFilters({
  selectedEntityType,
  onEntityTypeChange,
  dateRange,
  onDateRangeChange,
}: ActivityFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-white">Filters</h2>

      {/* Date Range Dropdown */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full justify-between border-white/10 bg-black text-white hover:bg-white/5"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/60" />
            <span className="text-sm text-white/60">All Time</span>
          </div>
          <ChevronRight className="h-4 w-4 text-white/60" />
        </Button>
      </div>

      {/* Type Filter */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center justify-between text-sm text-white/60 hover:text-white"
          onClick={() => {
            // Toggle the filter visibility
            if (selectedEntityType !== undefined) {
              onEntityTypeChange(undefined);
            } else {
              // Show first option by default when opening
              onEntityTypeChange(entityTypes[0]?.value);
            }
          }}
        >
          <span>Type</span>
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              selectedEntityType !== undefined ? "rotate-90" : ""
            }`}
          />
        </button>
        {selectedEntityType !== undefined && (
          <div className="ml-4 flex flex-col gap-1">
            {entityTypes.map((type) => (
              <button
                type="button"
                key={type.value}
                className={`text-left text-sm hover:text-white ${
                  selectedEntityType === type.value
                    ? "text-white font-medium"
                    : "text-white/60"
                }`}
                onClick={() =>
                  onEntityTypeChange(
                    selectedEntityType === type.value ? undefined : type.value,
                  )
                }
              >
                {type.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
