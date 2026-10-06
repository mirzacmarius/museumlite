"use client";

import { ClientDateFns } from "@/components/client-date";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";
export function DeaccessionDetailWorkflowHistory({
  locale,
  workflowHistory,
  workflowEntryCount,
}: Pick<
  DeaccessionDetailViewProps,
  "locale" | "workflowHistory" | "workflowEntryCount"
>) {
  const tRoot = useI18n();
  const t = useScopedI18n("deaccessions");

  if (!workflowHistory || workflowHistory.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[20px] border border-border/70 bg-card p-5 shadow-[0_14px_36px_rgba(0,0,0,0.1)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
            {tRoot("untranslatedRecords.deaccessions.detail.processLog")}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {t("detail.workflowHistory")}
          </h2>
        </div>
        <div className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
          {workflowEntryCount}{" "}
          {tRoot("untranslatedRecords.deaccessions.detail.entries")}
        </div>
      </div>

      <div className="grid gap-2.5">
        {workflowHistory.map((entry) => (
          <div
            key={`${entry.step}-${entry.approvedAt}`}
            className="grid gap-3 rounded-xl border border-border/60 bg-background/40 p-3 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start"
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-background text-sm font-semibold">
              {entry.step}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-medium">
                  {entry.step === 0
                    ? t("detail.created")
                    : t("detail.step", { step: entry.step })}
                </p>
                <span className="text-xs text-muted-foreground">
                  {entry.approverName || t("detail.unknown")}
                </span>
                <span className="text-xs text-muted-foreground">
                  <ClientDateFns
                    timestamp={entry.approvedAt}
                    format="MMM d, yyyy 'at' h:mm a"
                    locale={locale}
                  />
                </span>
              </div>
              {entry.comment ? (
                <p className="mt-2 text-sm italic text-foreground/82">
                  {entry.comment}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
