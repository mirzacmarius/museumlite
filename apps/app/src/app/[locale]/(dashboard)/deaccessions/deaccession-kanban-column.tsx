"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { ScrollArea } from "@v1/ui/scroll-area";
import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import {
  Archive,
  CheckCircle,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { ClientDateFns } from "@/components/client-date";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DEACCESSION_COLUMN_PAGE_SIZE } from "./deaccession-list-state";

export type DeaccessionBoardColumn = FunctionArgs<
  typeof api.deaccessions.listBoardColumn
>["column"];

type DeaccessionKanbanColumnProps = {
  organizationId: Id<"organizations">;
  column: DeaccessionBoardColumn;
  roleName?: string;
  search: string;
  stepName: string;
  /** Exact column total; undefined while counts load. */
  total?: number;
  returnPath: string;
};

const stepDotStyles: Record<number, string> = {
  1: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  2: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
  3: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
  4: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]",
};

const DEFAULT_DOT_STYLE = "bg-muted-foreground";

function getColumnDotStyle(column: DeaccessionBoardColumn): string {
  if (column.kind === "approved") {
    return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
  }
  if (column.kind === "rejected") {
    return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";
  }
  return (
    stepDotStyles[column.step] ??
    stepDotStyles[((column.step - 1) % 4) + 1] ??
    DEFAULT_DOT_STYLE
  );
}

function getColumnIcon(column: DeaccessionBoardColumn) {
  if (column.kind === "approved") return <CheckCircle className="size-4" />;
  if (column.kind === "rejected") return <XCircle className="size-4" />;
  if (column.step === 1) return <Clock className="size-4" />;
  if (column.step === 2) return <Archive className="size-4" />;
  return <ShieldCheck className="size-4" />;
}

function formatTargetStatus(
  targetCollectionStatus: "deaccessioned" | "archived" | "deleted",
) {
  switch (targetCollectionStatus) {
    case "deaccessioned":
      return "Deaccession";
    case "archived":
      return "Archived";
    case "deleted":
      return "Deleted";
  }
}

export function DeaccessionKanbanColumn({
  organizationId,
  column,
  roleName,
  search,
  stepName,
  total,
  returnPath,
}: DeaccessionKanbanColumnProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("deaccessions");
  const tList = useScopedI18n("listState");
  const dotStyle = getColumnDotStyle(column);
  const icon = getColumnIcon(column);
  const trimmedSearch = search.trim();
  const { results, status, loadMore } = usePaginatedQuery(
    api.deaccessions.listBoardColumn,
    { organizationId, column, search: trimmedSearch || undefined },
    { initialNumItems: DEACCESSION_COLUMN_PAGE_SIZE },
  );
  const countLabel = trimmedSearch
    ? tList("matchesShown", { shown: results.length })
    : total === undefined
      ? String(results.length)
      : tList("shownOfTotal", { shown: results.length, total });

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {stepName}
          {roleName ? (
            <span className="ml-1 text-muted-foreground/85">({roleName})</span>
          ) : null}
        </span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-muted-foreground">
          {countLabel}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border/60 bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {status === "LoadingFirstPage" ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {tList("loading")}
              </p>
            ) : results.length === 0 && status === "Exhausted" ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-muted-foreground">{icon}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {trimmedSearch
                    ? tList("noMatch.title")
                    : t("table.noResults")}
                </p>
              </div>
            ) : (
              results.map((item) => (
                <Link
                  key={item._id}
                  href={withReturnPath(`/deaccessions/${item._id}`, returnPath)}
                  className="group block cursor-pointer rounded-lg border border-border bg-background/70 p-3 transition-colors hover:border-ring/60 hover:bg-accent/50"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.deaccessionNumber}
                      </p>
                      {item.accessionNumber ? (
                        <p className="truncate text-[10px] text-muted-foreground/80">
                          {item.accessionNumber}
                        </p>
                      ) : null}
                    </div>
                    <div className={`size-1.5 rounded-full ${dotStyle}`} />
                  </div>

                  <p className="mb-1 line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {item.collectionTitle}
                  </p>
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                    {item.reason}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">
                      {column.kind === "approved"
                        ? formatTargetStatus(item.targetCollectionStatus)
                        : t(`method.${item.method}`)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      <ClientDateFns
                        timestamp={item.dateDeaccessioned}
                        format="MMM d, yyyy"
                        locale={locale}
                      />
                    </span>
                  </div>
                </Link>
              ))
            )}
            {status === "CanLoadMore" || status === "LoadingMore" ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(DEACCESSION_COLUMN_PAGE_SIZE)}
              >
                {status === "LoadingMore"
                  ? tList("loading")
                  : tList("loadMore")}
              </Button>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
