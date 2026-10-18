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
