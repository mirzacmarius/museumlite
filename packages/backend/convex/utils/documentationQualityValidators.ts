import { type Infer, v } from "convex/values";
import { partyRoleValidator } from "./partyValidators";

/**
 * Where an Object stands, for documentation profiles. `entry`: held under an
 * open Entry and not accessioned. `borrowed`: linked to an incoming loan.
 * `collection`: any other active or lent Object. Withdrawn Objects are not
 * checked.
 */
export const DOCUMENTATION_STAGES = [
  "entry",
  "collection",
  "borrowed",
  "deaccessioned",
] as const;

export const documentationStageValidator = v.union(
  ...DOCUMENTATION_STAGES.map((stage) => v.literal(stage)),
);

export type DocumentationStage = Infer<typeof documentationStageValidator>;

/** What a profile can require of an Object, in display order. */
export const DOCUMENTATION_REQUIREMENTS = [
  "object_name",
  "maker",
  "production_date",
  "materials",
  "dimensions",
  "description",
  "current_location",
  "condition_assessment",
  "image",
  "supporting_document",
  "accession_record",
  "provenance_claim",
] as const;

export const documentationRequirementValidator = v.union(
  ...DOCUMENTATION_REQUIREMENTS.map((requirement) => v.literal(requirement)),
);

export type DocumentationRequirement = Infer<
  typeof documentationRequirementValidator
>;

export const documentationProfileFields = {
  organizationId: v.id("organizations"),
  name: v.string(),
  /** As written in the institution's object types; absent for every type. */
  objectType: v.optional(v.string()),
  normalizedObjectType: v.optional(v.string()),
  stages: v.array(documentationStageValidator),
  requirements: v.array(documentationRequirementValidator),
  status: v.union(v.literal("active"), v.literal("archived")),
  /** Increments with every change to the definition. */
  version: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedBy: v.id("users"),
  updatedAt: v.number(),
};

export const identifierRegisterValidator = v.union(
  v.literal("catalog"),
  v.literal("accession"),
);

export const CHECK_STATUSES = [
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const checkStatusValidator = v.union(
  ...CHECK_STATUSES.map((status) => v.literal(status)),
);

export type CheckStatus = Infer<typeof checkStatusValidator>;

/**
 * `ACTOR_NOT_PERMITTED`: the member the check runs for lost access to it.
 * `PAGE_FAILED`: a single record could not be checked.
 */
export const checkFailureCodeValidator = v.union(
  v.literal("ACTOR_NOT_PERMITTED"),
  v.literal("PAGE_FAILED"),
);

/** A profile as it was when the check started. */
export const checkedProfileValidator = v.object({
  profileId: v.id("documentationProfiles"),
  name: v.string(),
  normalizedObjectType: v.optional(v.string()),
  stages: v.array(documentationStageValidator),
  requirements: v.array(documentationRequirementValidator),
  version: v.number(),
});

export type CheckedProfile = Infer<typeof checkedProfileValidator>;

/** The identifier group a page ended in, continued on the next page. */
export const identifierCarryValidator = v.object({
  normalizedIdentifier: v.string(),
  count: v.number(),
});

export type IdentifierCarry = Infer<typeof identifierCarryValidator>;

export const documentationCheckFields = {
  organizationId: v.id("organizations"),
  /** 1, 2, 3, ... per organization. */
  number: v.number(),
  status: checkStatusValidator,
  requestedBy: v.id("users"),
  /** Whose access the check runs under: whoever started or resumed it. */
  actorId: v.id("users"),
  profiles: v.array(checkedProfileValidator),
  /** False when the Accounts module was off, so party links were not checked. */
  partiesChecked: v.boolean(),
  /** Identifiers not yet indexed are left out of duplicate detection. */
  identifierIndexIncomplete: v.boolean(),
  phase: v.number(),
  cursor: v.union(v.string(), v.null()),
  carry: v.optional(identifierCarryValidator),
  checkpoint: v.number(),
  attempts: v.number(),
  checkedRecords: v.number(),
  detected: v.number(),
  opened: v.number(),
  reopened: v.number(),
  resolved: v.number(),
  startedAt: v.number(),
  /** Last committed page; a running check idle for long can be resumed. */
  updatedAt: v.number(),
  finishedAt: v.optional(v.number()),
  failure: v.optional(
    v.object({ code: checkFailureCodeValidator, message: v.string() }),
  ),
  cancelledBy: v.optional(v.id("users")),
};

export const FINDING_KINDS = [
  "duplicate_identifier",
  "missing_evidence",
  "legacy_link",
  "orphan_reference",
] as const;

export const findingKindValidator = v.union(
  ...FINDING_KINDS.map((kind) => v.literal(kind)),
);

export type FindingKind = Infer<typeof findingKindValidator>;

/**
 * `open`: detected and not reviewed. `accepted`: a reviewed exception kept
 * as recorded. `resolved`: a later check no longer detects it.
 */
export const FINDING_STATUSES = ["open", "accepted", "resolved"] as const;

export const findingStatusValidator = v.union(
  ...FINDING_STATUSES.map((status) => v.literal(status)),
);

export type FindingStatus = Infer<typeof findingStatusValidator>;

export const findingReviewValidator = v.object({
  note: v.string(),
  reviewedBy: v.id("users"),
  reviewedAt: v.number(),
});

export type FindingReview = Infer<typeof findingReviewValidator>;

const findingBaseFields = {
  organizationId: v.id("organizations"),
  /** One finding per detected exception, for example `missing_evidence:<profile>:<object>`. */
  key: v.string(),
  status: findingStatusValidator,
  /** True while open or accepted, that is, detected by the latest check. */
  standing: v.boolean(),
  /** What was found; an accepted finding reopens when it changes. */
  signature: v.string(),
  firstCheckNumber: v.number(),
  lastCheckNumber: v.number(),
  firstDetectedAt: v.number(),
  lastDetectedAt: v.number(),
  resolvedAt: v.optional(v.number()),
  resolvedCheckNumber: v.optional(v.number()),
  reopenedAt: v.optional(v.number()),
  /** The latest acceptance; kept when a changed finding reopens. */
  review: v.optional(findingReviewValidator),
};

const duplicateIdentifierFields = {
  kind: v.literal("duplicate_identifier"),
  register: identifierRegisterValidator,
  normalizedIdentifier: v.string(),
  /** The identifier as the first record carries it. */
  identifier: v.string(),
  /** The first records sharing the identifier, as recorded. */
  records: v.array(
    v.object({
      id: v.union(v.id("collections"), v.id("accessions")),
      identifier: v.string(),
      label: v.string(),
    }),
  ),
  recordCount: v.number(),
};

const missingEvidenceFields = {
  kind: v.literal("missing_evidence"),
  objectId: v.id("collections"),
  objectIdentifier: v.string(),
  objectTitle: v.string(),
  stage: documentationStageValidator,
  profileId: v.id("documentationProfiles"),
  profileName: v.string(),
  missing: v.array(documentationRequirementValidator),
  /** Legacy text the Object carries, shown as recorded and never converted. */
  recorded: v.optional(
    v.object({
      condition: v.optional(v.string()),
      provenance: v.optional(v.string()),
    }),
  ),
};

const legacyLinkFields = {
  kind: v.literal("legacy_link"),
  target: v.union(
    v.object({ type: v.literal("accession"), id: v.id("accessions") }),
    v.object({ type: v.literal("deaccession"), id: v.id("deaccessions") }),
  ),
  label: v.string(),
  /** The name as written on the record. */
  assertedName: v.optional(v.string()),
  /** An account the record references without a typed link. */
  existingAccountId: v.optional(v.id("accounts")),
  suggestedRole: partyRoleValidator,
};

export const ORPHAN_REFERENCE_FIELDS = [
  "parentObject",
  "currentLocation",
  "collectionGroup",
  "object",
  "donorAccount",
] as const;

const orphanReferenceFields = {
  kind: v.literal("orphan_reference"),
  subject: v.union(
    v.object({ type: v.literal("object"), id: v.id("collections") }),
    v.object({ type: v.literal("accession"), id: v.id("accessions") }),
    v.object({ type: v.literal("deaccession"), id: v.id("deaccessions") }),
  ),
  label: v.string(),
  field: v.union(...ORPHAN_REFERENCE_FIELDS.map((field) => v.literal(field))),
  /** The reference exactly as stored. */
  referencedId: v.string(),
  problem: v.union(
    v.literal("missing"),
    v.literal("other_organization"),
    v.literal("self"),
  ),
};

/** What a check found, without its review state. */
export const findingDetailValidator = v.union(
  v.object(duplicateIdentifierFields),
  v.object(missingEvidenceFields),
  v.object(legacyLinkFields),
  v.object(orphanReferenceFields),
);

export type FindingDetail = Infer<typeof findingDetailValidator>;

export const documentationFindingValidator = v.union(
  v.object({ ...findingBaseFields, ...duplicateIdentifierFields }),
  v.object({ ...findingBaseFields, ...missingEvidenceFields }),
  v.object({ ...findingBaseFields, ...legacyLinkFields }),
  v.object({ ...findingBaseFields, ...orphanReferenceFields }),
);

const findingSystemFields = {
  _id: v.id("documentationFindings"),
  _creationTime: v.number(),
};

export const documentationFindingDocValidator = v.union(
  v.object({
    ...findingSystemFields,
    ...findingBaseFields,
    ...duplicateIdentifierFields,
  }),
  v.object({
    ...findingSystemFields,
    ...findingBaseFields,
    ...missingEvidenceFields,
  }),
  v.object({
    ...findingSystemFields,
    ...findingBaseFields,
    ...legacyLinkFields,
  }),
  v.object({
    ...findingSystemFields,
    ...findingBaseFields,
    ...orphanReferenceFields,
  }),
);
