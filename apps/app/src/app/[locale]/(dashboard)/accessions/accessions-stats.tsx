"use client";

import { cn } from "@v1/ui/utils";
import { parseAsString, useQueryState } from "nuqs";
import { useScopedI18n } from "@/locales/client";

type AccessionsStatsData = {
  pending: number;
  approved: number;
  rejected: number;
  withdrawn: number;
};

type AccessionsStatsProps = {
  stats: AccessionsStatsData;
};

export function AccessionsStats({ stats }: AccessionsStatsProps) {
  const t = useScopedI18n("accessions");
  const tReview = useScopedI18n("accessionReview.board");
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault(""),
  );
  const showingWithdrawn = statusFilter === "withdrawn";

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("stats.pending")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.pending}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("stats.approved")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.approved}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("status.rejected")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.rejected}
        </span>
      </div>
      <button
        type="button"
        aria-pressed={showingWithdrawn}
        onClick={() =>
          void setStatusFilter(showingWithdrawn ? null : "withdrawn")
        }
        className={cn(
          "-m-1 flex flex-col gap-1 rounded-md p-1 text-left transition-colors hover:bg-accent/50",
          showingWithdrawn && "bg-accent/60",
        )}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground underline decoration-dotted underline-offset-4">
          {tReview("withdrawn")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.withdrawn}
        </span>
      </button>
    </div>
  );
}
