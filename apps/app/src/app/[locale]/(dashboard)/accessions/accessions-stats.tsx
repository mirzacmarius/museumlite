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
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("stats.pending")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats.pending}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("stats.approved")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats.approved}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("status.rejected")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats.rejected}
        </span>
      </div>
    </div>
  );
}
