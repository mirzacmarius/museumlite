import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for form saves that staff can resolve themselves. Clients map
 * them to translated copy and, when `field` is set, show it at that field;
 * `message` is English for logs only.
 */
export const RECORD_EDIT_ERROR_CODES = [
  "EDIT_CONFLICT",
  "RECORD_NOT_EDITABLE",
  "FIELD_REQUIRED",
  "IDENTIFIER_PERMANENT",
  "RELATED_RECORD_UNAVAILABLE",
  "PARENT_IS_SELF",
  "CONDITION_SET_BY_ASSESSMENT",
  "CONDITION_NOTE_REQUIRED",
  "DATE_ORDER_INVALID",
  "PARTY_MANAGED_FIELD",
] as const;

export type RecordEditErrorCode = (typeof RECORD_EDIT_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type RecordEditErrorData = {
  code: RecordEditErrorCode;
  message: string;
  /** Form field the failure belongs to. */
  field?: string;
  /** The record's edit version when a save was refused as stale. */
  currentEditVersion?: string;
};

export function recordEditError(
  code: RecordEditErrorCode,
  message: string,
  details: { field?: string; currentEditVersion?: string } = {},
): ConvexError<RecordEditErrorData> {
  const data: RecordEditErrorData = { code, message };
  if (details.field !== undefined) data.field = details.field;
  if (details.currentEditVersion !== undefined)
    data.currentEditVersion = details.currentEditVersion;
  return new ConvexError(data);
}

/** Reads a record edit error from a thrown error; null for any other failure. */
export function recordEditErrorFromError(
  error: unknown,
): RecordEditErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = RECORD_EDIT_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const result: RecordEditErrorData = {
    code,
    message:
      "message" in data && typeof data.message === "string"
        ? data.message
        : code,
  };
  if ("field" in data && typeof data.field === "string")
    result.field = data.field;
  if (
    "currentEditVersion" in data &&
    typeof data.currentEditVersion === "string"
  )
    result.currentEditVersion = data.currentEditVersion;
  return result;
}

/**
 * Empty strings, empty lists, null and undefined all read as "no value" in a
 * form, so they hash alike; object keys are sorted so field order is moot.
 */
function canonicalValue(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : value.map(canonicalValue);
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .flatMap(([key, item]) => {
        const canonical = canonicalValue(item);
        return canonical === undefined ? [] : [[key, canonical] as const];
      })
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
  }
  return value;
}

/**
 * A record's edit version: a digest of the values its form edits. Any writer
 * that changes one of them changes the version; writes to other fields and
 * saves that change nothing leave it as it was.
 */
export async function editVersionOf(snapshot: Record<string, unknown>) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonicalValue(snapshot) ?? {})),
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Refuses a value that clears a field the record cannot do without. */
export function requireFieldValue(field: string, value: string | undefined) {
  if (value !== undefined && value.trim() === "") {
    throw recordEditError("FIELD_REQUIRED", `${field} is required`, {
      field,
    });
  }
}

/** Refuses a save that started from an older version of the record. */
export function assertCurrentEditVersion(
  currentEditVersion: string,
  expectedEditVersion: string | undefined,
) {
  if (
    expectedEditVersion !== undefined &&
    expectedEditVersion !== currentEditVersion
  ) {
    throw recordEditError(
      "EDIT_CONFLICT",
      "The record changed after this form was opened",
      { currentEditVersion },
    );
  }
}

/** Catalog fields the object form edits; other writers bump the version too. */
const OBJECT_EDIT_FIELDS = [
  "title",
  "alternativeTitle",
  "creator",
  "objectType",
  "objectName",
  "culture",
  "period",
  "dateCreated",
  "materials",
  "technique",
  "dimensions",
  "dimensionDiameter",
  "dimensionHeight",
  "dimensionWidth",
  "dimensionDepth",
  "dimensionWeight",
  "dimensionUnit",
  "weightUnit",
  "description",
  "condition",
  "inscriptions",
  "inscriptionMarks",
  "tags",
  "provenance",
  "exhibitionHistory",
  "ownershipHistory",
  "donated_by",
  "donated_date",
  "donation_info",
  "creditLine",
  "previous_owners",
  "links",
  "parentObjectId",
  "currentLocationId",
  "collectionGroupId",
  "alternateAccessionNumbers",
  "acquisitionMethod",
  "legalRestrictions",
  "isPubliclyVisible",
  "isHighResDownloadable",
  "isSearchable",
  "isValuationVisible",
  "publicSlug",
  "displayStatus",
] as const satisfies ReadonlyArray<keyof Doc<"collections">>;

/** Group memberships an object form can hold; real objects have a handful. */
const OBJECT_GROUP_MEMBERSHIP_LIMIT = 500;

export async function objectEditVersion(
  ctx: QueryCtx,
  collection: Doc<"collections">,
) {
  const memberships = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .take(OBJECT_GROUP_MEMBERSHIP_LIMIT);
  return editVersionOf({
    ...Object.fromEntries(
      OBJECT_EDIT_FIELDS.map((field) => [field, collection[field]]),
    ),
    groups: memberships
      .map((membership) => ({
        id: membership.collectionGroupId,
        role: membership.role,
      }))
      .sort((left, right) => (left.id < right.id ? -1 : 1)),
  });
}

/** The intake form edits the object draft and its attached files. */
export function objectDraftEditVersion(accession: Doc<"accessions">) {
  return editVersionOf({
    draft: accession.draftObjectData,
    media: accession.draftMedia,
  });
}

/** Loan fields the loan form edits, and the party that names the lender. */
const LOAN_EDIT_FIELDS = [
  "accountId",
  "lenderBorrowerName",
  "lenderBorrowerContact",
  "startDate",
  "endDate",
  "terms",
  "insuranceValue",
  "currency",
  "notes",
] as const satisfies ReadonlyArray<keyof Doc<"loans">>;

export function loanEditVersion(loan: Doc<"loans">) {
  return editVersionOf(
    Object.fromEntries(LOAN_EDIT_FIELDS.map((field) => [field, loan[field]])),
  );
}
