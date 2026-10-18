import type { Doc, TableNames } from "../_generated/dataModel";
import { CAPABILITY_MATRIX, type CapabilityId } from "./capabilities";
import type { CaseTaskCaseType } from "./caseTaskValidators";
import { findingLabel } from "./documentationFindings";
import type { FeatureId } from "./featurePolicy";

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
   * events are filed under `${entityType}Id`.
   */
  entityType: EntityType;
}

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
  }),
  accession: define({
    table: "accessions",
    label: (accession) => accession.accessionNumber,
    readPermission: "collections.read",
    workPermission: "collections.update",
    route: "/accessions",
    entityType: "accession",
  }),
  deaccession: define({
    table: "deaccessions",
    label: (deaccession) => deaccession.deaccessionNumber,
    readPermission: "collections.read",
    workPermission: "collections.update",
    route: "/deaccessions",
    entityType: "deaccession",
  }),
  exhibition: define({
    table: "exhibitions",
    label: (exhibition) => exhibition.title,
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "exhibitions",
    route: "/exhibitions",
    entityType: "exhibition",
  }),
  conservation: define({
    table: "conservationTreatments",
    label: (treatment) => treatment.title,
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "conservation",
    route: "/conservation",
    entityType: "conservationTreatment",
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
