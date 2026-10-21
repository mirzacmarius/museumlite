"use client";

import { Input } from "@v1/ui/input";
import { Highlight, HighlightScope } from "@v1/ui/motion-highlight";
import { cn } from "@v1/ui/utils";
import { Search } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import type { LoanStatus, LoanType } from "./types";

const SEGMENT_CLASS_NAME =
  "relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all";
const SEGMENT_IDLE_CLASS_NAME = "text-muted-foreground hover:text-foreground";

interface LoanListFiltersProps {
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
  onShowAll: () => void;
  onStatusFilterChange: (status: LoanStatus) => void;
  onTypeFilterChange: (type: LoanType) => void;
  onSearchQueryChange: (query: string) => void;
}

export function LoanListFilters({
  statusFilter,
  typeFilter,
  searchQuery,
  onShowAll,
  onStatusFilterChange,
  onTypeFilterChange,
  onSearchQueryChange,
}: LoanListFiltersProps) {
  const t = useScopedI18n("loans");
  // One of these is on at most; Pending is an independent toggle beside them.
  const directionFilters = [
    {
      label: t("filters.allLoans"),
      pressed: typeFilter === "all" && statusFilter === "all",
      onClick: onShowAll,
    },
    {
      label: t("filters.outgoing"),
      pressed: typeFilter === "outgoing",
      onClick: () => onTypeFilterChange("outgoing"),
    },
    {
      label: t("filters.incoming"),
      pressed: typeFilter === "incoming",
      onClick: () => onTypeFilterChange("incoming"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="isolate flex min-w-max self-start rounded-lg bg-muted p-1">
          <HighlightScope>
            {directionFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={filter.onClick}
                aria-pressed={filter.pressed}
                className={cn(
                  SEGMENT_CLASS_NAME,
                  !filter.pressed && SEGMENT_IDLE_CLASS_NAME,
                )}
              >
                {filter.pressed && <Highlight className="bg-card shadow-sm" />}
                {filter.label}
              </button>
            ))}
          </HighlightScope>
          <button
            type="button"
            onClick={() =>
              onStatusFilterChange(
                statusFilter === "pending" ? "all" : "pending",
              )
            }
            aria-pressed={statusFilter === "pending"}
            className={cn(
              SEGMENT_CLASS_NAME,
              statusFilter === "pending"
                ? "bg-card shadow-sm"
                : SEGMENT_IDLE_CLASS_NAME,
            )}
          >
            {t("filters.pending")}
          </button>
        </div>
      </div>

      <div className="flex items-center">
        <div className="group relative w-full sm:w-auto">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search
              aria-hidden="true"
              className="size-3.5 text-muted-foreground transition-colors group-focus-within:text-cyan-500"
            />
          </div>
          <Input
            type="text"
            aria-label={t("searchLabel")}
            className="block w-full rounded-lg border border-border/60 bg-card p-2 pl-9 text-xs outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 sm:w-48"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
