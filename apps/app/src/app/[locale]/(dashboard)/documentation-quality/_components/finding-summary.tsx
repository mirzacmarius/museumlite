"use client";

import type { FindingStatus } from "@v1/backend/convex/utils/documentationQualityValidators";
import { Badge } from "@v1/ui/badge";
import { useScopedI18n } from "@/locales/client";
import type { Finding } from "./quality-repair";

/** One line saying what a check found, using the values it recorded. */
export function FindingSummary({ finding }: { finding: Finding }) {
  const t = useScopedI18n("documentationQuality");
  switch (finding.kind) {
    case "duplicate_identifier":
      return (
        <>
          {t("summary.duplicateIdentifier", {
            identifier: finding.identifier,
            count: finding.recordCount,
            register: t(`registers.${finding.register}`),
          })}
        </>
      );
    case "missing_evidence":
      return (
        <>
          {t("summary.missingEvidence", {
            identifier: finding.objectIdentifier,
            title: finding.objectTitle,
            missing: finding.missing
              .map((requirement) => t(`requirements.${requirement}`))
              .join(", "),
          })}
        </>
      );
    case "legacy_link":
      return (
        <>
          {finding.assertedName
            ? t("summary.legacyName", {
                label: finding.label,
                name: finding.assertedName,
              })
            : t("summary.legacyAccount", { label: finding.label })}
        </>
      );
    case "orphan_reference":
      return (
        <>
          {t("summary.orphanReference", {
            label: finding.label,
            field: t(`orphanFields.${finding.field}`),
            problem: t(`orphanProblems.${finding.problem}`),
          })}
        </>
      );
  }
}

const STATUS_VARIANTS = {
  open: "default",
  accepted: "secondary",
  resolved: "outline",
} as const satisfies Record<FindingStatus, "default" | "secondary" | "outline">;

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const t = useScopedI18n("documentationQuality.statuses");
  return <Badge variant={STATUS_VARIANTS[status]}>{t(status)}</Badge>;
}
