"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useScopedI18n } from "@/locales/client";

type Discrepancy = FunctionReturnType<
  typeof api.projections.listDiscrepancies
>["page"][number];
type Translate = ReturnType<typeof useScopedI18n<"projectionHealth">>;

const SOURCE_ROUTES: Record<string, string> = {
  collections: "/objects",
  loans: "/loans",
  exhibitions: "/exhibitions",
  locations: "/locations",
  accessions: "/accessions",
  deaccessions: "/deaccessions",
};

const PAGE_SIZE = 25;

function categoryLabel(category: Discrepancy["category"], t: Translate) {
  switch (category) {
    case "contribution_mismatch":
      return t("categories.contribution_mismatch");
    case "missing_from_projection":
      return t("categories.missing_from_projection");
    case "stale_projection_entry":
      return t("categories.stale_projection_entry");
    case "counter_mismatch":
      return t("categories.counter_mismatch");
    case "legacy_counter_mismatch":
      return t("categories.legacy_counter_mismatch");
    case "source_quality":
      return t("categories.source_quality");
  }
}

function SourceReference({ discrepancy }: { discrepancy: Discrepancy }) {
  const t = useScopedI18n("projectionHealth");
  const { sourceTable, sourceId } = discrepancy;
  if (!sourceTable || !sourceId) return null;
  const route = SOURCE_ROUTES[sourceTable];
  const label = `${sourceTable} ${sourceId}`;
  return route ? (
    <Link
      href={`${route}/${sourceId}`}
      className="font-mono text-xs underline underline-offset-4"
    >
      {t("discrepancies.review", { source: label })}
    </Link>
  ) : (
    <span className="font-mono text-xs text-muted-foreground">{label}</span>
  );
}

function formatCount(value: number | null, t: Translate) {
  return value === null ? t("discrepancies.none") : String(value);
}

export function ProjectionDiscrepancies({
  organizationId,
  generationId,
}: {
  organizationId: Id<"organizations">;
  generationId: Id<"projectionGenerations">;
}) {
  const t = useScopedI18n("projectionHealth");
  const { results, status, loadMore } = usePaginatedQuery(
    api.projections.listDiscrepancies,
    { organizationId, generationId },
    { initialNumItems: PAGE_SIZE },
  );
  return (
    <div className="mt-3 flex flex-col gap-2">
      <ul className="divide-y divide-white/10">
        {results.map((discrepancy) => (
          <li key={discrepancy._id} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {categoryLabel(discrepancy.category, t)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("discrepancies.counts", {
                  expected: formatCount(discrepancy.expected, t),
                  actual: formatCount(discrepancy.actual, t),
                })}
              </span>
            </div>
            {discrepancy.metric ? (
              <span className="font-mono text-xs text-muted-foreground">
                {discrepancy.scope
                  ? `${discrepancy.metric} · ${discrepancy.scope}`
                  : discrepancy.metric}
              </span>
            ) : null}
            <SourceReference discrepancy={discrepancy} />
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {t("discrepancies.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
