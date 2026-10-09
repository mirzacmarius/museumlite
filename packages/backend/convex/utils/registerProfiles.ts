import type { Infer } from "convex/values";
import type { registerCriteria, registerProfile } from "./exportContract";
import type { ExportColumn } from "./exportEncoding";

export type RegisterProfile = Infer<typeof registerProfile>;
export type RegisterCriteria = Infer<typeof registerCriteria>;
export type RegisterCell = string | number | boolean | null;
export type RegisterRow = Record<string, RegisterCell>;

/** Bumped whenever a profile's columns or row semantics change. */
export const REGISTER_PROFILE_VERSION = 1;
export const REGISTER_GENERATOR = "MuseumLite register export";
export const REGISTER_PROFILES: readonly RegisterProfile[] = [
  "accession",
  "disposal",
  "custody",
  "condition",
];
/** Profiles whose criteria accept a record status (pending/approved/rejected). */
export const REGISTER_STATUS_PROFILES: readonly RegisterProfile[] = [
  "accession",
  "disposal",
];

function columns(spec: Array<[string, ExportColumn["type"]]>): ExportColumn[] {
  return spec.map(([name, type]) => ({ name, type }));
}

const evidenceColumns: Array<[string, ExportColumn["type"]]> = [
  ["recordedAt", "utcEpochMs"],
  ["evidenceStatus", "text"],
  ["notRecorded", "text"],
  ["capturedAt", "utcEpochMs"],
];

export const REGISTER_COLUMNS: Record<RegisterProfile, ExportColumn[]> = {
  accession: columns([
    ["accessionId", "id"],
    ["accessionNumber", "text"],
    ["catalogIdentifier", "text"],
    ["status", "text"],
    ["dateReceived", "utcEpochMs"],
    ["method", "text"],
    ["source", "text"],
    ["cost", "number"],
    ["objectId", "id"],
    ["objectAccessionNumber", "text"],
    ["objectTitle", "text"],
    ["objectPriorAccessionNumbers", "text"],
    ["sourceVerified", "boolean"],
    ["sourceVerificationException", "boolean"],
    ["identifierConflictReviewed", "boolean"],
    ["approvedAt", "utcEpochMs"],
    ["approvedBy", "id"],
    ["approvedAsOf", "boolean"],
    ["approvalStepsAsOf", "number"],
    ...evidenceColumns,
  ]),
  disposal: columns([
    ["deaccessionId", "id"],
    ["deaccessionNumber", "text"],
    ["category", "text"],
    ["status", "text"],
    ["dateDeaccessioned", "utcEpochMs"],
    ["method", "text"],
    ["reason", "text"],
    ["disposition", "text"],
    ["objectId", "id"],
    ["objectAccessionNumber", "text"],
    ["objectTitle", "text"],
    ["approvedAt", "utcEpochMs"],
    ["approvedBy", "id"],
    ["approvedAsOf", "boolean"],
    ["approvalStepsAsOf", "number"],
    ["decisionPolicyVersion", "number"],
    ["decisionCheckedAt", "utcEpochMs"],
    ["decisionChecksPassed", "boolean"],
    ["decisionException", "boolean"],
    ["exitDate", "utcEpochMs"],
    ["exitRecipient", "text"],
    ["exitReference", "text"],
    ["exitRecordedAsOf", "boolean"],
    ["proceedsAmount", "number"],
    ["proceedsCurrency", "text"],
    ["transferRequestId", "id"],
    ...evidenceColumns,
  ]),
  custody: columns([
    ["eventId", "id"],
    ["evidenceSource", "text"],
    ["eventType", "text"],
    ["eventAt", "utcEpochMs"],
    ["objectId", "id"],
    ["objectAccessionNumber", "text"],
    ["objectTitle", "text"],
    ["movementKind", "text"],
    ["fromLocationId", "id"],
    ["fromLocationName", "text"],
    ["toLocationId", "id"],
    ["toLocationName", "text"],
    ["actorId", "id"],
    ["authorizedBy", "id"],
    ["reason", "text"],
    ["loanId", "id"],
    ["counterparty", "text"],
    ["moveRequestId", "id"],
    ["transitItemId", "id"],
    ["transferRequestId", "id"],
    ...evidenceColumns,
  ]),
  condition: columns([
    ["eventId", "id"],
    ["evidenceSource", "text"],
    ["eventType", "text"],
    ["assessedAt", "utcEpochMs"],
    ["objectId", "id"],
    ["objectAccessionNumber", "text"],
    ["objectTitle", "text"],
    ["condition", "text"],
    ["summary", "text"],
    ["observationCount", "number"],
    ["photoCount", "number"],
    ["assessorId", "id"],
    ["acceptedAt", "utcEpochMs"],
    ["acceptedBy", "id"],
    ["loanId", "id"],
    ["reportDirection", "text"],
    ...evidenceColumns,
  ]),
};

export const REGISTER_CONSISTENCY: Record<RegisterProfile, string> = {
  accession:
    "One row per accession record registered in MuseumLite at or before asOf, ordered by dateReceived. Accession rows are mutable: descriptive values and status are captured at capturedAt. approvedAsOf and approvalStepsAsOf are derived from approval timestamps and append-only case history at or before asOf.",
  disposal:
    "One row per deaccession record registered in MuseumLite at or before asOf, ordered by dateDeaccessioned. category separates policy deaccessions from institution transfers and legacy loan-return records. Deaccession rows are mutable: descriptive values and status are captured at capturedAt; columns suffixed AsOf are derived from timestamps and append-only case history at or before asOf.",
  custody:
    "One row per append-only custody event recorded at or before asOf: movements, loan dispatches and returns, lender exits and institution transfer handoffs. Rows are grouped by object (object creation order, then objects transferred out of the organization), then by evidence source and recording order; sort by eventAt for a chronological view. Locations and events held by another organization are not exported.",
  condition:
    "One row per accepted condition assessment (acceptedAt at or before asOf), loan condition report and legacy condition change. Draft assessments are excluded. Legacy conditions predating retained assessments are marked legacy; their dates and assessors are reported in notRecorded when MuseumLite never recorded them. Rows are grouped by object, then by evidence source.",
};

/** Empty cells listed in notRecorded were never recorded, or not recorded by asOf. */
export function registerRow(
  profile: RegisterProfile,
  values: RegisterRow,
  notRecorded: string[],
): RegisterRow {
  const row: RegisterRow = {};
  for (const column of REGISTER_COLUMNS[profile]) {
    const value = values[column.name];
    row[column.name] = value === undefined ? null : value;
  }
  row.notRecorded = notRecorded.length ? notRecorded.join(";") : null;
  return row;
}
