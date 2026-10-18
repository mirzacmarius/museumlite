"use client";

import { FileText, Trash2 } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import {
  DetailField,
  DetailGrid,
  DetailLabel,
  DetailSection,
} from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"archive">;

interface ArchiveAccessSectionProps {
  details: DetailsDoc;
}

export function ArchiveAccessSection({ details }: ArchiveAccessSectionProps) {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const common = useScopedI18n("modules.common");

  return (
    <>
      <DetailSection
        title={tRoot("modules.archive.physicalDigitalLocation")}
        icon={FileText}
      >
        <DetailGrid className="md:grid-cols-2 lg:grid-cols-4">
          <DetailField
            label={tRoot("modules.archive.boxNumber")}
            value={details.boxNumber}
          />
          <DetailField
            label={tRoot("modules.archive.folderNumber")}
            value={details.folderNumber}
          />
          <DetailField
            label={tRoot("modules.archive.fileFormat")}
            value={details.fileFormat}
          />
          <DetailField label={tRoot("modules.archive.fileSize")}>
            <div className="text-sm text-foreground">
              {details.fileSize
                ? `${(details.fileSize / 1024 / 1024).toFixed(2)} MB`
                : "—"}
            </div>
          </DetailField>
        </DetailGrid>
        {details.pageCount ? (
          <div className="mt-4 pt-4 border-t border-border/40">
            <DetailLabel className="mb-2">
              {tRoot("modules.archive.documentDetails")}
            </DetailLabel>
            <DetailGrid>
              <DetailField
                label={tRoot("modules.archive.pageCount")}
                value={details.pageCount}
              />
              <DetailField label={tRoot("modules.archive.ocrProcessed")}>
                <div className="text-sm text-foreground">
                  {details.ocrProcessed ? common("yes") : common("no")}
                </div>
              </DetailField>
            </DetailGrid>
          </div>
        ) : null}
        {details.keywords && details.keywords.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-border/40">
            <DetailLabel className="mb-2">
              {tRoot("modules.archive.keywords")}
            </DetailLabel>
            <div className="flex flex-wrap gap-2">
              {details.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </DetailSection>

      {details.flaggedForDestruction ? (
        <DetailSection
          title={tRoot("modules.archive.destructionInformation")}
          icon={Trash2}
          bodyClassName="border-0 bg-transparent p-0 sm:p-0"
        >
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <DetailGrid className="md:grid-cols-3">
              <DetailField label={tRoot("modules.archive.destructionDate")}>
                <div className="text-sm text-foreground">
                  {details.destructionDate ? (
                    <ClientDateFns
                      timestamp={details.destructionDate}
                      format="MMM d, yyyy"
                      locale={locale}
                    />
                  ) : (
                    "—"
                  )}
                </div>
              </DetailField>
              <DetailField
                label={tRoot("modules.archive.destructionMethod")}
                value={details.destructionMethod}
              />
              <DetailField
                label={tRoot("modules.archive.witnessedBy")}
                value={details.destructionWitnessedBy}
              />
            </DetailGrid>
          </div>
        </DetailSection>
      ) : null}
    </>
  );
}
