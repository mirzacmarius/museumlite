"use client";

import { useScopedI18n } from "@/locales/client";

type DeaccessionsStatsProps = {
  approved: number;
  pending: number;
  rejected: number;
};

export function DeaccessionsStats({
  approved,
  pending,
  rejected,
}: DeaccessionsStatsProps) {
  const t = useScopedI18n("deaccessions");

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("stats.pending")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {pending}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("stats.approved")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {approved}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("status.rejected")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {rejected}
        </span>
      </div>
    </div>
  );
}
