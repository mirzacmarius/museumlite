"use client";

import { Button } from "@v1/ui/button";
import { Calendar } from "@v1/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";

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

function getDateRangeLabel(dateRange: { start?: number; end?: number }): string {
  if (!dateRange.start && !dateRange.end) {
    return "All Time";
  }
  if (dateRange.start && dateRange.end) {
    const start = format(new Date(dateRange.start), "MMM d");
    const end = format(new Date(dateRange.end), "MMM d, yyyy");
    return `${start} - ${end}`;
  }
  if (dateRange.start) {
    return `From ${format(new Date(dateRange.start), "MMM d, yyyy")}`;
  }
  if (dateRange.end) {
    return `Until ${format(new Date(dateRange.end), "MMM d, yyyy")}`;
  }
  return "All Time";
}

export function ActivityFilters({
  selectedEntityType,
  onEntityTypeChange,
  dateRange,
  onDateRangeChange,
}: ActivityFiltersProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [dateRangePicker, setDateRangePicker] = useState<DateRange | undefined>(
    dateRange.start || dateRange.end
      ? {
          from: dateRange.start ? new Date(dateRange.start) : undefined,
          to: dateRange.end ? new Date(dateRange.end) : undefined,
        }
      : undefined,
  );

  useEffect(() => {
    setDateRangePicker(
      dateRange.start || dateRange.end
        ? {
            from: dateRange.start ? new Date(dateRange.start) : undefined,
            to: dateRange.end ? new Date(dateRange.end) : undefined,
          }
        : undefined,
    );
  }, [dateRange]);

  const handlePresetRange = (preset: string) => {
    const now = Date.now();
    let start: number | undefined;
    let end: number | undefined = now;

    switch (preset) {
      case "today": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start = today.getTime();
        end = now;
        break;
      }
      case "last7days": {
        start = now - 7 * 24 * 60 * 60 * 1000;
        break;
      }
      case "last30days": {
        start = now - 30 * 24 * 60 * 60 * 1000;
        break;
      }
      case "last90days": {
        start = now - 90 * 24 * 60 * 60 * 1000;
        break;
      }
      default: {
        start = undefined;
        end = undefined;
        break;
      }
    }

    onDateRangeChange({ start, end });
    setDateRangePicker(
      start || end
        ? {
            from: start ? new Date(start) : undefined,
            to: end ? new Date(end) : undefined,
          }
        : undefined,
    );
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setDateRangePicker(range);
    if (range?.from && range?.to) {
      const startDate = new Date(range.from);
      startDate.setHours(0, 0, 0, 0);
      const start = startDate.getTime();

      const endDate = new Date(range.to);
      endDate.setHours(23, 59, 59, 999);
      const end = endDate.getTime();

      onDateRangeChange({ start, end });
      setCustomRangeOpen(false);
    } else if (range?.from && !range?.to) {
      const startDate = new Date(range.from);
      startDate.setHours(0, 0, 0, 0);
      const start = startDate.getTime();
      onDateRangeChange({ start, end: Date.now() });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <h2 className="text-base font-semibold">Filters</h2>

      {/* Date Range Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="text-sm">{getDateRangeLabel(dateRange)}</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handlePresetRange("today")}>
            Today
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("last7days")}>
            Last 7 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("last30days")}>
            Last 30 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("last90days")}>
            Last 90 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("alltime")}>
            All Time
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setCustomRangeOpen(true);
                }}
              >
                Custom Range
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRangePicker}
                onSelect={handleCustomRangeSelect}
                numberOfMonths={2}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Type Filter */}
      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
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
          <div className="absolute left-0 top-full z-10 mt-2 flex flex-col gap-1 rounded-md border bg-popover p-2 shadow-lg">
            {entityTypes.map((type) => (
              <button
                type="button"
                key={type.value}
                className={`rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                  selectedEntityType === type.value
                    ? "bg-accent font-medium"
                    : ""
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
