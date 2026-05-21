"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ArchiveAccessSection } from "./archive-access-section";
import { ArchiveDocumentInfoSection } from "./archive-document-info-section";
import { ArchiveRetentionSection } from "./archive-retention-section";
import { ArchiveSecuritySection } from "./archive-security-section";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

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
