"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Filter } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import {
  useAcquisitionPriorityLabel,
  useAcquisitionStatusLabel,
} from "./acquisition-badges";
import { PRIORITY_FILTER_VALUES, STATUS_FILTER_VALUES } from "./types";

interface AcquisitionsFiltersProps {
  statusFilter: string;
  priorityFilter: string;
  onStatusFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
}

export function AcquisitionsFilters({
  statusFilter,
  priorityFilter,
  onStatusFilterChange,
  onPriorityFilterChange,
}: AcquisitionsFiltersProps) {
  const tLib = useScopedI18n("library");
  const tAcq = useScopedI18n("library.acquisitions");
  const getStatusLabel = useAcquisitionStatusLabel();
  const getPriorityLabel = useAcquisitionPriorityLabel();

  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {tLib("filters")}:
          </span>
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all"
                  ? tAcq("filters.allStatus")
                  : getStatusLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_FILTER_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all"
                  ? tAcq("filters.allPriorities")
                  : getPriorityLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
