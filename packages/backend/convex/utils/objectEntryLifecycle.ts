import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { buildUpdatedAccessionState } from "./identifierHistory";
import { ensureIdentifierAvailable } from "./identifiers";
import { entryError } from "./objectEntryErrors";
import { isOpenEntryStatus } from "./objectEntryValidators";

type Ctx = Pick<QueryCtx, "db">;

/** The entry an object is held under, if any. Objects have at most one entry. */
export async function entryForObject(
  ctx: Ctx,
  collectionId: Id<"collections">,
) {
  return await ctx.db
    .query("objectEntries")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .first();
}

/**
 * True when the object came in under an entry that was never accessioned,
 * whether it is still held or was returned. Such property is not part of
 * the collection.
 */
export async function isUnaccessionedEntryObject(
  ctx: Ctx,
  collectionId: Id<"collections">,
) {
  const entry = await entryForObject(ctx, collectionId);
  return entry !== null && entry.status !== "accessioned";
}

/**
 * Refuses actions that only the institution's own collection may undergo,
 * such as deaccession, lending or institution transfer, for property
 * received under an entry that was never accessioned.
 */
export async function assertAccessionedIfEntered(
  ctx: Ctx,
  collectionId: Id<"collections">,
) {
  const entry = await entryForObject(ctx, collectionId);
  if (entry && entry.status !== "accessioned")
    throw entryError(
      "ENTRY_TEMPORARY_CUSTODY",
      `Object is held under entry ${entry.entryNumber} and is not part of the collection`,
    );
}

/** True while the object is held under an entry that is still open. */
export async function isHeldUnderOpenEntry(
  ctx: Ctx,
  collectionId: Id<"collections">,
) {
  const entry = await entryForObject(ctx, collectionId);
  return entry !== null && isOpenEntryStatus(entry.status);
}

/**
 * Property held under an open entry leaves custody only through the entry's
 * exit, and property that exited is not restored to the catalog.
 */
export async function assertEntryAllowsStatus(
  ctx: Ctx,
  collectionId: Id<"collections">,
  nextStatus: Doc<"collections">["status"],
) {
  const entry = await entryForObject(ctx, collectionId);
  if (!entry) return;
  if (
    isOpenEntryStatus(entry.status) &&
    (nextStatus === "archived" || nextStatus === "deleted")
  )
    throw entryError(
      "ENTRY_EXIT_REQUIRED",
      `Record the exit on entry ${entry.entryNumber} instead of withdrawing the object`,
    );
  if (entry.status === "exited" && nextStatus === "active")
    throw entryError(
      "ENTRY_EXITED",
      `The property received under entry ${entry.entryNumber} has left custody`,
    );
}

/** An accession's entry, which must be the one this accession was begun for. */
async function linkedEntry(ctx: Ctx, accession: Doc<"accessions">) {
  if (!accession.entryId) return null;
  const entry = await ctx.db.get(accession.entryId);
  if (
    !entry ||
    entry.organizationId !== accession.organizationId ||
    entry.accessionId !== accession._id
  )
    throw new Error("Accession does not match its entry");
  return entry;
}

/** Refuses draft object data on an accession whose object already exists. */
export function assertNoEntryObjectDraft(accession: Doc<"accessions">) {
  if (accession.entryId)
    throw entryError(
      "ENTRY_OBJECT_RECORDED",
      "This acquisition's object was recorded at entry; edit the object record instead",
    );
}

/**
 * Completes an approved entry acquisition: the entry's object takes its
 * permanent catalog identifier, keeping the entry number in its identifier
 * history, and the entry closes as accessioned.
 */
export async function completeEntryAccession(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
  approvedBy: Id<"users">,
) {
  const entry = await linkedEntry(ctx, accession);
  if (!entry || entry.status === "accessioned") return;
  const object = await ctx.db.get(entry.collectionId);
  if (!object || object.organizationId !== entry.organizationId)
    throw new Error("Entry object not found");
  const identifier = accession.catalogIdentifier ?? accession.accessionNumber;
  const normalizedIdentifier = await ensureIdentifierAvailable(
    ctx,
    entry.organizationId,
    "catalog",
    identifier,
    object._id,
  );
  const now = Date.now();
  await ctx.db.patch(object._id, {
    ...buildUpdatedAccessionState(object, identifier, now),
    normalizedIdentifier,
    lastModifiedBy: approvedBy,
    lastModifiedAt: now,
  });
  await ctx.db.patch(entry._id, { status: "accessioned", accessionedAt: now });
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: entry.organizationId,
    userId: approvedBy,
    action: "entry_accessioned",
    entityType: "objectEntry",
    entityId: entry._id,
    changes: {
      entryNumber: entry.entryNumber,
      collectionId: object._id,
      accessionId: accession._id,
      accessionNumber: identifier,
    },
  });
}

/**
 * Restoring a withdrawn acquisition reopens it only while its entry still
 * holds the object and no other acquisition was begun since.
 */
export async function assertEntryAcquisitionRestorable(
  ctx: Ctx,
  accession: Doc<"accessions">,
) {
  if (!accession.entryId) return;
  const entry = await ctx.db.get(accession.entryId);
  if (!entry || entry.organizationId !== accession.organizationId)
    throw new Error("Accession does not match its entry");
  if (entry.status === "exited")
    throw entryError(
      "ENTRY_EXITED",
      `The property received under entry ${entry.entryNumber} has left custody`,
    );
  if (entry.status !== "in_custody" || entry.accessionId !== accession._id)
    throw entryError(
      "ENTRY_ACQUISITION_OPEN",
      `Entry ${entry.entryNumber} has another acquisition`,
    );
}

/**
 * Follows a reviewer decision on an entry acquisition. Withdrawal returns
 * the entry to plain custody so the property can be returned; restoring
 * reopens the acquisition.
 */
export async function applyEntryReviewDecision(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
  decision: "returned_to_draft" | "withdrawn" | "restored",
  decidedAt: number,
) {
  if (decision === "returned_to_draft") return;
  const entry = await linkedEntry(ctx, accession);
  if (!entry) return;
  await ctx.db.patch(
    entry._id,
    decision === "withdrawn"
      ? { status: "in_custody", acquisitionDeclinedAt: decidedAt }
      : { status: "acquisition_review" },
  );
}
