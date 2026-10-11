import type { CaseTaskCaseType } from "@v1/backend/convex/utils/caseTaskValidators";

const CASE_PATHS: Record<CaseTaskCaseType, string> = {
  loan: "/loans",
  accession: "/accessions",
  deaccession: "/deaccessions",
  exhibition: "/exhibitions",
  conservation: "/conservation",
  documentationFinding: "/documentation-quality",
  incident: "/incidents",
  inventoryException: "/inventory/exceptions",
};

export function caseHref(caseType: CaseTaskCaseType, caseId: string) {
  return `${CASE_PATHS[caseType]}/${caseId}`;
}

/** Where a cited record can be inspected; null when the viewer cannot open it. */
export function evidenceHref(evidence: {
  kind: "conditionAssessment" | "movement" | "media" | "auditEntry";
  visible: boolean;
  objectId?: string;
  auditCaseId?: string;
}) {
  if (!evidence.visible) return null;
  if (evidence.kind === "auditEntry") {
    if (evidence.auditCaseId)
      return `/settings/activity?caseId=${encodeURIComponent(evidence.auditCaseId)}`;
    return evidence.objectId ? `/objects/${evidence.objectId}` : null;
  }
  return evidence.objectId ? `/objects/${evidence.objectId}` : null;
}
