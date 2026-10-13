"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Briefcase, ClipboardCheck, ListTodo, ScrollText } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { CaseTaskTile } from "@/components/case-tasks/case-task-card";
import { caseHref } from "@/components/case-tasks/case-task-links";
import { ClientDate } from "@/components/client-date";
import { usePermissions } from "@/components/permission-gate";
import { ProvenanceReviewQueue } from "@/components/provenance/provenance-review-queue";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

const PAGE_SIZE = 20;

export const CARD_GRID_CLASS_NAME =
  "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2";

export const CARD_CLASS_NAME =
  "flex h-full min-w-0 items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50";

export function WorkSection({
  icon,
  title,
  badge,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h2 className="truncate text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WorkBoard({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @6xl:grid-cols-4">
      {children}
    </div>
  );
}

export function BoardColumn({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-muted/20">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        {icon}
        <h2 className="min-w-0 flex-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </header>
      <div className="max-h-[28rem] min-h-24 overflow-y-auto p-2 custom-scrollbar">
        {children}
      </div>
    </section>
  );
}

export function ColumnMessage({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export const COLUMN_LIST_CLASS_NAME = "flex flex-col gap-2";

function TaskColumn({
  organizationId,
  query,
  icon,
  title,
  emptyLabel,
}: {
  organizationId: Id<"organizations">;
  query: typeof api.caseTasks.listMyWork | typeof api.caseTasks.listReviewQueue;
  icon: ReactNode;
  title: string;
  emptyLabel: string;
}) {
  const t = useScopedI18n("caseTasks.myWork");
  const [now] = useState(() => Date.now());
  const { results, status, loadMore } = usePaginatedQuery(
    query,
    { organizationId },
    { initialNumItems: PAGE_SIZE },
  );
  const loading = status === "LoadingFirstPage";
  return (
    <BoardColumn
      icon={icon}
      title={title}
      count={
        loading
          ? undefined
          : `${results.length}${status === "CanLoadMore" ? "+" : ""}`
      }
    >
      {loading ? (
        <ColumnMessage>{t("loading")}</ColumnMessage>
      ) : results.length === 0 ? (
        <ColumnMessage>{emptyLabel}</ColumnMessage>
      ) : (
        <div className="space-y-2">
          <ul className={COLUMN_LIST_CLASS_NAME}>
            {results.map((task) => (
              <CaseTaskTile key={task._id} task={task} now={now} />
            ))}
          </ul>
          {status === "CanLoadMore" ? (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => loadMore(PAGE_SIZE)}
            >
              {t("loadMore")}
            </Button>
          ) : null}
        </div>
      )}
    </BoardColumn>
  );
}

export function MyTasksColumn({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks.myWork");
  return (
    <TaskColumn
      organizationId={organizationId}
      query={api.caseTasks.listMyWork}
      icon={<ListTodo className="size-4 shrink-0 text-blue-400" />}
      title={t("myTasks")}
      emptyLabel={t("myTasksEmpty")}
    />
  );
}

export function ReviewsColumn({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks.myWork");
  return (
    <TaskColumn
      organizationId={organizationId}
      query={api.caseTasks.listReviewQueue}
      icon={<ClipboardCheck className="size-4 shrink-0 text-amber-400" />}
      title={t("reviews")}
      emptyLabel={t("reviewsEmpty")}
    />
  );
}

export function AssignedCasesColumn({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const assigned = useQuery(api.caseTasks.listMyAssignedCases, {
    organizationId,
  });
  return (
    <BoardColumn
      icon={<Briefcase className="size-4 shrink-0 text-emerald-400" />}
      title={t("myWork.assignedCases")}
      count={
        assigned === undefined
          ? undefined
          : `${assigned.cases.length}${assigned.truncated ? "+" : ""}`
      }
    >
      {assigned === undefined ? (
        <ColumnMessage>{t("myWork.loading")}</ColumnMessage>
      ) : assigned.cases.length === 0 ? (
        <ColumnMessage>{t("myWork.assignedCasesEmpty")}</ColumnMessage>
      ) : (
        <div className="space-y-2">
          <ul className={COLUMN_LIST_CLASS_NAME}>
            {assigned.cases.map((row) => (
              <li key={`${row.caseType}:${row.caseId}`}>
                <Link
                  href={caseHref(row.caseType, row.caseId)}
                  className={cn(CARD_CLASS_NAME, "flex-col gap-0.5")}
                >
                  <span className="w-full truncate text-sm font-medium text-foreground">
                    {t(`caseTypes.${row.caseType}`)} {row.caseLabel}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("myWork.since")}{" "}
                    <ClientDate timestamp={row.since} locale={locale} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {assigned.truncated ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t("myWork.assignedTruncated")}
            </p>
          ) : null}
        </div>
      )}
    </BoardColumn>
  );
}

export function ProvenanceReviewSection({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("provenance.queue");
  const { hasPermission } = usePermissions();
  if (!hasPermission("collections.review_provenance")) return null;
  return (
    <WorkSection
      icon={<ScrollText className="size-4 text-purple-400" />}
      title={t("title")}
    >
      <ProvenanceReviewQueue organizationId={organizationId} />
    </WorkSection>
  );
}
