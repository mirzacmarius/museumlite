"use client";

import { useScopedI18n } from "@/locales/client";

type AccessionsStatsData = {
  pending: number;
  approved: number;
  rejected: number;
};

type AccessionsStatsProps = {
  stats: AccessionsStatsData;
};

export function AccessionsStats({ stats }: AccessionsStatsProps) {
  const t = useScopedI18n("accessions");

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("stats.pending")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.pending}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("stats.approved")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.approved}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("status.rejected")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {stats.rejected}
        </span>
      </div>
    </div>
  );
}
