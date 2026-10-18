"use client";

import { ArchiveAccessSection } from "./archive-access-section";
import { ArchiveDocumentInfoSection } from "./archive-document-info-section";
import { ArchiveRetentionSection } from "./archive-retention-section";
import { ArchiveSecuritySection } from "./archive-security-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"archive">;

interface ArchiveDetailsSectionsProps {
  details: DetailsDoc;
}

export function ArchiveDetailsSections({
  details,
}: ArchiveDetailsSectionsProps) {
  return (
    <>
      <ArchiveDocumentInfoSection details={details} />
      <ArchiveRetentionSection details={details} />
      <ArchiveSecuritySection details={details} />
      <ArchiveAccessSection details={details} />
    </>
  );
}
