"use client";

import { AlertTriangle } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { ExhibitionScheduleConflict } from "./exhibition-form-types";

interface ExhibitionScheduleConflictsAlertProps {
  conflicts: ExhibitionScheduleConflict[];
}

export function ExhibitionScheduleConflictsAlert({
  conflicts,
}: ExhibitionScheduleConflictsAlertProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions");

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-400">
            {t("form.scheduleConflict")}
          </p>
          <p className="text-xs text-amber-400/80">
            {t("form.scheduleConflictDescription")}
          </p>
          <ul className="text-xs text-amber-400/80 space-y-1 ml-4 list-disc">
            {conflicts.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.title}</span>
                {" — "}
                <ClientDate timestamp={c.startDate} locale={locale} />
                {c.endDate && (
                  <>
                    {" — "}
                    <ClientDate timestamp={c.endDate} locale={locale} />
                  </>
                )}{" "}
                <span className="capitalize">({c.status})</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-400/60 mt-2">
            {t("form.scheduleConflictHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
