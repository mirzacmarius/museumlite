import { type Infer, v } from "convex/values";

/**
 * Contextual roles a Party (an `accounts` record) plays in an institutional
 * procedure. The role belongs to the link, not to the account.
 */
export const partyRoleValidator = v.union(
  v.literal("donor"),
  v.literal("lender"),
  v.literal("borrower"),
  v.literal("owner"),
  /** Held the Object without asserted title (provenance claims). */
  v.literal("custodian"),
  v.literal("appraiser"),
  v.literal("recipient"),
);

export type PartyRole = Infer<typeof partyRoleValidator>;

export const PARTY_ROLES: readonly PartyRole[] = [
  "donor",
  "lender",
  "borrower",
  "owner",
  "custodian",
  "appraiser",
  "recipient",
];

export const partyTargetTypeValidator = v.union(
  v.literal("accession"),
  v.literal("loan"),
  v.literal("deaccession"),
  v.literal("provenanceClaim"),
  v.literal("appraisal"),
  v.literal("collection"),
);

export type PartyTargetType = Infer<typeof partyTargetTypeValidator>;

/** A procedure record a Party can be linked to, typed by its table. */
export const partyTargetValidator = v.union(
  v.object({ type: v.literal("accession"), id: v.id("accessions") }),
  v.object({ type: v.literal("loan"), id: v.id("loans") }),
  v.object({ type: v.literal("deaccession"), id: v.id("deaccessions") }),
  v.object({
    type: v.literal("provenanceClaim"),
    id: v.id("provenanceClaims"),
  }),
  v.object({ type: v.literal("appraisal"), id: v.id("appraisals") }),
  v.object({ type: v.literal("collection"), id: v.id("collections") }),
);

export type PartyTarget = Infer<typeof partyTargetValidator>;

export const partyTargetIdValidator = v.union(
  v.id("accessions"),
  v.id("loans"),
  v.id("deaccessions"),
  v.id("provenanceClaims"),
  v.id("appraisals"),
  v.id("collections"),
);

const partyLinkFields = {
  organizationId: v.id("organizations"),
  accountId: v.id("accounts"),
  role: partyRoleValidator,
  /** The Party's display name when the link was made; never rewritten. */
  nameSnapshot: v.string(),
  /** The Party's contact details when the link was made; never rewritten. */
  contactSnapshot: v.optional(v.string()),
  /** The name as written on the procedure record, kept when it differs. */
  assertedName: v.optional(v.string()),
  /**
   * When the role starts. Absent when the linked record keeps the role's
   * dates itself as partial historical dates (provenance claims, ADR 0006).
   */
  effectiveFrom: v.optional(v.number()),
  effectiveTo: v.optional(v.number()),
  origin: v.union(v.literal("staff"), v.literal("backfill")),
  createdBy: v.optional(v.id("users")),
  createdAt: v.number(),
  supersededAt: v.optional(v.number()),
  supersededBy: v.optional(v.id("users")),
  supersededByLinkId: v.optional(v.id("partyLinks")),
  supersessionReason: v.optional(v.string()),
};

/** Stored party link: the target type and target ID are paired by table. */
export const partyLinkDocumentValidator = v.union(
  v.object({
    ...partyLinkFields,
    targetType: v.literal("accession"),
    targetId: v.id("accessions"),
  }),
  v.object({
    ...partyLinkFields,
    targetType: v.literal("loan"),
    targetId: v.id("loans"),
  }),
  v.object({
    ...partyLinkFields,
    targetType: v.literal("deaccession"),
    targetId: v.id("deaccessions"),
  }),
  v.object({
    ...partyLinkFields,
    targetType: v.literal("provenanceClaim"),
    targetId: v.id("provenanceClaims"),
  }),
  v.object({
    ...partyLinkFields,
    targetType: v.literal("appraisal"),
    targetId: v.id("appraisals"),
  }),
  v.object({
    ...partyLinkFields,
    targetType: v.literal("collection"),
    targetId: v.id("collections"),
  }),
);

export const duplicateReasonValidator = v.union(
  v.literal("name"),
  v.literal("email"),
  v.literal("phone"),
);

export type DuplicateReason = Infer<typeof duplicateReasonValidator>;

export const duplicateReviewStatusValidator = v.union(
  v.literal("pending"),
  v.literal("dismissed"),
  v.literal("confirmed_distinct"),
);

export const duplicateReviewDecisionValidator = v.union(
  v.literal("dismissed"),
  v.literal("confirmed_distinct"),
);

/** A suggested pair of possibly-duplicate Parties. Never merged. */
export const partyDuplicateReviewDocumentValidator = v.object({
  organizationId: v.id("organizations"),
  /** The lower account ID of the pair, so a pair has one review. */
  firstAccountId: v.id("accounts"),
  secondAccountId: v.id("accounts"),
  pairKey: v.string(),
  reasons: v.array(duplicateReasonValidator),
  status: duplicateReviewStatusValidator,
  suggestedAt: v.number(),
  suggestedBy: v.optional(v.id("users")),
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  note: v.optional(v.string()),
});

export const partySummaryValidator = v.object({
  _id: v.id("accounts"),
  accountNumber: v.string(),
  displayName: v.string(),
  holderType: v.union(v.literal("organization"), v.literal("privatePerson")),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  contactPerson: v.optional(v.string()),
  archived: v.boolean(),
});

export type PartySummary = Infer<typeof partySummaryValidator>;
