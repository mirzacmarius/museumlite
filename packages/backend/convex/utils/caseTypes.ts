import type { Doc, TableNames } from "../_generated/dataModel";
import { isAwaitingReview } from "./accessionReview";
import { CAPABILITY_MATRIX, type CapabilityId } from "./capabilities";
import type { CaseTaskCaseType } from "./caseTaskValidators";
import { findingLabel } from "./documentationFindings";
import type { FeatureId } from "./featurePolicy";

/** How a case of this kind waits for approval on the Work board. */
interface CaseApproval<Table extends TableNames> {
  /** The status a case waits for approval in. */
  status: "pending" | "proposed";
  /** Whether a case in that status is waiting; every one is unless this says no. */
  isWaiting?(record: Doc<Table>): boolean;
  /** When the case began waiting; its SLA and urgency count from here. */
  waitingSince(record: Doc<Table>): number;
  /** The line under the case's label on its approval card. */
  detail(record: Doc<Table>): string | undefined;
  /**
   * Opening the list of waiting cases needs this Capability, or the read
   * permission when unset, so the card never links to a page that refuses.
   */
  listCapability?: Extract<
    CapabilityId,
    "deaccession" | "loans" | "exhibitions" | "conservation"
  >;
  /** The case list filtered to cases waiting for approval as of `asOf`. */
  listHref(asOf: number): string;
}

interface CaseTypeDefinition<
  Table extends TableNames,
  EntityType extends string,
> {
  table: Table;
  label(record: Doc<Table>): string;
  /** Opening the case needs it unless `capability` is set; its notifications always do. */
  readPermission: "loans.read" | "collections.read" | "locations.read";
  /** Owning, reviewing and managing the case's Tasks needs it. */
  workPermission: "loans.update" | "collections.update" | "locations.update";
  /** Plan entitlement that opening the case needs. */
  feature?: Extract<FeatureId, "loans" | "exhibitions" | "conservation">;
  /** Opening the case needs this Capability's permissions instead of the read permission. */
  capability?: Extract<
    CapabilityId,
    "documentation_quality" | "incidents" | "inventory"
  >;
  /** A case opens in the app at `${route}/${id}`. */
  route: string;
  /**
   * Names the case in notifications and in the audit log, where its Task
   * events carry it as `${entityType}Id`.
   */
  entityType: EntityType;
  /**
   * False keeps the case's audit entries from being filed under it, so the
   * audit log cannot be filtered by the case and its Tasks cannot cite them.
   */
  auditCase?: false;
  /** Set when the case waits for approval, at the workflow step it records. */
  approval?: CaseApproval<Table>;
}

function define<Table extends TableNames, const EntityType extends string>(
  definition: CaseTypeDefinition<Table, EntityType> & {
    approval: CaseApproval<Table>;
  },
): CaseTypeDefinition<Table, EntityType> & { approval: CaseApproval<Table> };
function define<Table extends TableNames, const EntityType extends string>(
  definition: CaseTypeDefinition<Table, EntityType>,
): CaseTypeDefinition<Table, EntityType>;
function define<Table extends TableNames, const EntityType extends string>(
  definition: CaseTypeDefinition<Table, EntityType>,
) {
  return definition;
}

/**
 * One definition per kind of Case that can hold Tasks. Loading a case, the
 * Task queues, labels, notifications and links all read it, so a new kind of
 * Case is one entry here. It is plain data so the app reads Case links from
 * it too.
 */
export const CASE_TYPES = {
  loan: define({
    table: "loans",
    label: (loan) => loan.loanNumber,
    readPermission: "loans.read",
    workPermission: "loans.update",
    feature: "loans",
    route: "/loans",
    entityType: "loan",
    approval: {
      status: "pending",
      waitingSince: (loan) => loan.startDate,
      detail: (loan) => loan.lenderBorrowerName,
      listCapability: "loans",
      listHref: () => "/loans?status=pending",
    },
  }),
  accession: define({
    table: "accessions",
    label: (accession) => accession.accessionNumber,
    readPermission: "collections.read",
    workPermission: "collections.update",
    route: "/accessions",
    entityType: "accession",
    approval: {
      status: "pending",
      isWaiting: (accession) => isAwaitingReview(accession),
      waitingSince: (accession) => accession.dateReceived,
      detail: (accession) => accession.source,
      // The whole board: its review columns and the Approved list (MUS-804).
      listHref: () => "/accessions",
    },
  }),
  deaccession: define({
    table: "deaccessions",
    label: (deaccession) => deaccession.deaccessionNumber,
    readPermission: "collections.read",
    workPermission: "collections.update",
    route: "/deaccessions",
    entityType: "deaccession",
    approval: {
      status: "pending",
      waitingSince: (deaccession) => deaccession.dateDeaccessioned,
      detail: (deaccession) => deaccession.reason,
      listCapability: "deaccession",
      listHref: () => "/deaccessions?status=pending",
    },
  }),
  exhibition: define({
    table: "exhibitions",
    label: (exhibition) => exhibition.title,
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "exhibitions",
    route: "/exhibitions",
    entityType: "exhibition",
    approval: {
      status: "proposed",
      waitingSince: (exhibition) => exhibition.startDate,
      detail: (exhibition) => exhibition.location,
      listCapability: "exhibitions",
      listHref: (asOf) => `/exhibitions?lifecycle=proposed&asOf=${asOf}`,
    },
  }),
  conservation: define({
    table: "conservationTreatments",
    label: (treatment) => treatment.title,
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "conservation",
    route: "/conservation",
    entityType: "conservationTreatment",
    approval: {
      status: "proposed",
      waitingSince: (treatment) => treatment.performedAt,
      detail: (treatment) => treatment.treatmentType,
      listCapability: "conservation",
      listHref: () => "/conservation?status=proposed",
    },
  }),
  documentationFinding: define({
    table: "documentationFindings",
    label: findingLabel,
    readPermission: "collections.read",
    workPermission: "collections.update",
    capability: "documentation_quality",
    route: "/documentation-quality",
    entityType: "documentationFinding",
  }),
  incident: define({
    table: "incidents",
    label: (incident) => incident.incidentNumber,
    readPermission: "collections.read",
    workPermission: "collections.update",
    capability: "incidents",
    route: "/incidents",
    entityType: "incident",
    // The incident's scoped event log is its timeline (ADR 0015).
    auditCase: false,
  }),
  // Searching, relabelling and returning objects is location work (ADR 0014).
  inventoryException: define({
    table: "inventoryExceptions",
    label: (exception) => exception.label,
    readPermission: "locations.read",
    workPermission: "locations.update",
    capability: "inventory",
    route: "/inventory/exceptions",
    entityType: "inventoryException",
  }),
} satisfies Record<CaseTaskCaseType, CaseTypeDefinition<TableNames, string>>;

type CaseTable<T extends CaseTaskCaseType> = (typeof CASE_TYPES)[T]["table"];

type AnyCaseRecord = {
  [K in CaseTaskCaseType]: { caseType: K; doc: Doc<CaseTable<K>> };
}[CaseTaskCaseType];

/** A loaded case, its document typed by its case type. */
export type CaseRecord<T extends CaseTaskCaseType = CaseTaskCaseType> = Extract<
  AnyCaseRecord,
  { caseType: T }
>;

export type CaseEntityType =
  (typeof CASE_TYPES)[CaseTaskCaseType]["entityType"];

/** The kinds of Case that wait for approval. */
export type ApprovalCaseType = {
  [K in CaseTaskCaseType]: undefined extends (typeof CASE_TYPES)[K]["approval"]
    ? never
    : K;
}[CaseTaskCaseType];

export const APPROVAL_CASE_TYPES = (
  Object.keys(CASE_TYPES) as CaseTaskCaseType[]
).filter(
  (caseType): caseType is ApprovalCaseType =>
    CASE_TYPES[caseType].approval !== undefined,
);

/**
 * When a case began waiting for approval and the line its card shows, or
 * null when its status alone does not mean it is waiting.
 */
export function waitingApproval(record: CaseRecord<ApprovalCaseType>) {
  // The record pairs each case type with its own table's document.
  const approval = CASE_TYPES[record.caseType].approval as CaseApproval<
    CaseTable<ApprovalCaseType>
  >;
  if (approval.isWaiting && !approval.isWaiting(record.doc)) return null;
  return {
    waitingSince: approval.waitingSince(record.doc),
    detail: approval.detail(record.doc),
  };
}

/** The list of this kind's cases waiting for approval, as of `asOf`. */
export function approvalListHref(caseType: ApprovalCaseType, asOf: number) {
  return CASE_TYPES[caseType].approval.listHref(asOf);
}

export function caseLabel(record: CaseRecord): string {
  // The record pairs each case type with its own table's document.
  const label = CASE_TYPES[record.caseType].label as (
    doc: CaseRecord["doc"],
  ) => string;
  return label(record.doc);
}

export function caseHref(caseType: CaseTaskCaseType, caseId: string) {
  return `${CASE_TYPES[caseType].route}/${caseId}`;
}

/** The case type a notification or audit entity type names, if any. */
export function caseTypeOfEntity(
  entityType: string,
): CaseTaskCaseType | undefined {
  return (Object.keys(CASE_TYPES) as CaseTaskCaseType[]).find(
    (caseType) => CASE_TYPES[caseType].entityType === entityType,
  );
}

/** The permissions that opening a case of this kind requires. */
export function caseReadPermissions(
  caseType: CaseTaskCaseType,
): readonly string[] {
  const { readPermission, capability } = CASE_TYPES[caseType];
  return capability
    ? CAPABILITY_MATRIX[capability].permissions
    : [readPermission];
}

/** Owners and reviewers need both the read and the work permission of the case kind. */
export function canWorkWith(
  permissions: ReadonlySet<string> | null,
  caseType: CaseTaskCaseType,
) {
  return (
    !!permissions &&
    caseReadPermissions(caseType).every((name) => permissions.has(name)) &&
    permissions.has(CASE_TYPES[caseType].workPermission)
  );
}
