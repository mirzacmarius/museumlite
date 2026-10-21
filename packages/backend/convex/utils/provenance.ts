import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requirePermission } from "./permissions";
import { provenanceError } from "./provenanceErrors";
import type {
  HistoricalDate,
  ProvenanceAssertion,
  ProvenanceEvidenceInput,
} from "./provenanceValidators";

export const PROVENANCE_REVIEW_PERMISSION = "collections.review_provenance";

/** Claims read per Object, including superseded history. */
export const MAX_CLAIMS_PER_OBJECT = 200;
/** Evidence rows read per Object or per claim. */
export const MAX_EVIDENCE_PER_OBJECT = 500;
export const MAX_EVIDENCE_PER_CLAIM = 50;
/** Review decisions read per Object. */
export const MAX_REVIEWS_PER_OBJECT = 500;
/** Provenance rows one transaction moves to the Object's new organization. */
const REHOME_BATCH = 100;
/** Transfer requests of one Object read to find where its provenance is. */
const OBJECT_MOVE_REQUEST_LIMIT = 50;

const TEXT_LIMITS = {
  // Legacy provenance text can be long; it is turned into a claim whole.
  statement: 10000,
  partyText: 500,
  place: 200,
  citation: 2000,
  url: 2000,
  excerpt: 4000,
  locator: 200,
  reason: 1000,
  note: 2000,
} as const;

type TextField = keyof typeof TEXT_LIMITS;

/** Trimmed text within its limit; undefined when blank. */
export function optionalProvenanceText(
  value: string | undefined,
  field: TextField,
): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (text.length > TEXT_LIMITS[field]) {
    throw provenanceError(
      "PROVENANCE_TEXT_TOO_LONG",
      `The ${field} is longer than ${TEXT_LIMITS[field]} characters`,
    );
  }
  return text;
}

export function isWithdrawnObject(
  object: Pick<Doc<"collections">, "status"> | null,
) {
  return object?.status === "archived" || object?.status === "deleted";
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Proleptic Gregorian month length. */
function daysInMonth(year: number, month: number) {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

function invalidDate(label: string): never {
  throw provenanceError("PROVENANCE_DATE_INVALID", `The ${label} is invalid`);
}

/**
 * Checks that a partial date states exactly the parts its precision names
 * and that they form a real calendar date (years 1 to 9999).
 */
export function validateHistoricalDate(
  date: HistoricalDate,
  label: string,
): HistoricalDate {
  const { precision, year, month, day } = date;
  if (!Number.isInteger(year) || year < 1 || year > 9999) invalidDate(label);
  const needsMonth = precision === "day" || precision === "month";
  if (needsMonth !== (month !== undefined)) invalidDate(label);
  if ((precision === "day") !== (day !== undefined)) invalidDate(label);
  if (
    month !== undefined &&
    (!Number.isInteger(month) || month < 1 || month > 12)
  )
    invalidDate(label);
  if (
    day !== undefined &&
    (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month ?? 1))
  )
    invalidDate(label);
  if (precision === "decade" && year % 10 !== 0) invalidDate(label);
  return {
    precision,
    year,
    month,
    day,
    qualifier: date.qualifier,
    uncertain: date.uncertain === true ? true : undefined,
  };
}

/** Earliest and latest calendar days a partial date covers, as yyyymmdd. */
export function historicalDateSpan(date: HistoricalDate) {
  const key = (year: number, month: number, day: number) =>
    year * 10000 + month * 100 + day;
  switch (date.precision) {
    case "day":
      return {
        earliest: key(date.year, date.month ?? 1, date.day ?? 1),
        latest: key(date.year, date.month ?? 1, date.day ?? 1),
      };
    case "month":
      return {
        earliest: key(date.year, date.month ?? 1, 1),
        latest: key(
          date.year,
          date.month ?? 12,
          daysInMonth(date.year, date.month ?? 12),
        ),
      };
    case "year":
      return {
        earliest: key(date.year, 1, 1),
        latest: key(date.year, 12, 31),
      };
    case "decade":
      return {
        earliest: key(date.year, 1, 1),
        latest: key(date.year + 9, 12, 31),
      };
  }
}

/**
 * Rejects a period that cannot have happened: its latest possible end is
 * before its earliest possible start. Circa dates and open bounds ("by",
 * "after") only constrain the side they state.
 */
export function assertHistoricalPeriod(
  startDate: HistoricalDate | undefined,
  endDate: HistoricalDate | undefined,
) {
  if (!startDate || !endDate) return;
  const startEarliest =
    startDate.qualifier === undefined || startDate.qualifier === "notBefore"
      ? historicalDateSpan(startDate).earliest
      : Number.NEGATIVE_INFINITY;
  const endLatest =
    endDate.qualifier === undefined || endDate.qualifier === "notAfter"
      ? historicalDateSpan(endDate).latest
      : Number.POSITIVE_INFINITY;
  if (endLatest < startEarliest) {
    throw provenanceError(
      "PROVENANCE_DATE_ORDER_INVALID",
      "The end date is before the start date",
    );
  }
}

/** Chronological position of a claim: its start, else its end, else last. */
export function provenanceClaimSortKey(
  claim: Pick<Doc<"provenanceClaims">, "startDate" | "endDate">,
) {
  const date = claim.startDate ?? claim.endDate;
  return date ? historicalDateSpan(date).earliest : Number.POSITIVE_INFINITY;
}

/**
 * The partial date as an Extended Date/Time Format (ISO 8601-2) string:
 * "1937-03", "192X", "1920~", "1937?", "[..1937]" or "[1925..]".
 */
export function historicalDateEdtf(date: HistoricalDate): string {
  const year = String(date.year).padStart(4, "0");
  const pad = (value: number | undefined) =>
    String(value ?? 1).padStart(2, "0");
  let value: string;
  switch (date.precision) {
    case "day":
      value = `${year}-${pad(date.month)}-${pad(date.day)}`;
      break;
    case "month":
      value = `${year}-${pad(date.month)}`;
      break;
    case "year":
      value = year;
      break;
    case "decade":
      value = `${year.slice(0, 3)}X`;
      break;
  }
  const circa = date.qualifier === "circa";
  if (circa && date.uncertain) value += "%";
  else if (circa) value += "~";
  else if (date.uncertain) value += "?";
  if (date.qualifier === "notAfter") return `[..${value}]`;
  if (date.qualifier === "notBefore") return `[${value}..]`;
  return value;
}

/**
 * Validates an assertion as entered. Nothing is filled in: a holder, date,
 * method or place the source does not give stays absent.
 */
export function validatedProvenanceAssertion(
  input: ProvenanceAssertion,
): ProvenanceAssertion {
  const statement = optionalProvenanceText(input.statement, "statement");
  if (!statement) {
    throw provenanceError(
      "PROVENANCE_STATEMENT_REQUIRED",
      "The claim needs its statement as written",
    );
  }
  const partyText = optionalProvenanceText(input.partyText, "partyText");
  if (input.partyKind === "named" && !partyText) {
    throw provenanceError(
      "PROVENANCE_PARTY_NAME_REQUIRED",
      "A named holder needs the name the source gives",
    );
  }
  if (input.partyKind === "unknown" && partyText) {
    throw provenanceError(
      "PROVENANCE_PARTY_INVALID",
      "An unknown holder has no name or description",
    );
  }
  const startDate = input.startDate
    ? validateHistoricalDate(input.startDate, "start date")
    : undefined;
  const endDate = input.endDate
    ? validateHistoricalDate(input.endDate, "end date")
    : undefined;
  assertHistoricalPeriod(startDate, endDate);
  return {
    statement,
    role: input.role,
    partyKind: input.partyKind,
    partyText,
    method: input.method,
    place: optionalProvenanceText(input.place, "place"),
    startDate,
    endDate,
    confidence: input.confidence,
  };
}

export function requiredProvenanceReason(reason: string): string {
  const text = optionalProvenanceText(reason, "reason");
  if (!text) {
    throw provenanceError("PROVENANCE_REASON_REQUIRED", "A reason is required");
  }
  return text;
}

type ProvenanceAccess = "read" | "write" | "review";

/**
 * Loads an Object and enforces the caller's access to its provenance:
 * `collections.read` to read, `collections.update` to record and
 * `collections.review_provenance` to review. Writes are refused on withdrawn
 * Objects until they are restored, and while part of a transferred Object's
 * provenance is still on its way, so no change is decided from part of it.
 */
export async function requireProvenanceObject(
  ctx: QueryCtx | MutationCtx,
  objectId: Id<"collections">,
  access: ProvenanceAccess,
): Promise<Doc<"collections">> {
  const object = await ctx.db.get(objectId);
  if (!object) {
    throw provenanceError("PROVENANCE_OBJECT_NOT_FOUND", "Object not found");
  }
  await requirePermission(
    ctx,
    object.organizationId,
    access === "read"
      ? "collections.read"
      : access === "write"
        ? "collections.update"
        : PROVENANCE_REVIEW_PERMISSION,
  );
  if (access !== "read" && isWithdrawnObject(object)) {
    throw provenanceError(
      "PROVENANCE_OBJECT_WITHDRAWN",
      "Restore the Object before changing its provenance",
    );
  }
  if (
    access !== "read" &&
    (await provenanceArrivingFrom(ctx, object)).length > 0
  ) {
    provenanceStillArriving();
  }
  return object;
}

/** Refuses a change while part of the Object's provenance is still arriving. */
export function provenanceStillArriving(): never {
  throw provenanceError(
    "PROVENANCE_STILL_ARRIVING",
    "Part of this Object's provenance is still arriving from an organization that held it before",
  );
}

/** Loads a claim and its Object with the caller's access enforced. */
export async function requireProvenanceClaim(
  ctx: QueryCtx | MutationCtx,
  claimId: Id<"provenanceClaims">,
  access: ProvenanceAccess,
) {
  const claim = await ctx.db.get(claimId);
  if (!claim) {
    throw provenanceError("PROVENANCE_CLAIM_NOT_FOUND", "Claim not found");
  }
  const object = await requireProvenanceObject(ctx, claim.objectId, access);
  if (object.organizationId !== claim.organizationId) {
    throw provenanceError("PROVENANCE_CLAIM_NOT_FOUND", "Claim not found");
  }
  return { claim, object };
}

export function assertCurrentClaim(claim: Doc<"provenanceClaims">) {
  if (claim.supersededAt !== undefined) {
    throw provenanceError(
      "PROVENANCE_CLAIM_SUPERSEDED",
      "This claim was already corrected or retracted",
    );
  }
}

export async function loadObjectClaims(
  ctx: QueryCtx | MutationCtx,
  object: Pick<Doc<"collections">, "_id" | "organizationId">,
) {
  return await ctx.db
    .query("provenanceClaims")
    .withIndex("by_organization_and_objectId_and_supersededAt", (q) =>
      q.eq("organizationId", object.organizationId).eq("objectId", object._id),
    )
    .take(MAX_CLAIMS_PER_OBJECT);
}

/**
 * Moves an Object's provenance claims, their evidence and their review
 * decisions from one organization to another, when the Object moves there.
 * Re-homing changes which organization holds a claim, never what it says
 * (ADR 0006). Party links stay with the organization whose accounts they
 * name. One call moves up to REHOME_BATCH rows and schedules the rest.
 */
export async function rehomeObjectProvenance(
  ctx: MutationCtx,
  args: {
    objectId: Id<"collections">;
    fromOrganizationId: Id<"organizations">;
    toOrganizationId: Id<"organizations">;
  },
) {
  const claims = await ctx.db
    .query("provenanceClaims")
    .withIndex("by_organization_and_objectId_and_supersededAt", (q) =>
      q
        .eq("organizationId", args.fromOrganizationId)
        .eq("objectId", args.objectId),
    )
    .take(REHOME_BATCH);
  const evidence =
    claims.length < REHOME_BATCH
      ? await ctx.db
          .query("provenanceEvidence")
          .withIndex("by_organization_and_objectId", (q) =>
            q
              .eq("organizationId", args.fromOrganizationId)
              .eq("objectId", args.objectId),
          )
          .take(REHOME_BATCH - claims.length)
      : [];
  const read = claims.length + evidence.length;
  const reviews =
    read < REHOME_BATCH
      ? await ctx.db
          .query("provenanceReviews")
          .withIndex("by_organization_and_objectId", (q) =>
            q
              .eq("organizationId", args.fromOrganizationId)
              .eq("objectId", args.objectId),
          )
          .take(REHOME_BATCH - read)
      : [];
  const organizationId = args.toOrganizationId;
  await Promise.all([
    ...claims.map((claim) => ctx.db.patch(claim._id, { organizationId })),
    ...evidence.map((row) => ctx.db.patch(row._id, { organizationId })),
    ...reviews.map((review) => ctx.db.patch(review._id, { organizationId })),
  ]);
  const moved = read + reviews.length;
  if (moved === REHOME_BATCH) {
    await ctx.scheduler.runAfter(0, internal.provenance.rehomeRemaining, {
      objectId: args.objectId,
      fromOrganizationId: args.fromOrganizationId,
    });
  }
  return moved;
}

/**
 * The organizations a transferred Object left that still hold part of its
 * provenance; none once all of it is with the organization holding the
 * Object. A long history moves in batches, possibly behind a later transfer,
 * and provenance a transfer left behind before it moved with its Object
 * stays until the repair moves it. Only the Object's latest
 * OBJECT_MOVE_REQUEST_LIMIT transfer requests, of any status, are read.
 */
export async function provenanceArrivingFrom(
  ctx: QueryCtx | MutationCtx,
  object: Pick<Doc<"collections">, "_id" | "organizationId">,
): Promise<Id<"organizations">[]> {
  const requests = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
    .order("desc")
    .take(OBJECT_MOVE_REQUEST_LIMIT);
  const sources = [
    ...new Set(
      requests
        .filter(
          (request) =>
            request.status === "executed" &&
            request.sourceOrganizationId !== object.organizationId,
        )
        .map((request) => request.sourceOrganizationId),
    ),
  ];
  const held = await Promise.all(
    sources.map((organizationId) =>
      holdsProvenance(ctx, organizationId, object._id),
    ),
  );
  return sources.filter((_, index) => held[index]);
}

/** Whether an organization holds any of an Object's claims, evidence or reviews. */
export async function holdsProvenance(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  objectId: Id<"collections">,
) {
  const [claim, evidence, review] = await Promise.all([
    ctx.db
      .query("provenanceClaims")
      .withIndex("by_organization_and_objectId_and_supersededAt", (q) =>
        q.eq("organizationId", organizationId).eq("objectId", objectId),
      )
      .first(),
    ctx.db
      .query("provenanceEvidence")
      .withIndex("by_organization_and_objectId", (q) =>
        q.eq("organizationId", organizationId).eq("objectId", objectId),
      )
      .first(),
    ctx.db
      .query("provenanceReviews")
      .withIndex("by_organization_and_objectId", (q) =>
        q.eq("organizationId", organizationId).eq("objectId", objectId),
      )
      .first(),
  ]);
  return claim !== null || evidence !== null || review !== null;
}

export async function loadClaimEvidence(
  ctx: QueryCtx | MutationCtx,
  claim: Pick<Doc<"provenanceClaims">, "_id" | "organizationId">,
) {
  return await ctx.db
    .query("provenanceEvidence")
    .withIndex("by_organization_and_claimId", (q) =>
      q.eq("organizationId", claim.organizationId).eq("claimId", claim._id),
    )
    .take(MAX_EVIDENCE_PER_CLAIM);
}

type ClaimLineage = Pick<
  Doc<"provenanceClaims">,
  "_id" | "contradictsClaimId" | "supersededByClaimId"
>;

/**
 * The current version of a claim: corrections are followed to their latest
 * replacement. A retracted claim is its own last version.
 */
export function currentClaimVersion<T extends ClaimLineage>(
  claimsById: ReadonlyMap<Id<"provenanceClaims">, T>,
  claimId: Id<"provenanceClaims">,
): Id<"provenanceClaims"> {
  let id = claimId;
  for (let step = 0; step < MAX_CLAIMS_PER_OBJECT; step++) {
    const next = claimsById.get(id)?.supersededByClaimId;
    if (!next) break;
    id = next;
  }
  return id;
}

/**
 * Whether a claim takes part in a contradiction with another claim of its
 * Object, counting corrections of either side.
 */
export function isContestedClaim<T extends ClaimLineage>(
  claim: T,
  claimsById: ReadonlyMap<Id<"provenanceClaims">, T>,
): boolean {
  if (claim.contradictsClaimId) return true;
  for (const other of claimsById.values()) {
    if (
      other.contradictsClaimId &&
      currentClaimVersion(claimsById, other.contradictsClaimId) === claim._id
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Retracting a reviewed or contested claim takes it out of review, so it
 * needs a reviewer; a researcher may retract an unreviewed, uncontested one.
 */
export function retractionNeedsReviewer<T extends ClaimLineage>(
  claim: T & Pick<Doc<"provenanceClaims">, "reviewStatus">,
  claimsById: ReadonlyMap<Id<"provenanceClaims">, T>,
): boolean {
  return (
    claim.reviewStatus !== "unreviewed" || isContestedClaim(claim, claimsById)
  );
}

/**
 * A claim a new claim may be recorded against: current and about the same
 * Object.
 */
export async function requireContradictedClaim(
  ctx: QueryCtx | MutationCtx,
  object: Pick<Doc<"collections">, "_id" | "organizationId">,
  claimId: Id<"provenanceClaims">,
) {
  const claim = await ctx.db.get(claimId);
  if (
    !claim ||
    claim.organizationId !== object.organizationId ||
    claim.objectId !== object._id ||
    claim.supersededAt !== undefined
  ) {
    throw provenanceError(
      "PROVENANCE_CONTRADICTION_INVALID",
      "A claim can only contradict a current claim about the same Object",
    );
  }
  return claim;
}

/** Fields of a stored evidence row that the server, not the input, sets. */
type EvidenceRecordFields =
  | "_id"
  | "_creationTime"
  | "organizationId"
  | "objectId"
  | "claimId"
  | "carriedFromEvidenceId"
  | "linkedBy"
  | "linkedAt"
  | "retractedAt"
  | "retractedBy"
  | "retractionReason";

/** Evidence as validated from input: a stored row without its record fields. */
export type ValidatedEvidence =
  Doc<"provenanceEvidence"> extends infer Row
    ? Row extends unknown
      ? Omit<Row, EvidenceRecordFields>
      : never
    : never;

function invalidEvidence(message: string): never {
  throw provenanceError("PROVENANCE_EVIDENCE_INVALID", message);
}

/**
 * Validates evidence as entered. A cited file must be one of the Object's
 * own media and needs `media.read`; its name is kept as recorded.
 */
export async function validatedEvidence(
  ctx: QueryCtx | MutationCtx,
  object: Pick<Doc<"collections">, "_id" | "organizationId">,
  input: ProvenanceEvidenceInput,
): Promise<ValidatedEvidence> {
  const excerpt = optionalProvenanceText(input.excerpt, "excerpt");
  const locator = optionalProvenanceText(input.locator, "locator");
  if (input.source.kind === "citation") {
    const citation = optionalProvenanceText(input.source.citation, "citation");
    if (!citation) invalidEvidence("A citation needs its text");
    const url = optionalProvenanceText(input.source.url, "url");
    if (url && !/^https?:\/\//i.test(url)) {
      invalidEvidence("A source link must start with http:// or https://");
    }
    return { kind: "citation", citation, url, excerpt, locator };
  }
  await requirePermission(ctx, object.organizationId, "media.read");
  const media = await ctx.db.get(input.source.mediaId);
  if (
    !media ||
    media.organizationId !== object.organizationId ||
    media.collectionId !== object._id
  ) {
    invalidEvidence("The file must be attached to this Object");
  }
  return {
    kind: "media",
    mediaId: media._id,
    fileNameSnapshot: media.fileName,
    excerpt,
    locator,
  };
}
