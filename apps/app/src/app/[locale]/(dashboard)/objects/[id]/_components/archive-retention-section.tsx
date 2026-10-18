"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"archive">;

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
  const tRoot = useI18n();
  const locale = useCurrentLocale();

  return (
    <DetailSection
      title={tRoot("modules.archive.retentionSchedule")}
      icon={Clock}
    >
      <DetailGrid className="md:grid-cols-2 lg:grid-cols-4">
        <DetailField label={tRoot("modules.archive.retentionPeriod")}>
          <div className="text-sm text-foreground">
            {details.retentionYears
              ? tRoot("untranslatedRecords.objects.archive.retentionYears", {
                  count: details.retentionYears,
                })
              : "—"}
          </div>
        </DetailField>
        <DetailField label={tRoot("modules.archive.retentionStartDate")}>
          <div className="text-sm text-foreground">
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
        </DetailField>
        <DetailField label={tRoot("modules.archive.retentionExpires")}>
          <div className="text-sm text-foreground">
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
        </DetailField>
        <DetailField label={tRoot("modules.archive.daysUntilExpiry")}>
          <div className="text-sm text-foreground">
            {details.retentionExpiresAt ? (
              <ClientDaysUntilExpiry timestamp={details.retentionExpiresAt} />
            ) : (
              "—"
            )}
          </div>
        </DetailField>
      </DetailGrid>
    </DetailSection>
  );
}
