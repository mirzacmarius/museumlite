import { type Infer, v } from "convex/values";

/**
 * A historical date known only as precisely as its source states it. The
 * fields present follow `precision`; a decade is stored as its first year
 * (1920 for the 1920s). Never converted to a timestamp (ADR 0006).
 */
export const historicalDatePrecisionValidator = v.union(
  v.literal("day"),
  v.literal("month"),
  v.literal("year"),
  v.literal("decade"),
);

export type HistoricalDatePrecision = Infer<
  typeof historicalDatePrecisionValidator
>;

/**
 * `circa`: approximate. `notAfter`: on or before ("by 1937"). `notBefore`:
 * on or after.
 */
export const historicalDateQualifierValidator = v.union(
  v.literal("circa"),
  v.literal("notAfter"),
  v.literal("notBefore"),
);

export type HistoricalDateQualifier = Infer<
  typeof historicalDateQualifierValidator
>;

export const historicalDateValidator = v.object({
  precision: historicalDatePrecisionValidator,
  year: v.number(),
  month: v.optional(v.number()),
  day: v.optional(v.number()),
  qualifier: v.optional(historicalDateQualifierValidator),
  /** The source itself is unsure of the date ("1937?"). */
  uncertain: v.optional(v.boolean()),
});

export type HistoricalDate = Infer<typeof historicalDateValidator>;

/** How the holder related to the Object; also the role of its Party link. */
export const provenanceRoleValidator = v.union(
  v.literal("owner"),
  v.literal("custodian"),
);

export type ProvenanceRole = Infer<typeof provenanceRoleValidator>;

export const PROVENANCE_ROLES: readonly ProvenanceRole[] = [
  "owner",
  "custodian",
];

/**
 * `named`: the source names the holder. `anonymous`: the source says there
 * was a holder without naming them ("private collection"). `unknown`: no
 * holder is known for the period.
 */
export const provenancePartyKindValidator = v.union(
  v.literal("named"),
  v.literal("anonymous"),
  v.literal("unknown"),
);

export type ProvenancePartyKind = Infer<typeof provenancePartyKindValidator>;

export const provenanceMethodValidator = v.union(
  v.literal("purchase"),
  v.literal("auction"),
  v.literal("gift"),
  v.literal("bequest"),
  v.literal("inheritance"),
  v.literal("exchange"),
  v.literal("commission"),
  v.literal("fieldCollection"),
  v.literal("confiscation"),
  v.literal("restitution"),
  v.literal("other"),
);

export type ProvenanceMethod = Infer<typeof provenanceMethodValidator>;

export const PROVENANCE_METHODS: readonly ProvenanceMethod[] = [
  "purchase",
  "auction",
  "gift",
  "bequest",
  "inheritance",
  "exchange",
  "commission",
  "fieldCollection",
  "confiscation",
  "restitution",
  "other",
];

/** The author's confidence in the claim; part of the immutable assertion. */
export const provenanceConfidenceValidator = v.union(
  v.literal("documented"),
  v.literal("probable"),
  v.literal("possible"),
  v.literal("unassessed"),
);

export type ProvenanceConfidence = Infer<typeof provenanceConfidenceValidator>;

export const PROVENANCE_CONFIDENCES: readonly ProvenanceConfidence[] = [
  "documented",
  "probable",
  "possible",
  "unassessed",
];

export const provenanceReviewStatusValidator = v.union(
  v.literal("unreviewed"),
  v.literal("accepted"),
  v.literal("disputed"),
  v.literal("rejected"),
);

export type ProvenanceReviewStatus = Infer<
  typeof provenanceReviewStatusValidator
>;

export const provenanceReviewDecisionValidator = v.union(
  v.literal("accepted"),
  v.literal("disputed"),
  v.literal("rejected"),
);

export type ProvenanceReviewDecision = Infer<
  typeof provenanceReviewDecisionValidator
>;

/** The assertion as recorded; shared by capture and correction. */
export const provenanceAssertionFields = {
  statement: v.string(),
  role: provenanceRoleValidator,
  partyKind: provenancePartyKindValidator,
  /** The holder as the source names or describes them. */
  partyText: v.optional(v.string()),
  method: v.optional(provenanceMethodValidator),
  place: v.optional(v.string()),
  startDate: v.optional(historicalDateValidator),
  endDate: v.optional(historicalDateValidator),
  confidence: provenanceConfidenceValidator,
};

export const provenanceClaimDocumentValidator = v.object({
  organizationId: v.id("organizations"),
  objectId: v.id("collections"),
  ...provenanceAssertionFields,
  /** A current claim on the same Object that this claim disagrees with. */
  contradictsClaimId: v.optional(v.id("provenanceClaims")),
  /** The claim this one corrects. */
  supersedesClaimId: v.optional(v.id("provenanceClaims")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  reviewStatus: provenanceReviewStatusValidator,
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  reviewNote: v.optional(v.string()),
  supersededAt: v.optional(v.number()),
  supersededBy: v.optional(v.id("users")),
  /** Absent when the claim was retracted without a replacement. */
  supersededByClaimId: v.optional(v.id("provenanceClaims")),
  supersessionReason: v.optional(v.string()),
});

/** A source cited for a claim, as entered by staff. */
export const provenanceEvidenceSourceValidator = v.union(
  v.object({
    kind: v.literal("citation"),
    citation: v.string(),
    url: v.optional(v.string()),
  }),
  v.object({ kind: v.literal("media"), mediaId: v.id("mediaFiles") }),
);

export type ProvenanceEvidenceSource = Infer<
  typeof provenanceEvidenceSourceValidator
>;

export const provenanceEvidenceInputValidator = v.object({
  source: provenanceEvidenceSourceValidator,
  /** What the source says, quoted as read. */
  excerpt: v.optional(v.string()),
  /** Page, folio, lot or similar position in the source. */
  locator: v.optional(v.string()),
});

export type ProvenanceEvidenceInput = Infer<
  typeof provenanceEvidenceInputValidator
>;

const provenanceEvidenceFields = {
  organizationId: v.id("organizations"),
  objectId: v.id("collections"),
  claimId: v.id("provenanceClaims"),
  excerpt: v.optional(v.string()),
  locator: v.optional(v.string()),
  /** The evidence row this one was copied from when a claim was corrected. */
  carriedFromEvidenceId: v.optional(v.id("provenanceEvidence")),
  linkedBy: v.id("users"),
  linkedAt: v.number(),
  retractedAt: v.optional(v.number()),
  retractedBy: v.optional(v.id("users")),
  retractionReason: v.optional(v.string()),
};

/** Stored evidence: its citation or file-name snapshot is never rewritten. */
export const provenanceEvidenceDocumentValidator = v.union(
  v.object({
    ...provenanceEvidenceFields,
    kind: v.literal("citation"),
    citation: v.string(),
    url: v.optional(v.string()),
  }),
  v.object({
    ...provenanceEvidenceFields,
    kind: v.literal("media"),
    mediaId: v.id("mediaFiles"),
    fileNameSnapshot: v.string(),
  }),
);
