"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { caseHref } from "@v1/backend/convex/utils/caseTypes";
import {
  MAX_COLUMN_CARDS,
  WORK_COLUMN_PAGE,
} from "@v1/backend/convex/utils/workBoardColumns";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertCircle,
  ArrowRightLeft,
  Briefcase,
  ChevronDown,
  ClipboardCheck,
  ListTodo,
  type LucideIcon,
  ScrollText,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { CaseTaskTile } from "@/components/case-tasks/case-task-card";
import { ClientDate } from "@/components/client-date";
import { useHistoricalDateFormat } from "@/components/provenance/use-historical-date-format";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { MyWorkBoardSkeleton } from "../dashboard-page-skeleton";
import {
  APPROVAL_TYPES,
  type ApprovalType,
  PendingApprovalCard,
  pendingApprovalsHref,
} from "./my-assignments-sections";
import { CARD_CLASS_NAME } from "./my-work-sections";
import {
  PENDING_CONDITION_APPROVALS_HREF,
  PendingConditionCards,
} from "./pending-condition-approvals";
import {
  PendingTransferCards,
  TRANSFERS_HREF,
} from "./pending-transfers-column";

export const MY_WORK_HREF = "/assignments";
const CARD_LIST_CLASS_NAME = "flex flex-col gap-2";

type Board = FunctionReturnType<typeof api.workBoard.get>;
type ColumnKey = Board[number]["key"];
type ProvenanceClaim = Extract<
  Board[number],
  { key: "provenance" }
>["cards"][number];

export interface WorkSummaryEntry
  extends Pick<
    WorkColumn,
    "icon" | "accentClassName" | "title" | "count" | "hasMore"
  > {
  key: string;
  href: string;
}

export interface WorkColumn {
  key: ColumnKey;
  icon: LucideIcon;
  accentClassName: string;
  title: string;
  /** The cards loaded, which reads as `count+` while more are waiting. */
  count: number;
  hasMore: boolean;
  renderCards: () => ReactNode;
  summaryEntries: readonly WorkSummaryEntry[];
}

function ColumnHeader({
  column,
  compact = false,
}: {
  column: WorkColumn;
  compact?: boolean;
}) {
  const Icon = column.icon;
  return (
    <>
      <Icon
        className={cn("size-4 shrink-0", column.accentClassName)}
        aria-hidden="true"
      />
      <span
        className={cn(
          "min-w-0 flex-1 font-medium text-foreground",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {column.title}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {column.count}
        {column.hasMore ? "+" : ""}
      </span>
    </>
  );
}

function BoardColumn({ column }: { column: WorkColumn }) {
  return (
    <section className="flex min-w-52 max-w-72 flex-1 basis-0 flex-col rounded-lg bg-muted/30">
      <h2 className="flex items-center gap-2 px-3 py-2.5">
        <ColumnHeader column={column} />
      </h2>
      <div className="max-h-96 overflow-y-auto px-2 pb-2 custom-scrollbar">
        {column.renderCards()}
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
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
          >
            <ColumnHeader column={column} compact />
          </li>
        ))}
      </ul>
    </details>
  );
}

function ProvenanceClaimCard({ claim }: { claim: ProvenanceClaim }) {
  const t = useScopedI18n("provenance");
  const dates = useHistoricalDateFormat();
  return (
    <li>
      <Link
        href={`/objects/${claim.objectId}/edit?tab=provenance`}
        className={cn(CARD_CLASS_NAME, "flex-col gap-0.5")}
      >
        <span className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {claim.objectLabel}
          </span>
          <span
            className={cn(
              "shrink-0 rounded border px-1 py-px text-[10px] font-medium",
              claim.disputed
                ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {claim.disputed
              ? t("queue.statuses.disputed")
              : t(`confidence.${claim.confidence}`)}
          </span>
        </span>
        <span className="w-full truncate text-[11px] text-muted-foreground">
          {dates.period(claim.startDate, claim.endDate)}
          {" · "}
          {claim.partyKind === "named"
            ? claim.partyText
            : t(`partyKinds.${claim.partyKind}`)}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {claim.statement}
        </span>
        {claim.contradictsClaimId ? (
          <span className="text-[11px] text-rose-700 dark:text-rose-300">
            {t("queue.contradicts")}
          </span>
        ) : null}
      </Link>
    </li>
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

/**
 * The viewer's Work board with as many cards per column as they loaded. While
 * a larger page loads, the board they already see stays on screen.
 */
function useWorkBoard(organizationId: Id<"organizations">) {
  const [now] = useState(() => Date.now());
  const [limits, setLimits] = useState<{
    organizationId: Id<"organizations">;
    byColumn: Partial<Record<ColumnKey, number>>;
  }>({ organizationId, byColumn: {} });
  const byColumn =
    limits.organizationId === organizationId ? limits.byColumn : {};
  const board = useQuery(api.workBoard.get, {
    organizationId,
    now,
    limits: byColumn,
  });
  const [shown, setShown] = useState<{
    organizationId: Id<"organizations">;
    board: Board;
  }>();
  if (board !== undefined && board !== shown?.board) {
    setShown({ organizationId, board });
  }

  const limitOf = (key: ColumnKey) => byColumn[key] ?? WORK_COLUMN_PAGE;
  return {
    board:
      board ??
      (shown?.organizationId === organizationId ? shown.board : undefined),
    now,
    /** Whether the column is full at its limit and the board shows more. */
    canLoadMore: (key: ColumnKey, cards: number, hasMore: boolean) =>
      hasMore && cards >= limitOf(key) && limitOf(key) < MAX_COLUMN_CARDS,
    loadMore: (key: ColumnKey) =>
      setLimits({
        organizationId,
        byColumn: { ...byColumn, [key]: limitOf(key) + WORK_COLUMN_PAGE },
      }),
  };
}

/**
 * Each column of work waiting on the viewer, with its count and cards, in
 * board order; undefined while the board loads.
 */
export function useMyWorkColumns(
  organizationId: Id<"organizations">,
): WorkColumn[] | undefined {
  const t = useScopedI18n("caseTasks");
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const { board, now, canLoadMore, loadMore } = useWorkBoard(organizationId);
  if (!board) return undefined;

  const cardList = (key: ColumnKey, cards: ReactNode[], hasMore: boolean) => (
    <div className="space-y-2">
      <ul className={CARD_LIST_CLASS_NAME}>{cards}</ul>
      {canLoadMore(key, cards.length, hasMore) ? (
        <LoadMoreButton onClick={() => loadMore(key)} />
      ) : null}
    </div>
  );

  const present = (column: Board[number]): WorkColumn => {
    /** A column whose one Overview card opens `href`. */
    const single = (
      style: Pick<WorkColumn, "icon" | "accentClassName" | "title">,
      renderCards: () => ReactNode,
      href = MY_WORK_HREF,
    ): WorkColumn => {
      const counted = {
        key: column.key,
        count: column.cards.length,
        hasMore: column.hasMore,
        ...style,
      };
      return {
        ...counted,
        renderCards,
        summaryEntries: [{ ...counted, href }],
      };
    };

    switch (column.key) {
      case "tasks":
      case "reviews":
        return single(
          column.key === "tasks"
            ? {
                icon: ListTodo,
                accentClassName: "text-blue-400",
                title: t("myWork.myTasks"),
              }
            : {
                icon: ClipboardCheck,
                accentClassName: "text-amber-400",
                title: t("myWork.reviews"),
              },
          () =>
            cardList(
              column.key,
              column.cards.map((task) => (
                <CaseTaskTile key={task._id} task={task} now={now} />
              )),
              column.hasMore,
            ),
        );
      case "approvals":
        return {
          ...single(
            {
              icon: AlertCircle,
              accentClassName: "text-amber-400",
              title: tRoot("assignmentsPage.sections.pendingApproval"),
            },
            () =>
              cardList(
                column.key,
                column.cards.map((item) => (
                  <PendingApprovalCard key={item._id} item={item} />
                )),
                column.hasMore,
              ),
          ),
          // One Overview card per kind, counting every approval waiting.
          summaryEntries: (Object.keys(APPROVAL_TYPES) as ApprovalType[]).map(
            (type) => ({
              key: type,
              icon: APPROVAL_TYPES[type].icon,
              accentClassName: APPROVAL_TYPES[type].accentClassName,
              title: t(`myWork.pendingApproval.${type}`),
              count: column.byType[type],
              hasMore: false,
              href: pendingApprovalsHref(type, now),
            }),
          ),
        };
      case "conditionApprovals":
        return single(
          {
            icon: Stethoscope,
            accentClassName: "text-pink-400",
            title: tRoot("conditionAssessments.pendingApprovalCard"),
          },
          () => (
            <div className="space-y-2">
              <PendingConditionCards assessments={column.cards} />
              {canLoadMore(column.key, column.cards.length, column.hasMore) ? (
                <LoadMoreButton onClick={() => loadMore(column.key)} />
              ) : null}
            </div>
          ),
          PENDING_CONDITION_APPROVALS_HREF,
        );
      case "transfers":
        return single(
          {
            icon: ArrowRightLeft,
            accentClassName: "text-sky-400",
            title: t("myWork.pendingTransfers"),
          },
          () => (
            <PendingTransferCards
              transfers={column.cards}
              hasMore={column.hasMore}
            />
          ),
          TRANSFERS_HREF,
        );
      case "assigned":
        return single(
          {
            icon: Briefcase,
            accentClassName: "text-emerald-400",
            title: t("myWork.assignedCases"),
          },
          () =>
            cardList(
              column.key,
              column.cards.map((row) => (
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
              )),
              column.hasMore,
            ),
        );
      case "provenance":
        return single(
          {
            icon: ScrollText,
            accentClassName: "text-purple-400",
            title: tRoot("provenance.queue.title"),
          },
          () =>
            cardList(
              column.key,
              column.cards.map((claim) => (
                <ProvenanceClaimCard key={claim.claimId} claim={claim} />
              )),
              column.hasMore,
            ),
        );
    }
  };
  return board.map(present);
}

/** Work waiting on the viewer as kanban columns; empty ones stack on the right. */
export function MyWorkBoard({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("caseTasks");
  const columns = useMyWorkColumns(organizationId);
  if (!columns) return <MyWorkBoardSkeleton />;
  const filled = columns.filter((column) => column.count > 0);
  const empty = columns.filter((column) => column.count === 0);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-1 custom-scrollbar">
      {filled.map((column) => (
        <BoardColumn key={column.key} column={column} />
      ))}
      {empty.length > 0 ? (
        <EmptyColumns columns={empty} label={t("myWork.emptyColumns")} />
      ) : null}
    </div>
  );
}
