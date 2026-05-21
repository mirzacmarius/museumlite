"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

function ClientDaysUntilExpiry({ timestamp }: { timestamp: number }) {
  return useSyncExternalStore(
    () => () => {},
    () => String(Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24))),
    () => "",
  );
}

interface ArchiveRetentionSectionProps {
  details: DetailsDoc;
}

export function ArchiveRetentionSection({
  details,
}: ArchiveRetentionSectionProps) {
  const locale = useCurrentLocale();

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
        <Clock className="size-4 text-cyan-500" />
        Retention Schedule
      </h3>

      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Retention Period
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.retentionYears ? `${details.retentionYears} years` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Retention Start Date
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.retentionStartDate ? (
                <ClientDateFns
                  timestamp={details.retentionStartDate}
                  format="MMM d, yyyy"
                  locale={locale}
                />
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Retention Expires
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.retentionExpiresAt ? (
                <ClientDateFns
                  timestamp={details.retentionExpiresAt}
                  format="MMM d, yyyy"
                  locale={locale}
                />
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Days Until Expiry
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.retentionExpiresAt ? (
                <ClientDaysUntilExpiry timestamp={details.retentionExpiresAt} />
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
