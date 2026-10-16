"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { ScrollArea } from "@v1/ui/scroll-area";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckCircle, Clock, FileEdit, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ClientDateFns } from "@/components/client-date";
import { ConditionAssessmentDecision } from "@/components/condition-assessment-decision";
import { usePermissions } from "@/components/permission-gate";
import { useListReturnPath } from "@/hooks/use-return-path";
import { formatDate } from "@/lib/format-date";
import { formatNumber } from "@/lib/format-number";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { formatConditionLabel } from "../objects/[id]/_components/condition-display";
import {
  CONDITION_ASSESSMENT_COLUMN_PAGE_SIZE,
  CONDITION_ASSESSMENT_LOG_PAGE_SIZE,
  type ConditionAssessmentColumn,
  conditionAssessmentListState,
} from "./condition-assessment-list-state";

type BoardAssessment = FunctionReturnType<
  typeof api.conditionAssessments.listBoardColumn
>["page"][number];

const COLUMN_STYLE = {
  draft: {
    dot: "bg-zinc-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]",
    icon: FileEdit,
  },
  submitted: {
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    icon: Clock,
  },
  accepted: {
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    icon: CheckCircle,
  },
  rejected: {
    dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
    icon: XCircle,
  },
} satisfies Record<
  ConditionAssessmentColumn,
  { dot: string; icon: typeof Clock }
>;

/** Where an assessment is read and decided on its object. */
function objectHref(assessment: BoardAssessment) {
  return `/objects/${assessment.collectionId}?tab=physical`;
}

export function ConditionAssessmentBoardColumn({
  organizationId,
  column,
  search,
  total,
}: {
  organizationId: Id<"organizations">;
  column: ConditionAssessmentColumn;
  search: string;
  /** Exact column total; undefined when too large to count. */
  total?: number;
}) {
  const t = useScopedI18n("conditionAssessments.board");
  const tList = useScopedI18n("listState");
  const returnPath = useListReturnPath(conditionAssessmentListState.keys);
  const trimmedSearch = search.trim();
  const isLog = column === "accepted";
  const pageSize = isLog
    ? CONDITION_ASSESSMENT_LOG_PAGE_SIZE
    : CONDITION_ASSESSMENT_COLUMN_PAGE_SIZE;
  const { results, status, loadMore } = usePaginatedQuery(
    api.conditionAssessments.listBoardColumn,
    { organizationId, column, search: trimmedSearch || undefined },
    { initialNumItems: pageSize },
  );
  const Icon = COLUMN_STYLE[column].icon;
  const countLabel = trimmedSearch
    ? tList("matchesShown", { shown: results.length })
    : total === undefined
      ? String(results.length)
      : tList("shownOfTotal", { shown: results.length, total });

  return (
    <section
      aria-label={t(`columns.${column}`)}
      className="flex w-72 flex-shrink-0 flex-col"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <h2>{t(`columns.${column}`)}</h2>
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
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {trimmedSearch ? tList("noMatch.title") : t("empty")}
                </p>
              </div>
            ) : isLog ? (
              <ol className="flex flex-col divide-y divide-border/60">
                {results.map((assessment) => (
                  <AcceptedLogEntry
                    key={assessment._id}
                    assessment={assessment}
                    href={withReturnPath(objectHref(assessment), returnPath)}
                  />
                ))}
              </ol>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((assessment) => (
                  <AssessmentCard
                    key={assessment._id}
                    assessment={assessment}
                    dotClassName={COLUMN_STYLE[column].dot}
                    href={withReturnPath(objectHref(assessment), returnPath)}
                  />
                ))}
              </ul>
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
                  ? tList("loading")
                  : tList("loadMore")}
              </Button>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

function AssessmentCard({
  assessment,
  dotClassName,
  href,
}: {
  assessment: BoardAssessment;
  dotClassName: string;
  href: string;
}) {
  const t = useScopedI18n("conditionAssessments.board");
  const tAssessments = useScopedI18n("conditionAssessments");
  const translate = useI18n();
  const locale = useCurrentLocale();
  const { hasPermission } = usePermissions();
  const decidable =
    assessment.status === "submitted" || assessment.status === "draft"
      ? assessment.status
      : null;
  const canDecide = hasPermission("collections.accept_condition");
  const byLine =
    assessment.status === "rejected"
      ? t("decidedBy", {
          name: assessment.decidedByName ?? t("unknownPerson"),
        })
      : t("assessedBy", {
          name: assessment.assessorName ?? t("unknownPerson"),
        });

  return (
    <li className="rounded-lg border border-border bg-background/70 p-3">
      <Link href={href} className="group block">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {assessment.accessionNumber ?? ""}
          </span>
          <span className={`size-1.5 shrink-0 rounded-full ${dotClassName}`} />
        </div>
        <p className="mb-1 line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {assessment.objectTitle ?? t("objectUnavailable")}
        </p>
      </Link>
      <p className="text-xs font-medium text-foreground">
        {formatConditionLabel(assessment.condition, translate)}
      </p>
      <p className="mb-2 line-clamp-2 break-words text-xs text-muted-foreground">
        {assessment.summary}
      </p>
      {assessment.observationCount > 0 || assessment.photoCount > 0 ? (
        <p className="mb-2 text-[10px] text-muted-foreground">
          {t("observationCount", {
            count: formatNumber(assessment.observationCount, locale),
          })}
          {" · "}
          {t("photoCount", {
            count: formatNumber(assessment.photoCount, locale),
          })}
        </p>
      ) : null}
      {assessment.rejectionReason ? (
        <p className="mb-2 line-clamp-3 break-words text-xs text-muted-foreground">
          {tAssessments("rejectionReason", {
            reason: assessment.rejectionReason,
          })}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="truncate" title={byLine}>
          {byLine}
        </span>
        <span className="shrink-0">
          <ClientDateFns
            timestamp={assessment.decidedAt ?? assessment.assessedAt}
            format="MMM d, yyyy"
            locale={locale}
          />
        </span>
      </div>
      {decidable && canDecide ? (
        <ConditionAssessmentDecision
          className="mt-3"
          assessmentId={assessment._id}
          status={decidable}
          onDecided={(decision) =>
            toast.success(
              decision === "accepted"
                ? tAssessments("accepted")
                : tAssessments("rejected"),
            )
          }
        />
      ) : null}
    </li>
  );
}

/** One accepted assessment as a two-line log row, like approved accessions. */
function AcceptedLogEntry({
  assessment,
  href,
}: {
  assessment: BoardAssessment;
  href: string;
}) {
  const t = useScopedI18n("conditionAssessments.board");
  const translate = useI18n();
  const locale = useCurrentLocale();
  const title = assessment.objectTitle ?? t("objectUnavailable");
  const condition = formatConditionLabel(assessment.condition, translate);
  const acceptedAt =
    assessment.decidedAt === null ? undefined : new Date(assessment.decidedAt);

  return (
    <li>
      <Link
        href={href}
        className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {assessment.accessionNumber ?? ""}
          </span>
          {acceptedAt ? (
            <time
              dateTime={acceptedAt.toISOString()}
              title={formatDate(acceptedAt, locale, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              className="shrink-0 text-[10px] text-muted-foreground"
            >
              {formatDate(acceptedAt, locale, { dateStyle: "medium" })}
            </time>
          ) : null}
        </div>
        <p className="truncate text-xs" title={`${title} · ${condition}`}>
          <span className="font-medium text-foreground transition-colors group-hover:text-primary">
            {title}
          </span>
          <span className="text-muted-foreground">
            {" · "}
            {condition}
          </span>
        </p>
      </Link>
    </li>
  );
}
