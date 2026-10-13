"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { usePaginatedQuery, useQuery } from "convex/react";
import {
  AlertCircle,
  Briefcase,
  ChevronDown,
  ClipboardCheck,
  ListTodo,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { CaseTaskTile } from "@/components/case-tasks/case-task-card";
import { caseHref } from "@/components/case-tasks/case-task-links";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import {
  PendingApprovalCard,
  useMyAssignments,
} from "./my-assignments-sections";
import { CARD_CLASS_NAME } from "./my-work-sections";

const PAGE_SIZE = 20;
const CARD_LIST_CLASS_NAME = "flex flex-col gap-2";

interface WorkColumn {
  key: string;
  icon: ReactNode;
  title: string;
  loading: boolean;
  count: number;
  hasMore: boolean;
  renderCards: () => ReactNode;
}

function ColumnHeader({ column }: { column: WorkColumn }) {
  return (
    <>
      {column.icon}
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
        {column.title}
      </span>
      {column.loading ? null : (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {column.count}
          {column.hasMore ? "+" : ""}
        </span>
      )}
    </>
  );
}

function BoardColumn({
  column,
  loadingLabel,
}: {
  column: WorkColumn;
  loadingLabel: string;
}) {
  return (
    <section className="flex min-w-56 max-w-96 flex-1 basis-0 flex-col rounded-lg bg-muted/30">
      <h2 className="flex items-center gap-2 px-3 py-2.5">
        <ColumnHeader column={column} />
      </h2>
      <div className="max-h-[32rem] overflow-y-auto px-2 pb-2 custom-scrollbar">
        {column.loading ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {loadingLabel}
          </p>
        ) : (
          column.renderCards()
        )}
      </div>
    </section>
  );
}

function EmptyColumns({
  columns,
  label,
}: {
  columns: WorkColumn[];
  label: string;
}) {
  return (
    <details open className="group ml-auto w-60 shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="size-3.5 -rotate-90 transition-transform group-open:rotate-0"
          aria-hidden="true"
        />
        {label}
      </summary>
      <ul className={CARD_LIST_CLASS_NAME}>
        {columns.map((column) => (
          <li
            key={column.key}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <ColumnHeader column={column} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function LoadMoreButton({ onClick }: { onClick: () => void }) {
  const t = useScopedI18n("caseTasks.myWork");
  return (
    <Button size="sm" variant="ghost" className="w-full" onClick={onClick}>
      {t("loadMore")}
    </Button>
  );
}

/** My tasks, approvals, reviews and assigned cases as kanban columns; empty ones stack on the right. */
export function MyWorkBoard({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks");
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const [now] = useState(() => Date.now());
  const tasks = usePaginatedQuery(
    api.caseTasks.listMyWork,
    { organizationId },
    { initialNumItems: PAGE_SIZE },
  );
  const reviews = usePaginatedQuery(
    api.caseTasks.listReviewQueue,
    { organizationId },
    { initialNumItems: PAGE_SIZE },
  );
  const assignments = useMyAssignments(organizationId);
  const assigned = useQuery(api.caseTasks.listMyAssignedCases, {
    organizationId,
  });

  const taskColumn = (
    key: string,
    icon: ReactNode,
    title: string,
    queue: typeof tasks | typeof reviews,
  ): WorkColumn => ({
    key,
    icon,
    title,
    loading: queue.status === "LoadingFirstPage",
    count: queue.results.length,
    hasMore: queue.status === "CanLoadMore",
    renderCards: () => (
      <div className="space-y-2">
        <ul className={CARD_LIST_CLASS_NAME}>
          {queue.results.map((task) => (
            <CaseTaskTile key={task._id} task={task} now={now} />
          ))}
        </ul>
        {queue.status === "CanLoadMore" ? (
          <LoadMoreButton onClick={() => queue.loadMore(PAGE_SIZE)} />
        ) : null}
      </div>
    ),
  });

  const columns: WorkColumn[] = [
    taskColumn(
      "tasks",
      <ListTodo className="size-4 shrink-0 text-blue-400" />,
      t("myWork.myTasks"),
      tasks,
    ),
    {
      key: "approvals",
      icon: <AlertCircle className="size-4 shrink-0 text-amber-400" />,
      title: tRoot("assignmentsPage.sections.pendingApproval"),
      loading: assignments === undefined,
      count: assignments?.stats.totalPendingApprovals ?? 0,
      hasMore: false,
      renderCards: () => (
        <ul className={CARD_LIST_CLASS_NAME}>
          {assignments?.pendingApprovals.map((item) => (
            <PendingApprovalCard key={item._id} item={item} />
          ))}
        </ul>
      ),
    },
    taskColumn(
      "reviews",
      <ClipboardCheck className="size-4 shrink-0 text-amber-400" />,
      t("myWork.reviews"),
      reviews,
    ),
    {
      key: "assigned",
      icon: <Briefcase className="size-4 shrink-0 text-emerald-400" />,
      title: t("myWork.assignedCases"),
      loading: assigned === undefined,
      count: assigned?.cases.length ?? 0,
      hasMore: assigned?.truncated ?? false,
      renderCards: () => (
        <div className="space-y-2">
          <ul className={CARD_LIST_CLASS_NAME}>
            {assigned?.cases.map((row) => (
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
          {assigned?.truncated ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t("myWork.assignedTruncated")}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  const isEmpty = (column: WorkColumn) => !column.loading && column.count === 0;
  const filled = columns.filter((column) => !isEmpty(column));
  const empty = columns.filter(isEmpty);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-1 custom-scrollbar">
      {filled.map((column) => (
        <BoardColumn
          key={column.key}
          column={column}
          loadingLabel={t("myWork.loading")}
        />
      ))}
      {empty.length > 0 ? (
        <EmptyColumns columns={empty} label={t("myWork.emptyColumns")} />
      ) : null}
    </div>
  );
}
