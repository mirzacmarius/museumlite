"use client";

import { useScopedI18n } from "@/locales/client";

type DeaccessionsStatsProps = {
  deaccessioned: number;
  pending: number;
};

export function DeaccessionsStats({
  deaccessioned,
  pending,
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
          {t("stats.deaccessions")}
        </span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {deaccessioned}
        </span>
      </div>
    </div>
  );
}
