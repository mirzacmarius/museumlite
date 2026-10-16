"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useListState } from "@/hooks/use-list-state";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";
import { ConditionAssessmentBoardColumn } from "./condition-assessment-board-column";
import {
  CONDITION_ASSESSMENT_STATUS_FILTERS,
  type ConditionAssessmentColumn,
  columnsForFilter,
  conditionAssessmentListState,
} from "./condition-assessment-list-state";

const STAT_COLUMNS = [
  "submitted",
  "draft",
  "accepted",
  "rejected",
] as const satisfies readonly ConditionAssessmentColumn[];

export function ConditionAssessmentsPageClient({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("conditionAssessments.board");
  const tList = useScopedI18n("listState");
  const locale = useCurrentLocale();
  const list = useListState(conditionAssessmentListState);
  const { searchInput, setSearchInput } = list;
  const counts = useQuery(api.conditionAssessments.getBoardCounts, {
    organizationId,
  });
  const statusFilter = list.state.filters.status;

  if (counts === undefined) {
    return (
      <AccessionsPageSkeleton
        actionsCount={0}
        showWorkbenchNav={false}
        statsCount={STAT_COLUMNS.length}
      />
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex min-h-[52px] flex-wrap items-center justify-between gap-6">
        <dl className="flex flex-wrap gap-4">
          {STAT_COLUMNS.map((column) => (
            <div key={column} className="flex flex-col gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`columns.${column}`)}
              </dt>
              <dd className="text-2xl font-semibold tracking-tight text-foreground">
                {formatNumber(counts[column].count, locale)}
                {counts[column].hasMore ? "+" : ""}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="flex rounded-lg bg-muted p-1">
            <legend className="sr-only">{t("filterLabel")}</legend>
            {CONDITION_ASSESSMENT_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => list.update({ filters: { status } })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  statusFilter === status
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`filters.${status}`)}
              </button>
            ))}
          </fieldset>

          <div className="group relative">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="search"
              aria-label={t("searchPlaceholder")}
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-64 rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
            />
          </div>

          {list.isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={list.clear}
            >
              {tList("clearFilters")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-6 pb-4">
          {columnsForFilter(statusFilter).map((column) => (
            <ConditionAssessmentBoardColumn
              key={column}
              organizationId={organizationId}
              column={column}
              search={list.state.search}
              total={counts[column].hasMore ? undefined : counts[column].count}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
