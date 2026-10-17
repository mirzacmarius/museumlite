"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Lock, Trash2 } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

interface ArchiveDetailsAlertsProps {
  details: DetailsDoc;
}

export function ArchiveDetailsAlerts({ details }: ArchiveDetailsAlertsProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.archive");

  return (
    <>
      {details.legalHold ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {t("legalHoldActive")}
            </span>
          </div>
          {details.legalHoldReason ? (
            <p className="mt-2 text-sm text-destructive/80">
              {t("reason")}: {details.legalHoldReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {details.flaggedForDestruction ? (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-orange-700 dark:text-orange-400" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {t("flaggedForDestruction")}
            </span>
          </div>
          {details.destructionDate ? (
            <p className="mt-1 text-sm text-orange-700 dark:text-orange-400/80">
              {t("scheduled")}:{" "}
              <ClientDateFns
                timestamp={details.destructionDate}
                format="MMMM d, yyyy"
                locale={locale}
              />
            </p>
          ) : null}
          {details.destructionMethod ? (
            <p className="mt-1 text-sm text-orange-700 dark:text-orange-400/80">
              {t("method")}: {details.destructionMethod}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
