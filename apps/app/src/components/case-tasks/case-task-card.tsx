"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { caseHref } from "@v1/backend/convex/utils/caseTypes";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useMutation } from "convex/react";
import { CheckCircle2, ExternalLink, Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { type CaseTask, CaseTaskActions } from "./case-task-actions";
import { evidenceHref } from "./case-task-links";

const STATUS_STYLES: Record<CaseTask["status"], string> = {
  todo: "border-border bg-muted text-foreground/80",
  in_progress:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  blocked: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  in_review:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "border-border bg-muted text-muted-foreground",
};

const DUE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

function isOpen(task: CaseTask) {
  return task.status !== "done" && task.status !== "cancelled";
}

function CaseTaskHeader({
  task,
  showCaseLink,
}: {
  task: CaseTask;
  showCaseLink: boolean;
}) {
  const t = useScopedI18n("caseTasks");
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <h4 className="text-sm font-medium text-foreground">{task.title}</h4>
        {showCaseLink ? (
          <Link
            href={caseHref(task.caseType, task.caseId)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {t(`caseTypes.${task.caseType}`)} {task.caseLabel}
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.suggestion ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="size-3" />
            {t("suggestion.badge")}
          </span>
        ) : null}
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_STYLES[task.status],
          )}
        >
          {t(`status.${task.status}`)}
        </span>
      </div>
    </div>
  );
}

/** Where a suggested task came from and the evidence it still needs. */
function CaseTaskSuggestionNotes({ task }: { task: CaseTask }) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const { suggestion, requiredEvidence } = task;
  if (!suggestion) return null;
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>
        {t(`suggestion.origin.${suggestion.trigger}`, {
          recipe: suggestion.recipeName,
        })}{" "}
        · <ClientDate timestamp={suggestion.eventAt} locale={locale} />
      </p>
      {suggestion.withdrawnReason ? <p>{t("suggestion.withdrawn")}</p> : null}
      {requiredEvidence && isOpen(task) ? (
        requiredEvidence.linked ? (
          <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            {t(`suggestion.evidenceLinked.${requiredEvidence.kind}`)}
          </p>
        ) : (
          <p className="text-amber-700 dark:text-amber-300">
            {t(`suggestion.evidenceNeeded.${requiredEvidence.kind}`)}
          </p>
        )
      ) : null}
    </div>
  );
}

function RestoreSuggestionButton({ taskId }: { taskId: Id<"caseTasks"> }) {
  const t = useScopedI18n("caseTasks");
  const errorMessage = useWorkErrorMessage();
  const restore = useMutation(api.caseTasks.restoreSuggestion);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await restore({ taskId });
            toast.success(t("suggestion.restored"));
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("suggestion.restore")}
      </Button>
    </div>
  );
}

function CaseTaskPeople({ task, now }: { task: CaseTask; now: number }) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const overdue =
    isOpen(task) && task.dueDate !== undefined && task.dueDate < now;
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
      <div className="flex gap-1">
        <dt>{t("fields.owner")}:</dt>
        <dd className="text-foreground/80">
          {task.ownerName ?? t("labels.unknownUser")}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>{t("fields.reviewer")}:</dt>
        <dd className="text-foreground/80">
          {task.reviewerId
            ? (task.reviewerName ?? t("labels.unknownUser"))
            : t("fields.noReviewer")}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>{t("fields.dueDate")}:</dt>
        <dd
          className={cn(
            overdue ? "text-rose-700 dark:text-rose-300" : "text-foreground/80",
          )}
        >
          {task.dueDate !== undefined ? (
            <ClientDate
              timestamp={task.dueDate}
              locale={locale}
              options={DUE_DATE_OPTIONS}
            />
          ) : (
            t("labels.noDueDate")
          )}
          {overdue ? ` (${t("labels.overdue")})` : null}
        </dd>
      </div>
    </dl>
  );
}

function CaseTaskNotes({ task }: { task: CaseTask }) {
  const t = useScopedI18n("caseTasks");
  return (
    <>
      {task.description ? (
        <p className="whitespace-pre-wrap text-sm text-foreground/80">
          {task.description}
        </p>
      ) : null}
      {task.dependsOn.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("fields.dependencies")}:{" "}
          {task.dependsOn
            .map(
              (dependency) =>
                `${dependency.title} (${t(`status.${dependency.status}`)})`,
            )
            .join(", ")}
          {isOpen(task) && task.openDependencyCount > 0 ? (
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              {t("labels.waitingOn", { count: task.openDependencyCount })}
            </span>
          ) : null}
        </p>
      ) : null}
      {task.status === "blocked" && task.blockedReason ? (
        <p className="text-xs text-rose-700 dark:text-rose-300">
          {t("labels.blockedReason", { reason: task.blockedReason })}
        </p>
      ) : null}
      {task.reviewNote ? (
        <p className="text-xs text-muted-foreground">
          {t("labels.reviewNote", { note: task.reviewNote })}
        </p>
      ) : null}
      {task.completionNote ? (
        <p className="text-xs text-muted-foreground">
          {t("labels.completionNote", { note: task.completionNote })}
        </p>
      ) : null}
      {task.status === "cancelled" && task.cancelReason ? (
        <p className="text-xs text-muted-foreground">
          {t("labels.cancelReason", { reason: task.cancelReason })}
        </p>
      ) : null}
    </>
  );
}

function CaseTaskEvidenceList({ task }: { task: CaseTask }) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  if (task.evidence.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("fields.evidence")}
      </p>
      <ul className="space-y-1">
        {task.evidence.map((evidence) => {
          const href = evidenceHref(evidence);
          const label = evidence.visible
            ? `${t(`evidenceKinds.${evidence.kind}`)}: ${evidence.label ?? ""}`
            : t("labels.restrictedEvidence");
          return (
            <li
              key={evidence._id}
              className="flex flex-wrap items-center gap-2 text-xs text-foreground/80"
            >
              <Link2 className="size-3 text-muted-foreground" />
              {href ? (
                <Link href={href} className="underline hover:text-foreground">
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
              {evidence.recordedAt !== undefined ? (
                <span className="text-muted-foreground">
                  <ClientDate timestamp={evidence.recordedAt} locale={locale} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CaseTaskCard({
  task,
  organizationId,
  canManage,
  showCaseLink,
  now,
}: {
  task: CaseTask;
  organizationId: Id<"organizations">;
  canManage: boolean;
  showCaseLink: boolean;
  now: number;
}) {
  return (
    <li
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
      data-task-status={task.status}
    >
      <CaseTaskHeader task={task} showCaseLink={showCaseLink} />
      <CaseTaskPeople task={task} now={now} />
      <CaseTaskNotes task={task} />
      <CaseTaskSuggestionNotes task={task} />
      <CaseTaskEvidenceList task={task} />
      {canManage && isOpen(task) ? (
        <CaseTaskActions task={task} organizationId={organizationId} />
      ) : null}
      {canManage && task.suggestion && task.status === "cancelled" ? (
        <RestoreSuggestionButton taskId={task._id} />
      ) : null}
    </li>
  );
}

/** Compact task card linking to its case, where the task can be worked. */
export function CaseTaskTile({ task, now }: { task: CaseTask; now: number }) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const overdue =
    isOpen(task) && task.dueDate !== undefined && task.dueDate < now;
  return (
    <li data-task-status={task.status}>
      <Link
        href={caseHref(task.caseType, task.caseId)}
        className="flex h-full flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium text-foreground">
            {task.title}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
              STATUS_STYLES[task.status],
            )}
          >
            {t(`status.${task.status}`)}
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {t(`caseTypes.${task.caseType}`)} {task.caseLabel}
        </span>
        {task.dueDate !== undefined ? (
          <span
            className={cn(
              "text-[11px]",
              overdue
                ? "text-rose-700 dark:text-rose-300"
                : "text-muted-foreground",
            )}
          >
            {t("fields.dueDate")}:{" "}
            <ClientDate
              timestamp={task.dueDate}
              locale={locale}
              options={DUE_DATE_OPTIONS}
            />
            {overdue ? ` (${t("labels.overdue")})` : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
