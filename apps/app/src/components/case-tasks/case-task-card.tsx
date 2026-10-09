"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { type CaseTask, CaseTaskActions } from "./case-task-actions";
import { caseHref, evidenceHref } from "./case-task-links";

const STATUS_STYLES: Record<CaseTask["status"], string> = {
  todo: "border-white/10 bg-white/5 text-white/80",
  in_progress: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  blocked: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  in_review: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelled: "border-white/10 bg-white/5 text-white/50",
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
        <h4 className="text-sm font-medium text-white">{task.title}</h4>
        {showCaseLink ? (
          <Link
            href={caseHref(task.caseType, task.caseId)}
            className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
          >
            {t(`caseTypes.${task.caseType}`)} {task.caseLabel}
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
          STATUS_STYLES[task.status],
        )}
      >
        {t(`status.${task.status}`)}
      </span>
    </div>
  );
}

function CaseTaskPeople({ task, now }: { task: CaseTask; now: number }) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const overdue =
    isOpen(task) && task.dueDate !== undefined && task.dueDate < now;
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-white/60 sm:grid-cols-3">
      <div className="flex gap-1">
        <dt>{t("fields.owner")}:</dt>
        <dd className="text-white/80">
          {task.ownerName ?? t("labels.unknownUser")}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>{t("fields.reviewer")}:</dt>
        <dd className="text-white/80">
          {task.reviewerId
            ? (task.reviewerName ?? t("labels.unknownUser"))
            : t("fields.noReviewer")}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>{t("fields.dueDate")}:</dt>
        <dd className={cn(overdue ? "text-rose-300" : "text-white/80")}>
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
        <p className="whitespace-pre-wrap text-sm text-white/80">
          {task.description}
        </p>
      ) : null}
      {task.dependsOn.length > 0 ? (
        <p className="text-xs text-white/60">
          {t("fields.dependencies")}:{" "}
          {task.dependsOn
            .map(
              (dependency) =>
                `${dependency.title} (${t(`status.${dependency.status}`)})`,
            )
            .join(", ")}
          {isOpen(task) && task.openDependencyCount > 0 ? (
            <span className="ml-1 text-amber-300">
              {t("labels.waitingOn", { count: task.openDependencyCount })}
            </span>
          ) : null}
        </p>
      ) : null}
      {task.status === "blocked" && task.blockedReason ? (
        <p className="text-xs text-rose-300">
          {t("labels.blockedReason", { reason: task.blockedReason })}
        </p>
      ) : null}
      {task.reviewNote ? (
        <p className="text-xs text-white/70">
          {t("labels.reviewNote", { note: task.reviewNote })}
        </p>
      ) : null}
      {task.completionNote ? (
        <p className="text-xs text-white/70">
          {t("labels.completionNote", { note: task.completionNote })}
        </p>
      ) : null}
      {task.status === "cancelled" && task.cancelReason ? (
        <p className="text-xs text-white/60">
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
      <p className="text-xs font-medium uppercase tracking-wider text-white/60">
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
              className="flex flex-wrap items-center gap-2 text-xs text-white/80"
            >
              <Link2 className="size-3 text-white/60" />
              {href ? (
                <Link href={href} className="underline hover:text-white">
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
              {evidence.recordedAt !== undefined ? (
                <span className="text-white/60">
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
      className="space-y-3 rounded-lg border border-white/10 bg-black/40 p-4"
      data-task-status={task.status}
    >
      <CaseTaskHeader task={task} showCaseLink={showCaseLink} />
      <CaseTaskPeople task={task} now={now} />
      <CaseTaskNotes task={task} />
      <CaseTaskEvidenceList task={task} />
      {canManage && isOpen(task) ? (
        <CaseTaskActions task={task} organizationId={organizationId} />
      ) : null}
    </li>
  );
}
