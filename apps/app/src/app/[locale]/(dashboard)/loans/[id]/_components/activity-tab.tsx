"use client";

import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { WorkflowHistoryEntry } from "./types";

interface ActivityTabProps {
  workflowHistory: WorkflowHistoryEntry[];
}

export function ActivityTab({ workflowHistory }: ActivityTabProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("loans.actions");

  const getStepLabel = (step: number, comment?: string) => {
    if (comment) return comment;
    switch (step) {
      case 0:
        return t("loanCreated");
      case 1:
        return t("submittedForApproval");
      case 2:
        return t("curatorialReviewCompleted");
      case 3:
        return t("facilitiesReviewCompleted");
      case 4:
        return t("conservationReviewCompleted");
      case 5:
        return t("readyForDispatch");
      default:
        return t("stepCompleted", { step });
    }
  };

  const sortedHistory = workflowHistory.toSorted(
    (a, b) => b.approvedAt - a.approvedAt,
  );

  if (sortedHistory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {t("noActivityRecorded")}
      </div>
    );
  }

  return (
    <div className="relative pl-6 border-l border-border space-y-8">
      {sortedHistory.map((entry, index) => (
        <div key={`${entry.step}-${entry.approvedAt}`} className="relative">
          <div
            className={`absolute -left-[29px] top-0 size-3 rounded-full border-2 border-background ${
              index === 0 ? "bg-cyan-500" : "bg-secondary"
            }`}
          />
          <p className="text-xs text-muted-foreground mb-1">
            {formatDate(new Date(entry.approvedAt), locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            {new Date(entry.approvedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-sm text-foreground">
            {getStepLabel(entry.step, entry.comment)}
            {entry.approvedByName && (
              <span className="text-muted-foreground">
                {" "}
                by {entry.approvedByName}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
