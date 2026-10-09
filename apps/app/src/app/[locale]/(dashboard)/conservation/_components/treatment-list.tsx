"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Box, Calendar, Search, User, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { GridCardsSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useDebouncedSearch, useListState } from "@/hooks/use-list-state";
import { useListReturnPath } from "@/hooks/use-return-path";
import { formatDate } from "@/lib/format-date";
import { defineListState } from "@/lib/list-state";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

const TREATMENT_PAGE_SIZE = 24;

const TREATMENT_TYPES = [
  "routine",
  "stabilization",
  "restoration",
  "cleaning",
  "repair",
  "assessment",
  "other",
] as const;

/** The conservation list URL: title search, treatment type, loaded depth. */
export const treatmentListState = defineListState({
  filters: { type: ["all", ...TREATMENT_TYPES] },
  sorts: ["newest"],
  pageSize: TREATMENT_PAGE_SIZE,
  maxDepth: TREATMENT_PAGE_SIZE * 10,
});

type TreatmentListItem = FunctionReturnType<
  typeof api.conservationTreatments.listPage
>["page"][number];

export function TreatmentList({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("conservation");
  const tList = useScopedI18n("listState");
  const list = useListState(treatmentListState);
  const updateList = list.update;
  const [searchInput, setSearchInput] = useDebouncedSearch(
    list.state.search,
    useCallback((search: string) => updateList({ search }), [updateList]),
  );
  const returnPath = useListReturnPath(treatmentListState.keys);
  const selectedType = list.state.filters.type;
  const search = list.state.search.trim();
  const counts = useQuery(api.conservationTreatments.getListCounts, {
    organizationId,
  });
  const { results, status, loadMore } = usePaginatedQuery(
    api.conservationTreatments.listPage,
    {
      organizationId,
      treatmentType: selectedType === "all" ? undefined : selectedType,
      search: search || undefined,
    },
    { initialNumItems: list.state.show },
  );

  const total =
    counts === undefined
      ? undefined
      : selectedType === "all"
        ? counts.total
        : (counts.byType.find((entry) => entry.treatmentType === selectedType)
            ?.count ?? 0);
  const typeOptions = TREATMENT_TYPES.flatMap((type) => {
    const count =
      counts?.byType.find((entry) => entry.treatmentType === type)?.count ?? 0;
    return count > 0 || type === selectedType ? [{ type, count }] : [];
  });

  const handleLoadMore = () => {
    loadMore(TREATMENT_PAGE_SIZE);
    list.loadMore();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t("searchPlaceholder")}
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TypeChip
            label={tList("allTypes")}
            count={counts?.total}
            selected={selectedType === "all"}
            onSelect={() => list.update({ filters: { type: "all" } })}
          />
          {typeOptions.map(({ type, count }) => (
            <TypeChip
              key={type}
              label={t(`treatmentTypes.${type}`)}
              count={count}
              selected={selectedType === type}
              onSelect={() => list.update({ filters: { type } })}
            />
          ))}
          {list.isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={list.clear}
            >
              {tList("clearFilters")}
            </Button>
          ) : null}
        </div>
        {status !== "LoadingFirstPage" && results.length > 0 ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {search
              ? tList("matchesShown", { shown: results.length })
              : total === undefined
                ? null
                : tList("shownOfTotal", { shown: results.length, total })}
          </p>
        ) : null}
      </div>

      {status === "LoadingFirstPage" ? (
        <GridCardsSkeleton count={6} />
      ) : results.length === 0 && status === "Exhausted" ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Wrench className="size-12 text-muted-foreground" />
          {list.isFiltered ? (
            <div className="text-center">
              <p className="text-muted-foreground">{tList("noMatch.title")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {tList("noMatch.description")}
              </p>
              <Button variant="outline" className="mt-4" onClick={list.clear}>
                {tList("clearFilters")}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground">{t("noTreatmentsFound")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("createFirstRecord")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((treatment) => (
            <TreatmentCard
              key={treatment._id}
              treatment={treatment}
              href={withReturnPath(
                `/conservation/${treatment._id}`,
                returnPath,
              )}
            />
          ))}
        </div>
      )}

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={handleLoadMore}
          >
            {status === "LoadingMore" ? tList("loading") : tList("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TypeChip({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        selected
          ? "border-cyan-500/60 bg-cyan-500/10 text-foreground"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {count === undefined ? null : (
        <span className="ml-1.5 tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

const TREATMENT_TYPE_STYLES: Record<string, string> = {
  routine: "bg-muted text-muted-foreground border-border",
  stabilization: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  restoration: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  cleaning: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  repair: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  assessment: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

function TreatmentCard({
  treatment,
  href,
}: {
  treatment: TreatmentListItem;
  href: string;
}) {
  const locale = useCurrentLocale();
  const typeStyle =
    TREATMENT_TYPE_STYLES[treatment.treatmentType] ||
    TREATMENT_TYPE_STYLES.other;
  const performedAt = formatDate(new Date(treatment.performedAt), locale);

  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:bg-muted/80 hover:border-border hover:shadow-lg hover:shadow-black/30"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${typeStyle}`}
          >
            {treatment.treatmentType}
          </span>
        </div>

        <div>
          <h3 className="font-semibold text-foreground group-hover:text-white line-clamp-2">
            {treatment.title}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {treatment.description}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span>{performedAt}</span>
          </div>
          {treatment.performedByName && (
            <div className="flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              <span>{treatment.performedByName}</span>
            </div>
          )}
        </div>
      </div>

      {treatment.collectionTitle && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors">
          <Box className="size-3.5" />
          <span className="truncate">{treatment.collectionTitle}</span>
        </div>
      )}
    </Link>
  );
}
