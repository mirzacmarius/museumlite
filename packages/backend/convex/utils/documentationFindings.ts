import type { Doc } from "../_generated/dataModel";

type Finding = Doc<"documentationFindings">;

/** The identifier a finding is filed under, as the check recorded it. */
export function findingLabel(finding: Finding): string {
  switch (finding.kind) {
    case "missing_evidence":
      return finding.objectIdentifier;
    case "duplicate_identifier":
      return finding.identifier;
    case "legacy_link":
    case "orphan_reference":
      return finding.label;
  }
}

export interface FindingRecordRef {
  type: "object" | "accession" | "deaccession";
  id: string;
}

/** The records a finding is about, where staff repair them. */
export function findingRecords(finding: Finding): FindingRecordRef[] {
  switch (finding.kind) {
    case "missing_evidence":
      return [{ type: "object", id: finding.objectId }];
    case "duplicate_identifier":
      return finding.records.map((record) => ({
        type: finding.register === "catalog" ? "object" : "accession",
        id: record.id,
      }));
    case "legacy_link":
      return [finding.target];
    case "orphan_reference":
      return [finding.subject];
  }
}

/** Objects whose evidence can support repair work on the finding. */
export function findingObjectIds(finding: Finding): string[] {
  return findingRecords(finding).flatMap((record) =>
    record.type === "object" ? [record.id] : [],
  );
}
