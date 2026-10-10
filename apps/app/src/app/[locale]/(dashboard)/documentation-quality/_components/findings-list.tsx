"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  FINDING_KINDS,
  FINDING_STATUSES,
} from "@v1/backend/convex/utils/documentationQualityValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { usePaginatedQuery } from "convex/react";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useListState } from "@/hooks/use-list-state";
import { useListReturnPath } from "@/hooks/use-return-path";
import { defineListState } from "@/lib/list-state";
import { withReturnPath } from "@/lib/return-path";
import { useScopedI18n } from "@/locales/client";
import { FindingSummary } from "./finding-summary";

const FINDING_PAGE_SIZE = 25;
const KIND_FILTERS = ["all", ...FINDING_KINDS] as const;

/** The findings list URL: status, kind and loaded depth. */
export const findingListState = defineListState({
  filters: { status: FINDING_STATUSES, kind: KIND_FILTERS },
  sorts: ["oldest"],
  pageSize: FINDING_PAGE_SIZE,
  maxDepth: FINDING_PAGE_SIZE * 20,
  search: false,
});

export function FindingsList({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("documentationQuality");
  const tList = useScopedI18n("listState");
  const list = useListState(findingListState);
  const returnPath = useListReturnPath(findingListState.keys);
  const { status, kind } = list.state.filters;
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.documentationQuality.listFindings,
    { organizationId, status, kind: kind === "all" ? undefined : kind },
    { initialNumItems: list.state.show },
  );

  const handleLoadMore = () => {
    loadMore(FINDING_PAGE_SIZE);
    list.loadMore();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FINDING_STATUSES.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            aria-pressed={status === value}
            onClick={() => list.update({ filters: { status: value } })}
          >
            {t(`statuses.${value}`)}
          </Button>
        ))}
        <Select
          value={kind}
          onValueChange={(value) => {
            const next = KIND_FILTERS.find((candidate) => candidate === value);
            if (next) list.update({ filters: { kind: next } });
          }}
        >
          <SelectTrigger className="h-8 w-56 text-xs" aria-label={t("kind")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allKinds")}</SelectItem>
            {FINDING_KINDS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`kinds.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {list.isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={list.clear}
          >
            {tList("clearFilters")}
          </Button>
        ) : null}
      </div>

      {loadStatus === "LoadingFirstPage" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {tList("loading")}
        </p>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {kind === "all"
              ? t(`findings.empty.${status}`)
              : t("findings.emptyKind", { kind: t(`kinds.${kind}`) })}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((finding) => (
            <li key={finding._id}>
              <Link
                href={withReturnPath(
                  `/documentation-quality/${finding._id}`,
                  returnPath,
                )}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {t(`kinds.${finding.kind}`)}
                    </Badge>
                    {finding.status === "open" && finding.reopenedAt ? (
                      <Badge variant="secondary">
                        {t("findings.reopened")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="break-words text-sm text-foreground">
                    <FindingSummary finding={finding} />
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {finding.status === "resolved" &&
                  finding.resolvedCheckNumber !== undefined
                    ? t("findings.resolvedBy", {
                        number: finding.resolvedCheckNumber,
                      })
                    : t("findings.detectedBy", {
                        number: finding.lastCheckNumber,
                      })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {loadStatus === "CanLoadMore" || loadStatus === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadStatus === "LoadingMore"}
            onClick={handleLoadMore}
          >
            {loadStatus === "LoadingMore"
              ? tList("loading")
              : tList("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
