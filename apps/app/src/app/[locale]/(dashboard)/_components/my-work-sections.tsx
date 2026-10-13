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

function TaskQueue({
  organizationId,
  query,
  emptyLabel,
  now,
}: {
  organizationId: Id<"organizations">;
  query: typeof api.caseTasks.listMyWork | typeof api.caseTasks.listReviewQueue;
  emptyLabel: string;
  now: number;
}) {
  const t = useScopedI18n("caseTasks.myWork");
  const { results, status, loadMore } = usePaginatedQuery(
    query,
    { organizationId },
    { initialNumItems: PAGE_SIZE },
  );
  if (status === "LoadingFirstPage")
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (results.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      <ul className={CARD_GRID_CLASS_NAME}>
        {results.map((task) => (
          <CaseTaskTile key={task._id} task={task} now={now} />
        ))}
      </ul>
      {status === "CanLoadMore" ? (
        <Button size="sm" variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function AssignedCases({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const assigned = useQuery(api.caseTasks.listMyAssignedCases, {
    organizationId,
  });
  if (assigned === undefined)
    return (
      <p className="text-sm text-muted-foreground">{t("myWork.loading")}</p>
    );
  if (assigned.cases.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("myWork.assignedCasesEmpty")}
      </p>
    );
  return (
    <div className="space-y-2">
      <ul className={CARD_GRID_CLASS_NAME}>
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
        <p className="text-xs text-muted-foreground">
          {t("myWork.assignedTruncated")}
        </p>
      ) : null}
    </div>
  );
}

/** Tasks the user owns, reviews waiting for them and cases assigned to them. */
export function MyWorkSections({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks.myWork");
  const tProvenance = useScopedI18n("provenance.queue");
  const { hasPermission } = usePermissions();
  const [now] = useState(() => Date.now());
  return (
    <div className="space-y-6">
      <WorkSection
        icon={<ListTodo className="size-4 text-blue-400" />}
        title={t("myTasks")}
      >
        <TaskQueue
          organizationId={organizationId}
          query={api.caseTasks.listMyWork}
          emptyLabel={t("myTasksEmpty")}
          now={now}
        />
      </WorkSection>
      <WorkSection
        icon={<ClipboardCheck className="size-4 text-amber-400" />}
        title={t("reviews")}
      >
        <TaskQueue
          organizationId={organizationId}
          query={api.caseTasks.listReviewQueue}
          emptyLabel={t("reviewsEmpty")}
          now={now}
        />
      </WorkSection>
      {hasPermission("collections.review_provenance") ? (
        <WorkSection
          icon={<ScrollText className="size-4 text-purple-400" />}
          title={tProvenance("title")}
        >
          <ProvenanceReviewQueue organizationId={organizationId} />
        </WorkSection>
      ) : null}
      <WorkSection
        icon={<Briefcase className="size-4 text-emerald-400" />}
        title={t("assignedCases")}
      >
        <AssignedCases organizationId={organizationId} />
      </WorkSection>
    </div>
  );
}
