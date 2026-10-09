import { type Infer, v } from "convex/values";

/** Why property was received. An Entry never asserts the institution's title. */
export const entryPurposeValidator = v.union(
  v.literal("acquisition"),
  v.literal("identification"),
  v.literal("deposit"),
  v.literal("research"),
  v.literal("other"),
);

export type EntryPurpose = Infer<typeof entryPurposeValidator>;

/**
 * `in_custody`: held with no acquisition case open. `acquisition_review`: an
 * accession case for the object is open. `accessioned` and `exited` close the
 * entry: the object joined the permanent collection, or left custody.
 */
export const entryStatusValidator = v.union(
  v.literal("in_custody"),
  v.literal("acquisition_review"),
  v.literal("accessioned"),
  v.literal("exited"),
);

export type EntryStatus = Infer<typeof entryStatusValidator>;

/** Handoff of unaccessioned property to a recorded recipient. */
export const entryExitValidator = v.object({
  recipientName: v.string(),
  recipientAccountId: v.optional(v.id("accounts")),
  exitedAt: v.number(),
  reference: v.optional(v.string()),
  notes: v.optional(v.string()),
  fromLocationId: v.optional(v.id("locations")),
  movementId: v.optional(v.id("locationHistory")),
  recordedBy: v.id("users"),
  recordedAt: v.number(),
});

export const objectEntryFields = {
  organizationId: v.id("organizations"),
  /** Temporary identifier; the object's catalog identifier until accession. */
  entryNumber: v.string(),
  normalizedEntryNumber: v.string(),
  collectionId: v.id("collections"),
  purpose: entryPurposeValidator,
  purposeNote: v.optional(v.string()),
  depositorName: v.string(),
  depositorAccountId: v.optional(v.id("accounts")),
  /** The owner as stated at entry; absent when not established. */
  ownerName: v.optional(v.string()),
  ownerAccountId: v.optional(v.id("accounts")),
  receivedAt: v.number(),
  receivedBy: v.id("users"),
  receivedLocationId: v.id("locations"),
  conditionAtEntry: v.string(),
  /** Staff member accountable for the property while it is held. */
  responsibleUserId: v.id("users"),
  /** Agreed liability, insurance or handling responsibility. */
  responsibilityTerms: v.optional(v.string()),
  decisionDueAt: v.optional(v.number()),
  returnDueAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  status: entryStatusValidator,
  accessionId: v.optional(v.id("accessions")),
  /** When the latest acquisition case for this entry was withdrawn. */
  acquisitionDeclinedAt: v.optional(v.number()),
  accessionedAt: v.optional(v.number()),
  exit: v.optional(entryExitValidator),
};
