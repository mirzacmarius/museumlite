"use client";

import { useScopedI18n } from "@/locales/client";
import { Input } from "@v1/ui/input";
import { Search } from "lucide-react";
import type { LoanStatus, LoanType } from "./types";

interface LoanListFiltersProps {
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
  onStatusFilterChange: (status: LoanStatus) => void;
  onTypeFilterChange: (type: LoanType) => void;
  onSearchQueryChange: (query: string) => void;
}

export function LoanListFilters({
  statusFilter,
  typeFilter,
  searchQuery,
  onStatusFilterChange,
  onTypeFilterChange,
  onSearchQueryChange,
}: LoanListFiltersProps) {
  const t = useScopedI18n("loans");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max self-start rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => onTypeFilterChange("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              typeFilter === "all"
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("filters.allLoans")}
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange("outgoing")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              typeFilter === "outgoing"
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("filters.outgoing")}
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange("incoming")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              typeFilter === "incoming"
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("filters.incoming")}
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("pending")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === "pending"
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("filters.pending")}
          </button>
        </div>
      </div>

      <div className="flex items-center">
        <div className="group relative w-full sm:w-auto">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="size-3.5 text-muted-foreground transition-colors group-focus-within:text-cyan-500" />
          </div>
          <Input
            type="text"
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
