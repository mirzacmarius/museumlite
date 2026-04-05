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
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("stats.pending")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {pending}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("stats.approved")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {approved}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("status.rejected")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {rejected}
        </span>
      </div>
    </div>
  );
}
