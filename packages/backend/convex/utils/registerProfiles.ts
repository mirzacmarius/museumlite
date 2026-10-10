import type { Infer } from "convex/values";
import type { registerCriteria, registerProfile } from "./exportContract";
import type { ExportColumn } from "./exportEncoding";
import type { FeatureId } from "./featurePolicy";

export type RegisterProfile = Infer<typeof registerProfile>;
export type RegisterCriteria = Infer<typeof registerCriteria>;
export type RegisterCell = string | number | boolean | null;
export type RegisterRow = Record<string, RegisterCell>;

/** Each profile's version, bumped whenever its columns or row semantics change. */
export const REGISTER_PROFILE_VERSIONS: Record<RegisterProfile, number> = {
  accession: 2,
  disposal: 2,
  custody: 2,
  condition: 2,
  valuation: 1,
  insurance: 1,
  provenance: 1,
};
export const REGISTER_GENERATOR = "MuseumLite register export";
export const REGISTER_PROFILES: readonly RegisterProfile[] = [
  "accession",
  "disposal",
  "custody",
  "condition",
  "valuation",
  "insurance",
  "provenance",
];
/**
 * Member permissions each profile needs, besides its plan features.
 * Custody and condition registers include loan and location evidence.
 */
export const REGISTER_PERMISSIONS: Record<RegisterProfile, readonly string[]> =
  {
    accession: ["collections.read"],
    disposal: ["collections.read"],
    custody: ["collections.read", "locations.read", "loans.read"],
    condition: ["collections.read", "loans.read"],
    valuation: ["collections.read"],
    insurance: ["collections.read", "loans.read"],
    // Evidence names the Object's files.
    provenance: ["collections.read", "media.read"],
  };
/**
 * Plan features each profile needs. Every profile is reporting; the insurer
 * schedule also needs the plan that includes insurance (loans).
 */
export const REGISTER_FEATURES: Record<RegisterProfile, readonly FeatureId[]> =
  {
    accession: ["reporting"],
    disposal: ["reporting"],
    custody: ["reporting"],
    condition: ["reporting"],
    valuation: ["reporting"],
    insurance: ["reporting", "loans"],
    provenance: ["reporting"],
  };
export interface RegisterTotalsSpec {
  /** Columns whose values form each total's group, besides currency. */
  groupBy: readonly string[];
  amountColumn: string;
  currencyColumn: string;
}
/** Profiles with monetary columns, totalled per group and currency. */
export const REGISTER_TOTALS: Partial<
  Record<RegisterProfile, RegisterTotalsSpec>
> = {
  valuation: {
    groupBy: ["inventoryScope", "purpose"],
    amountColumn: "value",
    currencyColumn: "currency",
  },
  insurance: {
    groupBy: ["stateAsOf"],
    amountColumn: "coveredValue",
    currencyColumn: "currency",
  },
};
export const REGISTER_TOTALS_DEFINITION =
  "Exact sums of amountColumn over every row in the artifact, per groupBy values and recognised ISO 4217 currency in currencyColumn. Amounts are never added across currencies or converted between them. total is exact decimal text. Rows whose currency is missing or not a recognised code are counted under currency null and not summed; rows without an amount are not counted.";
/** The criteria each profile accepts; any other criterion is refused. */
export const REGISTER_CRITERIA_FIELDS: Record<
  RegisterProfile,
  ReadonlyArray<keyof RegisterCriteria>
> = {
  accession: ["fromDate", "toDate", "status", "asOf", "objectId"],
  disposal: ["fromDate", "toDate", "status", "asOf", "objectId"],
  custody: ["fromDate", "toDate", "asOf", "objectId"],
  condition: ["fromDate", "toDate", "asOf", "objectId"],
  valuation: ["asOf", "objectId", "purpose", "currency", "inventoryScope"],
  insurance: ["asOf", "policyId", "currency"],
  provenance: ["asOf", "objectId"],
};

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
  valuation: columns([
    ["objectId", "id"],
    ["objectAccessionNumber", "text"],
    ["objectTitle", "text"],
    ["objectStatus", "text"],
    ["inventoryScope", "text"],
    ["purpose", "text"],
    ["currency", "text"],
    ["currencyRecognized", "boolean"],
    ["value", "number"],
    ["validityAsOf", "text"],
    ["appraisalId", "id"],
    ["appraisalDate", "utcEpochMs"],
    ["validUntil", "utcEpochMs"],
    ["renewalDueAt", "utcEpochMs"],
    ["appraiserName", "text"],
    ["appraiserCompany", "text"],
    ["appraiserCredentials", "text"],
    ["supersedesAppraisalId", "id"],
    ["supersessionReason", "text"],
    ...evidenceColumns,
  ]),
  insurance: columns([
    ["coverageId", "id"],
    ["policyId", "id"],
    ["policyNumber", "text"],
    ["carrier", "text"],
    ["policyType", "text"],
    ["policyStatusAsOf", "text"],
    ["policyEffectiveDate", "utcEpochMs"],
    ["policyExpirationDate", "utcEpochMs"],
    ["targetKind", "text"],
    ["targetId", "id"],
    ["targetReference", "text"],
    ["targetLabel", "text"],
    ["coveredValue", "number"],
    ["currency", "text"],
    ["currencyRecognized", "boolean"],
    ["coverageStart", "utcEpochMs"],
    ["coverageEnd", "utcEpochMs"],
    ["stateAsOf", "text"],
    ["appraisalStatusAsOf", "text"],
    ["appraisalId", "id"],
    ["appraisalValue", "number"],
    ["appraisalDate", "utcEpochMs"],
    ["appraiserName", "text"],
    ...evidenceColumns,
  ]),
  provenance: columns([
    ["recordType", "text"],
    ["objectId", "id"],
    ["objectAccessionNumber", "text"],
    ["objectTitle", "text"],
    ["claimId", "id"],
    ["currentAsOf", "boolean"],
    ["statement", "text"],
    ["partyKind", "text"],
    ["partyText", "text"],
    ["role", "text"],
    ["method", "text"],
    ["place", "text"],
    ["startDate", "text"],
    ["endDate", "text"],
    ["confidence", "text"],
    ["reviewStatusAsOf", "text"],
    ["reviewedAt", "utcEpochMs"],
    ["reviewedBy", "id"],
    ["reviewNote", "text"],
    ["contradictsClaimId", "id"],
    ["contestedAsOf", "boolean"],
    ["supersedesClaimId", "id"],
    ["supersededAt", "utcEpochMs"],
    ["supersededByClaimId", "id"],
    ["supersessionReason", "text"],
    ["evidenceId", "id"],
    ["evidenceKind", "text"],
    ["citation", "text"],
    ["url", "text"],
    ["mediaId", "id"],
    ["fileName", "text"],
    ["excerpt", "text"],
    ["locator", "text"],
    ["retractedAt", "utcEpochMs"],
    ["retractionReason", "text"],
    ["legacyStartYear", "text"],
    ["legacyEndYear", "text"],
    ["legacyVerified", "boolean"],
    ...evidenceColumns,
  ]),
};

export const REGISTER_CONSISTENCY: Record<RegisterProfile, string> = {
  accession:
    "One row per accession record registered in MuseumLite at or before asOf, ordered by dateReceived. Accession rows are mutable: descriptive values and status are captured at capturedAt. approvedAsOf and approvalStepsAsOf are derived from approval timestamps and append-only case history at or before asOf.",
  disposal:
    "One row per deaccession record registered in MuseumLite at or before asOf, ordered by dateDeaccessioned. category separates policy deaccessions from institution transfers and legacy loan-return records. Deaccession rows are mutable: descriptive values and status are captured at capturedAt; columns suffixed AsOf are derived from timestamps and append-only case history at or before asOf.",
  custody:
    "One row per append-only custody event recorded at or before asOf: movements, loan dispatches and returns, lender exits, institution transfer handoffs, and receipts into and exits from temporary custody under an entry. Rows are grouped by object (object creation order, then objects transferred out of the organization), then by evidence source and recording order; sort by eventAt for a chronological view. Locations and events held by another organization are not exported.",
  condition:
    "One row per accepted condition assessment (acceptedAt at or before asOf), loan condition report, condition stated at entry and legacy condition change. Draft assessments are excluded. Assessments and conditions stored on the object record follow the object on institution transfer, so they appear in the register of the organization that now holds them; loan condition reports stay with the loan's organization. Legacy conditions predating retained assessments are marked legacy; their dates and assessors are reported in notRecorded when MuseumLite never recorded them. Rows are grouped by object, then by evidence source.",
  valuation:
    "One row per current valuation at asOf of each object the organization holds that was catalogued by asOf: the latest appraisal per object, purpose and currency that was recorded by asOf and not superseded by asOf. An object without a current valuation has one row with validityAsOf none. Values are never converted between currencies. Appraisals are immutable, so a historical asOf reproduces the valuations then current; objectStatus and inventoryScope (operational_inventory_v1) are captured at capturedAt. Rows follow object catalogue order, then purpose and currency.",
  insurance:
    "One row per insurance coverage recorded by asOf, in recording order. stateAsOf and policyStatusAsOf are judged at asOf from the coverage interval (its own dates, else the policy period) and the policy period; removal, cancellation and suspension have no recorded time and are captured at capturedAt, as are other mutable policy and coverage values. A legacy coverage naming several targets is needs_review until a person resolves it. The supporting insurance valuation is the current insurance appraisal at asOf in the coverage's currency, for object targets only; it is stale when past its three-year age or valid-until date. Covered loans and exhibitions are not expanded into their objects.",
  provenance:
    "Per object, one row per provenance claim recorded by asOf (recordType claim), then one per evidence item linked by asOf (evidence), then the legacy free-text provenance (legacy_text) and ownership history entries (legacy_ownership). Claims are immutable assertions: a claim corrected or retracted after asOf is current at asOf, and its review status is the latest decision made by asOf. Claims current at asOf come first in chronological order of their partial dates, then claims corrected or retracted by asOf, most recent first. Partial dates are EDTF (ISO 8601-2) and never timestamps. Legacy text and ownership entries are undated catalogue fields captured at capturedAt; nothing is migrated into claims. Objects follow the custody register's order, including objects transferred out, whose claims stay with the organization that recorded them.",
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
