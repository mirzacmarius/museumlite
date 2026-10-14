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
  FileEdit,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { withReturnPath } from "@/lib/return-path";
import { useI18n, useScopedI18n } from "@/locales/client";
import { formatAccessionMethodLabel } from "./[id]/_components/accession-detail-ui";
import { ApprovedLogEntry, accessionBoardText } from "./approved-log-entry";

export type AccessionBoardColumn = FunctionArgs<
  typeof api.accessions.listBoardColumn
>["column"];

type KanbanColumnProps = {
  organizationId: Id<"organizations">;
  column: AccessionBoardColumn;
  stepName: string;
  roleName?: string;
  searchQuery: string;
  /** Exact column total; undefined while counts load. */
  total?: number;
  /** The board view to return to from an accession. */
  returnPath: string;
};

const PAGE_SIZE = 25;
const APPROVED_LOG_PAGE_SIZE = 10;

const stepDotStyles: Record<number, string> = {
  0: "bg-zinc-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]",
  1: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  2: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
  3: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
  4: "bg-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]",
  [-1]: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
};

const DEFAULT_DOT_STYLE = "bg-muted-foreground";
const WITHDRAWN_DOT_STYLE = "bg-zinc-600";

function getStepDotStyle(stepNumber: number): string {
  const direct = stepDotStyles[stepNumber];
  if (direct) return direct;

  const modulo = stepDotStyles[stepNumber % 5];
  if (modulo) return modulo;

  return DEFAULT_DOT_STYLE;
}

function getStepIcon(stepNumber: number) {
  if (stepNumber === 0) return <FileEdit className="size-4" />;
  if (stepNumber === -1) return <CheckCircle className="size-4" />;
  if (stepNumber === 1) return <Clock className="size-4" />;
  if (stepNumber === 2) return <Search className="size-4" />;
  return <ShieldCheck className="size-4" />;
}

function getColumnDotStyle(column: AccessionBoardColumn): string {
  if (column.kind === "withdrawn") return WITHDRAWN_DOT_STYLE;
  return getStepDotStyle(column.kind === "approved" ? -1 : column.step);
}

function getColumnIcon(column: AccessionBoardColumn) {
  if (column.kind === "withdrawn") return <Archive className="size-4" />;
  return getStepIcon(column.kind === "approved" ? -1 : column.step);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function KanbanColumn({
  organizationId,
  column,
  stepName,
  roleName,
  searchQuery,
  total,
  returnPath,
}: KanbanColumnProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("accessions");

  const dotStyle = getColumnDotStyle(column);
  const icon = getColumnIcon(column);
  const search = searchQuery.trim();
  const isApprovedLog = column.kind === "approved";
  const pageSize = isApprovedLog ? APPROVED_LOG_PAGE_SIZE : PAGE_SIZE;
  const { results, status, loadMore } = usePaginatedQuery(
    api.accessions.listBoardColumn,
    {
      organizationId,
      column,
      search: search || undefined,
    },
    { initialNumItems: pageSize },
  );
  const isLoadingFirstPage = status === "LoadingFirstPage";
  const countLabel = search
    ? t("kanban.matchesShown", { loaded: results.length })
    : total === undefined
      ? String(results.length)
      : t("kanban.shownOfTotal", { loaded: results.length, total });

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {stepName}
          {roleName && (
            <span className="ml-1 text-muted-foreground/85">({roleName})</span>
          )}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {countLabel}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border/60 bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {isLoadingFirstPage ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {t("kanban.loading")}
              </p>
            ) : results.length === 0 && status === "Exhausted" ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-muted-foreground">{icon}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {search
                    ? t("kanban.noMatches", { step: stepName.toLowerCase() })
                    : t("kanban.noAccessions", {
                        step: stepName.toLowerCase(),
                      })}
                </p>
              </div>
            ) : isApprovedLog ? (
              <ol className="flex flex-col divide-y divide-border/60">
                {results.map((accession) => (
                  <ApprovedLogEntry
                    key={accession._id}
                    accession={accession}
                    href={withReturnPath(
                      `/accessions/${accession._id}`,
                      returnPath,
                    )}
                  />
                ))}
              </ol>
            ) : (
              results.map((accession) => {
                const text = accessionBoardText(
                  accession,
                  t("kanban.unknownSource"),
                  (method) => formatAccessionMethodLabel(method, tRoot),
                );
                return (
                  <Link
                    key={accession._id}
                    href={withReturnPath(
                      `/accessions/${accession._id}`,
                      returnPath,
                    )}
                    className="group block cursor-pointer rounded-lg border border-border bg-background/70 p-3 transition-colors hover:border-ring/60 hover:bg-accent/50"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {accession.accessionNumber}
                      </span>
                      <div className={`size-1.5 rounded-full ${dotStyle}`} />
                    </div>
                    <p className="mb-1 line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                      {text.title}
                    </p>
                    <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                      {text.detail}
                    </p>
                    {accession.assigneeName && (
                      <div className="flex items-center gap-2">
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[9px] text-primary">
                          {getInitials(accession.assigneeName)}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {accession.assigneeName}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
            {status === "CanLoadMore" || status === "LoadingMore" ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(pageSize)}
              >
                {status === "LoadingMore"
                  ? t("kanban.loading")
                  : isApprovedLog
                    ? t("kanban.showMore")
                    : t("kanban.loadMore")}
              </Button>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
