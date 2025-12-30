"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { cn } from "@v1/ui/utils";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { FilterDropdown, type FilterOption } from "./filter-dropdown";

export interface FilterConfig {
  id: string;
  label: string;
  icon?: ReactNode;
  options: FilterOption[];
  value?: string | null;
}

interface FilterBarProps {
  filters: FilterConfig[];
  sortOptions?: { label: string; value: string }[];
  sortValue?: string;
  onFilterChange: (id: string, value: string | null) => void;
  onSortChange?: (value: string) => void;
  onReset?: () => void;
  className?: string;
  children?: ReactNode;
}

export function FilterBar({
  filters,
  sortOptions,
  sortValue,
  onFilterChange,
  onSortChange,
  onReset,
  className,
  children,
}: FilterBarProps) {
  const selectedSortLabel =
    sortOptions?.find((opt) => opt.value === sortValue)?.label ??
    sortOptions?.[0]?.label ??
    "Default";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/60 bg-zinc-950/50 px-6 py-3 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <FilterDropdown
            key={filter.id}
            label={filter.label}
            icon={filter.icon}
            value={filter.value}
            options={filter.options}
            onChange={(value) => onFilterChange(filter.id, value)}
          />
        ))}
        {children}

        {onReset && (
          <>
            <div className="mx-1 h-4 w-px bg-zinc-800" />
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Reset filters
            </button>
          </>
        )}
      </div>

      {sortOptions && onSortChange && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Sort by
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors outline-none focus-visible:text-zinc-200"
              >
                {selectedSortLabel}
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-1 gap-0.5 ring-1 ring-white/5"
            >
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer flex justify-between items-center",
                    sortValue === option.value
                      ? "bg-zinc-900 text-zinc-200"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900",
                  )}
                >
                  {option.label}
                  {sortValue === option.value && (
                    <Check className="h-3 w-3 text-indigo-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
