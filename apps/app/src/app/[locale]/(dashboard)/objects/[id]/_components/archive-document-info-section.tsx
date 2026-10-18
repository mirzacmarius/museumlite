"use client";

import { FileText } from "lucide-react";

import { useI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"archive">;

interface ArchiveDocumentInfoSectionProps {
  details: DetailsDoc;
}

export function ArchiveDocumentInfoSection({
  details,
}: ArchiveDocumentInfoSectionProps) {
  const tRoot = useI18n();
  return (
    <DetailSection
      title={tRoot("modules.archive.documentInformation")}
      icon={FileText}
    >
      <DetailGrid className="md:grid-cols-2 lg:grid-cols-4">
        <DetailField
          label={tRoot("modules.archive.documentType")}
          value={details.documentType}
        />
        <DetailField
          label={tRoot("modules.archive.retentionCategory")}
          value={details.retentionCategory}
        />
        <DetailField
          label={tRoot("modules.archive.originatingDepartment")}
          value={details.originatingDepartment}
        />
        <DetailField
          label={tRoot("modules.archive.recordSeries")}
          value={details.recordSeries}
        />
      </DetailGrid>
    </DetailSection>
  );
}
