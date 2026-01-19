"use client";

import { formatDateFns } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
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

interface ActivityFiltersProps {
  selectedEntityType: string | undefined;
  onEntityTypeChange: (type: string | undefined) => void;
  dateRange: { start?: number; end?: number };
  onDateRangeChange: (range: { start?: number; end?: number }) => void;
}

function getDateRangeLabel(
  dateRange: {
    start?: number;
    end?: number;
  },
  t: ReturnType<typeof useScopedI18n<"activity">>,
  locale: string,
): string {
  if (!dateRange.start && !dateRange.end) {
    return t("dateRangePresets.allTime");
  }
  if (dateRange.start && dateRange.end) {
    const start = formatDateFns(new Date(dateRange.start), "MMM d", locale);
    const end = formatDateFns(new Date(dateRange.end), "MMM d, yyyy", locale);
    return t("dateRangePresets.range", { start, end });
  }
  if (dateRange.start) {
    const date = formatDateFns(
      new Date(dateRange.start),
      "MMM d, yyyy",
      locale,
    );
    return t("dateRangePresets.from", { date });
  }
  if (dateRange.end) {
    const date = formatDateFns(new Date(dateRange.end), "MMM d, yyyy", locale);
    return t("dateRangePresets.until", { date });
  }
  return t("dateRangePresets.allTime");
}

export function ActivityFilters({
  selectedEntityType,
  onEntityTypeChange,
  dateRange,
  onDateRangeChange,
}: ActivityFiltersProps) {
  const t = useScopedI18n("activity");
  const locale = useCurrentLocale();
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [dateRangePicker, setDateRangePicker] = useState<DateRange | undefined>(
    dateRange.start || dateRange.end
      ? {
          from: dateRange.start ? new Date(dateRange.start) : undefined,
          to: dateRange.end ? new Date(dateRange.end) : undefined,
        }
      : undefined,
  );

  const entityTypes = [
    { value: "organization", label: t("entityTypes.organization") },
    { value: "collection", label: t("entityTypes.collection") },
    { value: "loan", label: t("entityTypes.loan") },
    { value: "accession", label: t("entityTypes.accession") },
    { value: "deaccession", label: t("entityTypes.deaccession") },
    { value: "location", label: t("entityTypes.location") },
    { value: "user", label: t("entityTypes.user") },
  ];

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
      <h2 className="text-base font-semibold">{t("filters.title")}</h2>

      {/* Date Range Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="text-sm">
                {getDateRangeLabel(dateRange, t, locale)}
              </span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handlePresetRange("today")}>
            {t("dateRangePresets.today")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("last7days")}>
            {t("dateRangePresets.last7days")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("last30days")}>
            {t("dateRangePresets.last30days")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("last90days")}>
            {t("dateRangePresets.last90days")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetRange("alltime")}>
            {t("dateRangePresets.allTime")}
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
                {t("dateRangePresets.customRange")}
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
          <span>{t("filters.type")}</span>
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
