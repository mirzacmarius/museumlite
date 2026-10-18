"use client";

import { Shield } from "lucide-react";
import { useI18n, useScopedI18n } from "@/locales/client";
import {
  DetailField,
  DetailGrid,
  DetailLabel,
  DetailSection,
} from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"archive">;

interface ArchiveSecuritySectionProps {
  details: DetailsDoc;
}

export function ArchiveSecuritySection({
  details,
}: ArchiveSecuritySectionProps) {
  const tRoot = useI18n();
  const common = useScopedI18n("modules.common");

  return (
    <DetailSection
      title={tRoot("modules.archive.securityAccess")}
      icon={Shield}
    >
      <DetailGrid>
        <DetailField
          label={tRoot("modules.archive.confidentialityLevel")}
          value={details.confidentialityLevel}
        />
        <DetailField label={tRoot("modules.archive.legalHold")}>
          <div className="text-sm text-foreground">
            {details.legalHold ? common("yes") : common("no")}
          </div>
        </DetailField>
      </DetailGrid>
      {details.legalHoldReason ? (
        <div className="mt-4 pt-4 border-t border-border/40">
          <DetailLabel className="mb-2">
            {tRoot("modules.archive.legalHoldReason")}
          </DetailLabel>
          <p className="text-sm text-muted-foreground">
            {details.legalHoldReason}
          </p>
        </div>
      ) : null}
      {details.accessRestrictions && details.accessRestrictions.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-border/40">
          <DetailLabel className="mb-2">
            {tRoot("modules.archive.accessRestrictions")}
          </DetailLabel>
          <div className="flex flex-wrap gap-2">
            {details.accessRestrictions.map((restriction) => (
              <span
                key={restriction}
                className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400"
              >
                {restriction}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </DetailSection>
  );
}
