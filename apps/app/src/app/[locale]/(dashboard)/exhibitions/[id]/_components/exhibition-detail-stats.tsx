"use client";

import { ClientDate } from "@/components/client-date";
import { useScopedI18n } from "@/locales/client";
import { AlertCircle, CheckCircle2, Clock, User } from "lucide-react";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailStats({
  exhibition,
  locale,
  timeStatus,
  workflowInfo,
  duration,
}: Pick<
  ExhibitionDetailViewProps,
  "exhibition" | "locale" | "timeStatus" | "workflowInfo" | "duration"
>) {
  const t = useScopedI18n("exhibitions");
  const WorkflowIcon = workflowInfo.icon;

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${timeStatus.color}`}
            >
              {timeStatus.text}
            </span>
            {exhibition.status && exhibition.status !== "active" ? (
              <span
                className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${workflowInfo.color}`}
              >
                <WorkflowIcon className="size-3" />
                {workflowInfo.text}
              </span>
            ) : null}
            {exhibition.isLoan ? (
              <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                {t("status.loan")}
              </span>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            {exhibition.title}
          </h1>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {duration.label}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {duration.value}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("detail.status")}
            </span>
          </div>
          <p className="mt-2 text-lg font-semibold capitalize text-foreground">
            {exhibition.status ?? t("status.active")}
          </p>
          {exhibition.workflowStep && exhibition.totalWorkflowSteps ? (
            <p className="text-xs text-muted-foreground">
              {t("detail.step", {
                step: exhibition.workflowStep.toString(),
                total: exhibition.totalWorkflowSteps.toString(),
              })}
            </p>
          ) : null}
        </div>

        {exhibition.creatorName ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                {t("detail.createdBy")}
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-medium text-foreground">
              {exhibition.creatorName}
            </p>
            <p className="text-xs text-muted-foreground">
              <ClientDate
                timestamp={exhibition._creationTime}
                locale={locale}
              />
            </p>
          </div>
        ) : null}

        {exhibition.approverName && exhibition.approvedAt ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                {t("detail.approvedBy")}
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-medium text-foreground">
              {exhibition.approverName}
            </p>
            <p className="text-xs text-muted-foreground">
              <ClientDate timestamp={exhibition.approvedAt} locale={locale} />
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
