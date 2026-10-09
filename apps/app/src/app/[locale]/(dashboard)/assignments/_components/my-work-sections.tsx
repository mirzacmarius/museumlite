"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery, useQuery } from "convex/react";
import {
  Briefcase,
  ClipboardCheck,
  ExternalLink,
  ListTodo,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { CaseTaskCard } from "@/components/case-tasks/case-task-card";
import { caseHref } from "@/components/case-tasks/case-task-links";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

const PAGE_SIZE = 20;

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
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
    return <p className="text-sm text-white/60">{t("loading")}</p>;
  if (results.length === 0)
    return <p className="text-sm text-white/60">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {results.map((task) => (
          <CaseTaskCard
            key={task._id}
            task={task}
            organizationId={organizationId}
            canManage={task.viewerCanWork}
            showCaseLink
            now={now}
          />
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
    return <p className="text-sm text-white/60">{t("myWork.loading")}</p>;
  if (assigned.cases.length === 0)
    return (
      <p className="text-sm text-white/60">{t("myWork.assignedCasesEmpty")}</p>
    );
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {assigned.cases.map((row) => (
          <li key={`${row.caseType}:${row.caseId}`}>
            <Link
              href={caseHref(row.caseType, row.caseId)}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/5"
            >
              <span className="text-white">
                {t(`caseTypes.${row.caseType}`)} {row.caseLabel}
              </span>
              <span className="flex items-center gap-2 text-xs text-white/60">
                {t("myWork.since")}{" "}
                <ClientDate timestamp={row.since} locale={locale} />
                <ExternalLink className="size-3" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {assigned.truncated ? (
        <p className="text-xs text-white/60">{t("myWork.assignedTruncated")}</p>
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
  const [now] = useState(() => Date.now());
  return (
    <div className="space-y-8">
      <Section
        icon={<ListTodo className="size-4 text-blue-400" />}
        title={t("myTasks")}
      >
        <TaskQueue
          organizationId={organizationId}
          query={api.caseTasks.listMyWork}
          emptyLabel={t("myTasksEmpty")}
          now={now}
        />
      </Section>
      <Section
        icon={<ClipboardCheck className="size-4 text-amber-400" />}
        title={t("reviews")}
      >
        <TaskQueue
          organizationId={organizationId}
          query={api.caseTasks.listReviewQueue}
          emptyLabel={t("reviewsEmpty")}
          now={now}
        />
      </Section>
      <Section
        icon={<Briefcase className="size-4 text-emerald-400" />}
        title={t("assignedCases")}
      >
        <AssignedCases organizationId={organizationId} />
      </Section>
    </div>
  );
}
