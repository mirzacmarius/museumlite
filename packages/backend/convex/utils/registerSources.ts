import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  REGISTER_STATUS_PROFILES,
  type RegisterCriteria,
  type RegisterProfile,
  type RegisterRow,
  registerRow,
} from "./registerProfiles";

export interface RegisterScope {
  organizationId: Id<"organizations">;
  profile: RegisterProfile;
  criteria: RegisterCriteria;
  /** Effective as-of: evidence recorded after this time is excluded. */
  asOf: number;
  capturedAt: number | null;
}
export interface RegisterPage {
  rows: RegisterRow[];
  cursor: string | null;
  done: boolean;
  scanned: number;
}

const RECORD_PAGE_SIZE = 25;
const SUBJECT_BUDGET = 25;
const EVIDENCE_BUDGET = 200;
/** Evidence records read per source call, so the row budget is checked often. */
const SOURCE_BATCH = 20;
/** Serialized row characters per page; keeps encoded chunks below 512 KiB. */
const ROW_CHARACTER_BUDGET = 128 * 1024;
const MAX_APPROVAL_STEPS = 200;
const MAX_LINKED_RECORDS = 100;
const MAX_REPORTS_PER_LOAN_ITEM = 20;
const LOWEST_DATE = -Number.MAX_VALUE;
const HIGHEST_DATE = Number.MAX_VALUE;

export const REGISTER_CRITERIA_INVALID = "REGISTER_CRITERIA_INVALID";

/** Linked-record lookups fail visibly instead of truncating silently. */
function boundedLinks<T>(records: T[], what: string) {
  if (records.length > MAX_LINKED_RECORDS)
    throw new ConvexError(
      `Register ${what} exceed processing limits (${MAX_LINKED_RECORDS} per object)`,
    );
  return records;
}

/**
 * The latest executed transfer that took the object out of this
 * organization, or null. Only that transfer makes it a register subject.
 */
async function latestTransferOut(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  const requests = boundedLinks(
    await ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .take(MAX_LINKED_RECORDS + 1),
    "transfer requests",
  );
  let latest: Doc<"organizationMoveRequests"> | null = null;
  for (const request of requests)
    if (
      request.sourceOrganizationId === organizationId &&
      request.status === "executed" &&
      (!latest || request._creationTime > latest._creationTime)
    )
      latest = request;
  return latest;
}

/**
 * Validates register criteria and the tenant of every referenced ID. `now`
 * is omitted by queries, which cannot read the clock.
 */
export async function validateRegisterCriteria(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  profile: RegisterProfile,
  criteria: RegisterCriteria,
  now?: number,
) {
  const { fromDate, toDate, asOf, status, objectId } = criteria;
  if (
    [fromDate, toDate, asOf].some(
      (date) => date !== undefined && (!Number.isFinite(date) || date < 0),
    ) ||
    (fromDate !== undefined && toDate !== undefined && fromDate > toDate) ||
    (asOf !== undefined && now !== undefined && asOf > now) ||
    (status !== undefined && !REGISTER_STATUS_PROFILES.includes(profile))
  )
    throw new ConvexError({
      code: REGISTER_CRITERIA_INVALID,
      message: "Invalid register criteria",
    });
  if (objectId) {
    const object = await ctx.db.get(objectId);
    if (
      !object ||
      (object.organizationId !== organizationId &&
        !(await latestTransferOut(ctx, organizationId, objectId)))
    )
      throw new ConvexError("Filter outside organization");
  }
}

function inDateRange(criteria: RegisterCriteria, time: number | undefined) {
  if (time === undefined)
    return criteria.fromDate === undefined && criteria.toDate === undefined;
  return (
    (criteria.fromDate === undefined || time >= criteria.fromDate) &&
    (criteria.toDate === undefined || time <= criteria.toDate)
  );
}

/**
 * Approval steps (step 1 and later) recorded by as-of. Step 0 is the
 * submission marker written when a workflow case is created, not an
 * approval. Steps held only in the record's embedded history are legacy.
 */
async function approvalHistoryAsOf(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: "accession" | "deaccession",
  entityId: string,
  legacy: Array<{ step: number; approvedAt: number }> | undefined,
  asOf: number,
) {
  const legacySteps = (legacy ?? []).filter(
    (entry) => entry.step > 0 && entry.approvedAt <= asOf,
  );
  const entries = await ctx.db
    .query("caseHistoryEntries")
    .withIndex("by_organization_and_caseType_and_entityId_and_ordinal", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("caseType", caseType)
        .eq("entityId", entityId)
        .gte("ordinal", legacy?.length ?? 0),
    )
    .take(MAX_APPROVAL_STEPS + 1);
  if (entries.length + (legacy?.length ?? 0) > MAX_APPROVAL_STEPS)
    throw new ConvexError(
      `Register record history exceeds processing limits (${MAX_APPROVAL_STEPS} approval steps)`,
    );
  const recorded = entries.filter(
    (row) => row.entry.step > 0 && row.entry.approvedAt <= asOf,
  );
  return {
    steps: legacySteps.length + recorded.length,
    legacy:
      legacySteps.length > 0 ||
      recorded.some((row) => row.evidenceStatus === "legacy"),
  };
}

function approvalColumns(
  record: {
    status: string;
    approvedAt?: number;
    approvedBy?: Id<"users">;
  },
  asOf: number,
  notRecorded: string[],
) {
  let missing = false;
  if (record.status === "approved") {
    if (record.approvedAt === undefined) notRecorded.push("approvedAt");
    if (record.approvedBy === undefined) notRecorded.push("approvedBy");
    missing =
      record.approvedAt === undefined || record.approvedBy === undefined;
  }
  return {
    missing,
    columns: {
      approvedAt: record.approvedAt ?? null,
      approvedBy: record.approvedBy ?? null,
      approvedAsOf:
        record.approvedAt !== undefined && record.approvedAt <= asOf,
    },
  };
}

async function accessionPage(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: string | null,
): Promise<RegisterPage> {
  const { organizationId, criteria, asOf } = scope;
  const { status, objectId } = criteria;
  const from = criteria.fromDate ?? LOWEST_DATE;
  const to = criteria.toDate ?? HIGHEST_DATE;
  const opts = { numItems: RECORD_PAGE_SIZE, cursor };
  const page = objectId
    ? await ctx.db
        .query("accessions")
        .withIndex("by_collection", (q) => q.eq("collectionId", objectId))
        .paginate(opts)
    : status
      ? await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_status_and_dateReceived", (q) =>
            q
              .eq("organizationId", organizationId)
              .eq("status", status)
              .gte("dateReceived", from)
              .lte("dateReceived", to),
          )
          .paginate(opts)
      : await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_dateReceived", (q) =>
            q
              .eq("organizationId", organizationId)
              .gte("dateReceived", from)
              .lte("dateReceived", to),
          )
          .paginate(opts);
  const rows: RegisterRow[] = [];
  for (const accession of page.page) {
    if (
      accession.organizationId !== organizationId ||
      accession._creationTime > asOf ||
      (status !== undefined && accession.status !== status) ||
      !inDateRange(criteria, accession.dateReceived)
    )
      continue;
    const notRecorded: string[] = [];
    const [object, history, reviews] = await Promise.all([
      accession.collectionId ? ctx.db.get(accession.collectionId) : null,
      approvalHistoryAsOf(
        ctx,
        organizationId,
        "accession",
        accession._id,
        accession.workflowHistory,
        asOf,
      ),
      ctx.db
        .query("identifierConflictReviews")
        .withIndex("by_organization_and_register_and_record", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("register", "accession")
            .eq("recordId", accession._id),
        )
        .take(MAX_LINKED_RECORDS + 1),
    ] as const);
    const heldObject =
      object?.organizationId === organizationId ? object : null;
    if (accession.status === "approved" && !accession.collectionId)
      notRecorded.push("objectId");
    if (accession.collectionId && !heldObject)
      notRecorded.push("objectAccessionNumber", "objectTitle");
    const approval = approvalColumns(accession, asOf, notRecorded);
    boundedLinks(reviews, "identifier reviews");
    // Every number the object held by as-of other than its current number,
    // including the one in force at as-of when it has since been replaced.
    const priorNumbers = new Set<string>();
    for (const entry of heldObject?.accessionNumberHistory ?? [])
      if (
        entry.validFrom <= asOf &&
        entry.number !== heldObject?.accessionNumber
      )
        priorNumbers.add(entry.number);
    rows.push(
      registerRow(
        "accession",
        {
          accessionId: accession._id,
          accessionNumber: accession.accessionNumber,
          catalogIdentifier: accession.catalogIdentifier ?? null,
          status: accession.status,
          dateReceived: accession.dateReceived,
          method: accession.method,
          source: accession.source,
          cost: accession.cost ?? null,
          objectId: accession.collectionId ?? null,
          objectAccessionNumber: heldObject?.accessionNumber ?? null,
          objectTitle: heldObject?.title ?? null,
          objectPriorAccessionNumbers: priorNumbers.size
            ? [...priorNumbers].join(";")
            : null,
          sourceVerified: accession.sourceVerified === true,
          sourceVerificationException:
            accession.sourceVerificationException !== undefined,
          identifierConflictReviewed: reviews.some(
            (review) => review.reviewedAt <= asOf,
          ),
          ...approval.columns,
          approvalStepsAsOf: history.steps,
          recordedAt: accession._creationTime,
          evidenceStatus:
            history.legacy || approval.missing ? "legacy" : "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return {
    rows,
    cursor: page.continueCursor,
    done: page.isDone,
    scanned: page.page.length,
  };
}

/** Transfers and legacy loan returns that created a deaccession record. */
function disposalCategory(
  organizationId: Id<"organizations">,
  deaccessionId: Id<"deaccessions">,
  transfers: Doc<"organizationMoveRequests">[],
  exits: Doc<"loanCustodyExits">[],
) {
  let transfer: Doc<"organizationMoveRequests"> | undefined;
  for (const request of transfers)
    if (
      request.deaccessionId === deaccessionId &&
      request.sourceOrganizationId === organizationId
    )
      transfer = request;
  let legacyLoanReturn = false;
  for (const exit of exits)
    if (
      exit.legacySyntheticDeaccessionId === deaccessionId &&
      exit.organizationId === organizationId
    )
      legacyLoanReturn = true;
  return { transfer, legacyLoanReturn };
}

async function disposalPage(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: string | null,
): Promise<RegisterPage> {
  const { organizationId, criteria, asOf } = scope;
  const { status, objectId } = criteria;
  const from = criteria.fromDate ?? LOWEST_DATE;
  const to = criteria.toDate ?? HIGHEST_DATE;
  const opts = { numItems: RECORD_PAGE_SIZE, cursor };
  const page = objectId
    ? await ctx.db
        .query("deaccessions")
        .withIndex("by_collection", (q) => q.eq("collectionId", objectId))
        .paginate(opts)
    : status
      ? await ctx.db
          .query("deaccessions")
          .withIndex("by_organization_and_status_and_dateDeaccessioned", (q) =>
            q
              .eq("organizationId", organizationId)
              .eq("status", status)
              .gte("dateDeaccessioned", from)
              .lte("dateDeaccessioned", to),
          )
          .paginate(opts)
      : await ctx.db
          .query("deaccessions")
          .withIndex("by_organization_and_dateDeaccessioned", (q) =>
            q
              .eq("organizationId", organizationId)
              .gte("dateDeaccessioned", from)
              .lte("dateDeaccessioned", to),
          )
          .paginate(opts);
  const rows: RegisterRow[] = [];
  for (const deaccession of page.page) {
    if (
      deaccession.organizationId !== organizationId ||
      deaccession._creationTime > asOf ||
      (status !== undefined && deaccession.status !== status) ||
      !inDateRange(criteria, deaccession.dateDeaccessioned)
    )
      continue;
    const notRecorded: string[] = [];
    const [object, transfers, exits, history] = await Promise.all([
      ctx.db.get(deaccession.collectionId),
      ctx.db
        .query("organizationMoveRequests")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", deaccession.collectionId),
        )
        .take(MAX_LINKED_RECORDS + 1),
      ctx.db
        .query("loanCustodyExits")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", deaccession.collectionId),
        )
        .take(MAX_LINKED_RECORDS + 1),
      approvalHistoryAsOf(
        ctx,
        organizationId,
        "deaccession",
        deaccession._id,
        deaccession.workflowHistory,
        asOf,
      ),
    ] as const);
    boundedLinks(transfers, "transfer requests");
    boundedLinks(exits, "lender exits");
    const { transfer, legacyLoanReturn } = disposalCategory(
      organizationId,
      deaccession._id,
      transfers,
      exits,
    );
    const heldObject =
      object?.organizationId === organizationId ? object : null;
    const objectAccessionNumber =
      heldObject?.accessionNumber ??
      transfer?.transferScopeSnapshot?.accessionNumberAtTransfer ??
      transfer?.sourceAccessionNumber ??
      null;
    if (objectAccessionNumber === null)
      notRecorded.push("objectAccessionNumber");
    if (!heldObject) notRecorded.push("objectTitle");
    const approval = approvalColumns(deaccession, asOf, notRecorded);
    const review = deaccession.decisionReview;
    const missingDecision = deaccession.status === "approved" && !review;
    if (missingDecision)
      notRecorded.push(
        "decisionPolicyVersion",
        "decisionCheckedAt",
        "decisionChecksPassed",
        "decisionException",
      );
    const exit =
      deaccession.exitRecord && deaccession.exitRecord.recordedAt <= asOf
        ? deaccession.exitRecord
        : undefined;
    rows.push(
      registerRow(
        "disposal",
        {
          deaccessionId: deaccession._id,
          deaccessionNumber: deaccession.deaccessionNumber,
          category: transfer
            ? "institution_transfer"
            : legacyLoanReturn
              ? "legacy_loan_return"
              : "deaccession",
          status: deaccession.status,
          dateDeaccessioned: deaccession.dateDeaccessioned,
          method: deaccession.method,
          reason: deaccession.reason,
          disposition: deaccession.disposition ?? null,
          objectId: deaccession.collectionId,
          objectAccessionNumber,
          objectTitle: heldObject?.title ?? null,
          ...approval.columns,
          approvalStepsAsOf: history.steps,
          decisionPolicyVersion: review?.policyVersion ?? null,
          decisionCheckedAt: review?.checkedAt ?? null,
          decisionChecksPassed: review
            ? review.checks.every((check) => !check.required || check.passed)
            : null,
          decisionException: review ? review.exception !== undefined : null,
          exitDate: exit?.exitDate ?? null,
          exitRecipient: exit?.recipient ?? null,
          exitReference: exit?.reference ?? null,
          exitRecordedAsOf: exit !== undefined,
          proceedsAmount: deaccession.proceedsAmount ?? null,
          proceedsCurrency: deaccession.proceedsCurrency ?? null,
          transferRequestId: transfer?._id ?? null,
          recordedAt: deaccession._creationTime,
          evidenceStatus:
            history.legacy || missingDecision || approval.missing
              ? "legacy"
              : "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return {
    rows,
    cursor: page.continueCursor,
    done: page.isDone,
    scanned: page.page.length,
  };
}

// ---------------------------------------------------------------------------
// Object-subject registers (custody, condition)
// ---------------------------------------------------------------------------

interface Subject {
  object: Doc<"collections">;
  /** Present when the object left this organization through this transfer. */
  transfer?: Doc<"organizationMoveRequests">;
}
interface SubjectCursor {
  phase: "objects" | "transfers";
  after: number | null;
  current?: {
    objectId: Id<"collections">;
    transferId?: Id<"organizationMoveRequests">;
    creationTime: number;
    source: number;
    sourceAfter: number | null;
  };
}
interface SourceResult {
  rows: RegisterRow[];
  last: number | null;
  done: boolean;
  scanned: number;
}
interface PageCache {
  locations: Map<Id<"locations">, Doc<"locations"> | null>;
  loans: Map<Id<"loans">, Doc<"loans"> | null>;
}
type EvidenceSource = (
  ctx: QueryCtx,
  scope: RegisterScope,
  subject: Subject,
  after: number | null,
  limit: number,
  cache: PageCache,
) => Promise<SourceResult>;

function invalidCursor(): never {
  throw new ConvexError("Invalid register cursor");
}
function optionalNumber(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) invalidCursor();
  return value;
}
function parseSubjectCursor(ctx: QueryCtx, raw: string | null): SubjectCursor {
  if (raw === null) return { phase: "objects", after: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    invalidCursor();
  }
  if (typeof parsed !== "object" || parsed === null) invalidCursor();
  const record = parsed as Record<string, unknown>;
  const phase = record.phase;
  if (phase !== "objects" && phase !== "transfers") invalidCursor();
  const cursor: SubjectCursor = { phase, after: optionalNumber(record.after) };
  const current = record.current;
  if (current !== undefined) {
    if (typeof current !== "object" || current === null) invalidCursor();
    const value = current as Record<string, unknown>;
    const objectId =
      typeof value.objectId === "string"
        ? ctx.db.normalizeId("collections", value.objectId)
        : null;
    const transferId =
      typeof value.transferId === "string"
        ? ctx.db.normalizeId("organizationMoveRequests", value.transferId)
        : undefined;
    const creationTime = optionalNumber(value.creationTime);
    const source = optionalNumber(value.source);
    if (
      !objectId ||
      transferId === null ||
      creationTime === null ||
      source === null
    )
      invalidCursor();
    cursor.current = {
      objectId,
      transferId,
      creationTime,
      source,
      sourceAfter: optionalNumber(value.sourceAfter),
    };
  }
  return cursor;
}

/**
 * Resolves a location for this organization. `foreign` marks a location held
 * by another organization; a missing location is simply unknown.
 */
async function cachedLocation(
  ctx: QueryCtx,
  scope: RegisterScope,
  cache: PageCache,
  locationId: Id<"locations"> | undefined,
) {
  if (!locationId) return { location: null, foreign: false };
  if (!cache.locations.has(locationId))
    cache.locations.set(locationId, await ctx.db.get(locationId));
  const location = cache.locations.get(locationId) ?? null;
  const foreign =
    location !== null && location.organizationId !== scope.organizationId;
  return { location: foreign ? null : location, foreign };
}
async function cachedLoan(
  ctx: QueryCtx,
  scope: RegisterScope,
  cache: PageCache,
  loanId: Id<"loans">,
) {
  if (!cache.loans.has(loanId))
    cache.loans.set(loanId, await ctx.db.get(loanId));
  const loan = cache.loans.get(loanId) ?? null;
  return loan?.organizationId === scope.organizationId ? loan : null;
}

function subjectColumns(
  scope: RegisterScope,
  subject: Subject,
  notRecorded: string[],
) {
  const held = subject.object.organizationId === scope.organizationId;
  const accessionNumber = held
    ? subject.object.accessionNumber
    : (subject.transfer?.transferScopeSnapshot?.accessionNumberAtTransfer ??
      subject.transfer?.sourceAccessionNumber ??
      null);
  if (accessionNumber === null) notRecorded.push("objectAccessionNumber");
  if (!held) notRecorded.push("objectTitle");
  return {
    objectId: subject.object._id,
    objectAccessionNumber: accessionNumber,
    objectTitle: held ? subject.object.title : null,
  };
}

function locationColumns(
  side: "from" | "to",
  location: Doc<"locations"> | null,
  notRecorded: string[],
) {
  if (!location) notRecorded.push(`${side}LocationId`, `${side}LocationName`);
  return {
    [`${side}LocationId`]: location?._id ?? null,
    [`${side}LocationName`]: location?.name ?? null,
  };
}

function sourceResult(
  rows: RegisterRow[],
  docs: Array<{ _creationTime: number }>,
  limit: number,
  scanned = docs.length,
): SourceResult {
  return {
    rows,
    last: docs.at(-1)?._creationTime ?? null,
    done: docs.length < limit,
    scanned,
  };
}

const movementSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
  cache,
) => {
  const collectionId = subject.object._id;
  const docs = await ctx.db
    .query("locationHistory")
    .withIndex("by_collection", (q) =>
      after === null
        ? q.eq("collectionId", collectionId)
        : q.eq("collectionId", collectionId).gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  for (const movement of docs) {
    if (movement._creationTime > scope.asOf) continue;
    if (!inDateRange(scope.criteria, movement.movedAt)) continue;
    const [from, to] = await Promise.all([
      cachedLocation(ctx, scope, cache, movement.fromLocationId),
      cachedLocation(ctx, scope, cache, movement.toLocationId),
    ] as const);
    // Movements wholly inside another organization's locations belong to
    // that organization's register (for example before a transfer in).
    if ((from.foreign || to.foreign) && !from.location && !to.location)
      continue;
    const notRecorded: string[] = [];
    const legacy = movement.movementKind === undefined;
    if (legacy) notRecorded.push("movementKind", "authorizedBy");
    rows.push(
      registerRow(
        "custody",
        {
          eventId: movement._id,
          evidenceSource: "locationHistory",
          eventType: "movement",
          eventAt: movement.movedAt,
          ...subjectColumns(scope, subject, notRecorded),
          movementKind: movement.movementKind ?? null,
          ...locationColumns("from", from.location, notRecorded),
          ...locationColumns("to", to.location, notRecorded),
          actorId: movement.movedBy,
          authorizedBy: movement.authorizedBy ?? null,
          reason: movement.reason ?? null,
          moveRequestId: movement.moveRequestId ?? null,
          transitItemId: movement.transitItemId ?? null,
          recordedAt: movement._creationTime,
          evidenceStatus: legacy ? "legacy" : "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return sourceResult(rows, docs, limit);
};

const loanHandoffSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
  cache,
) => {
  const collectionId = subject.object._id;
  const docs = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) =>
      after === null
        ? q.eq("collectionId", collectionId)
        : q.eq("collectionId", collectionId).gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  for (const item of docs) {
    const loan = await cachedLoan(ctx, scope, cache, item.loanId);
    // Borrowed objects leave through lender exits, reported separately.
    if (!loan || loan.type !== "outgoing") continue;
    const handoffs = [
      {
        eventType: "loan_dispatched",
        at: item.dispatchedAt,
        actor: item.dispatchedBy,
        side: "from" as const,
        locationId: item.dispatchOriginLocationId,
      },
      {
        eventType: "loan_returned",
        at: item.returnedAt,
        actor: item.returnedBy,
        side: "to" as const,
        locationId: item.returnDestinationLocationId,
      },
    ];
    for (const handoff of handoffs) {
      if (
        handoff.at === undefined ||
        handoff.at > scope.asOf ||
        !inDateRange(scope.criteria, handoff.at)
      )
        continue;
      const notRecorded: string[] = [];
      const { location } = await cachedLocation(
        ctx,
        scope,
        cache,
        handoff.locationId,
      );
      if (!handoff.actor) notRecorded.push("actorId");
      rows.push(
        registerRow(
          "custody",
          {
            eventId: item._id,
            evidenceSource: "loanItems",
            eventType: handoff.eventType,
            eventAt: handoff.at,
            ...subjectColumns(scope, subject, notRecorded),
            ...locationColumns(handoff.side, location, notRecorded),
            actorId: handoff.actor ?? null,
            loanId: loan._id,
            counterparty: loan.lenderBorrowerName,
            recordedAt: handoff.at,
            evidenceStatus: "recorded",
            capturedAt: scope.capturedAt,
          },
          notRecorded,
        ),
      );
    }
  }
  return sourceResult(rows, docs, limit);
};

const lenderExitSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
  cache,
) => {
  const collectionId = subject.object._id;
  const docs = await ctx.db
    .query("loanCustodyExits")
    .withIndex("by_collection", (q) =>
      after === null
        ? q.eq("collectionId", collectionId)
        : q.eq("collectionId", collectionId).gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  for (const exit of docs) {
    if (
      exit.organizationId !== scope.organizationId ||
      exit.recordedAt > scope.asOf ||
      !inDateRange(scope.criteria, exit.recordedAt)
    )
      continue;
    const notRecorded: string[] = [];
    const { location: from } = await cachedLocation(
      ctx,
      scope,
      cache,
      exit.fromLocationId,
    );
    rows.push(
      registerRow(
        "custody",
        {
          eventId: exit._id,
          evidenceSource: "loanCustodyExits",
          eventType: "lender_exit",
          eventAt: exit.recordedAt,
          ...subjectColumns(scope, subject, notRecorded),
          ...locationColumns("from", from, notRecorded),
          actorId: exit.recordedBy,
          loanId: exit.loanId,
          counterparty: exit.recipientName,
          recordedAt: exit.recordedAt,
          evidenceStatus: "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return sourceResult(rows, docs, limit);
};

const transferHandoffSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
  cache,
) => {
  const collectionId = subject.object._id;
  const docs = await ctx.db
    .query("organizationTransferCustodyEvents")
    .withIndex("by_collection", (q) =>
      after === null
        ? q.eq("collectionId", collectionId)
        : q.eq("collectionId", collectionId).gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  for (const event of docs) {
    if (
      event.organizationId !== scope.organizationId ||
      event.recordedAt > scope.asOf ||
      !inDateRange(scope.criteria, event.recordedAt)
    )
      continue;
    const notRecorded: string[] = [];
    const { location } = await cachedLocation(
      ctx,
      scope,
      cache,
      event.observedLocationId,
    );
    const departure = event.phase === "source_departure";
    rows.push(
      registerRow(
        "custody",
        {
          eventId: event._id,
          evidenceSource: "organizationTransferCustodyEvents",
          eventType: departure ? "transfer_departure" : "transfer_arrival",
          eventAt: event.recordedAt,
          ...subjectColumns(scope, subject, notRecorded),
          ...locationColumns(departure ? "from" : "to", location, notRecorded),
          actorId: event.actorId,
          transferRequestId: event.moveRequestId,
          recordedAt: event.recordedAt,
          evidenceStatus: "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return sourceResult(rows, docs, limit);
};

const assessmentSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
) => {
  const collectionId = subject.object._id;
  const docs = await ctx.db
    .query("conditionAssessments")
    .withIndex("by_collection", (q) =>
      after === null
        ? q.eq("collectionId", collectionId)
        : q.eq("collectionId", collectionId).gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  for (const assessment of docs) {
    if (
      assessment.organizationId !== scope.organizationId ||
      assessment.status !== "accepted" ||
      assessment.acceptedAt === undefined ||
      assessment.acceptedAt > scope.asOf ||
      !inDateRange(scope.criteria, assessment.assessedAt)
    )
      continue;
    const notRecorded: string[] = [];
    if (!assessment.acceptedBy) notRecorded.push("acceptedBy");
    rows.push(
      registerRow(
        "condition",
        {
          eventId: assessment._id,
          evidenceSource: "conditionAssessments",
          eventType: "assessment_accepted",
          assessedAt: assessment.assessedAt,
          ...subjectColumns(scope, subject, notRecorded),
          condition: assessment.condition,
          summary: assessment.summary,
          observationCount: assessment.observations.length,
          photoCount: assessment.photos.length,
          assessorId: assessment.assessedBy,
          acceptedAt: assessment.acceptedAt,
          acceptedBy: assessment.acceptedBy ?? null,
          recordedAt: assessment.recordedAt,
          evidenceStatus: "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return sourceResult(rows, docs, limit);
};

const loanConditionReportSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
  cache,
) => {
  const collectionId = subject.object._id;
  const docs = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) =>
      after === null
        ? q.eq("collectionId", collectionId)
        : q.eq("collectionId", collectionId).gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  let scanned = docs.length;
  for (const item of docs) {
    const loan = await cachedLoan(ctx, scope, cache, item.loanId);
    if (!loan) continue;
    const reports = await ctx.db
      .query("conditionReports")
      .withIndex("by_loanItem", (q) => q.eq("loanItemId", item._id))
      .take(MAX_REPORTS_PER_LOAN_ITEM + 1);
    if (reports.length > MAX_REPORTS_PER_LOAN_ITEM)
      throw new ConvexError(
        `Register loan condition reports exceed processing limits (${MAX_REPORTS_PER_LOAN_ITEM} per loan object)`,
      );
    scanned += reports.length;
    for (const report of reports) {
      if (
        report._creationTime > scope.asOf ||
        !inDateRange(scope.criteria, report.assessedAt)
      )
        continue;
      const notRecorded: string[] = [];
      rows.push(
        registerRow(
          "condition",
          {
            eventId: report._id,
            evidenceSource: "conditionReports",
            eventType: "loan_condition_report",
            assessedAt: report.assessedAt,
            ...subjectColumns(scope, subject, notRecorded),
            condition: report.conditionDescription,
            observationCount: report.damages?.length ?? 0,
            photoCount: report.photos?.length ?? 0,
            assessorId: report.assessedBy,
            loanId: loan._id,
            reportDirection: report.reportType,
            recordedAt: report._creationTime,
            evidenceStatus: "recorded",
            capturedAt: scope.capturedAt,
          },
          notRecorded,
        ),
      );
    }
  }
  return sourceResult(rows, docs, limit, scanned);
};

/** Conditions held on the object record itself, before retained assessments. */
const legacyConditionSource: EvidenceSource = async (_ctx, scope, subject) => {
  const object = subject.object;
  const done = { rows: [], last: null, done: true, scanned: 0 };
  if (object.organizationId !== scope.organizationId) return done;
  const rows: RegisterRow[] = [];
  const history = object.conditionHistory ?? [];
  for (const change of history) {
    if (
      change.changedAt > scope.asOf ||
      !inDateRange(scope.criteria, change.changedAt)
    )
      continue;
    const notRecorded: string[] = [];
    rows.push(
      registerRow(
        "condition",
        {
          evidenceSource: "collections.conditionHistory",
          eventType: "legacy_condition_change",
          assessedAt: change.changedAt,
          ...subjectColumns(scope, subject, notRecorded),
          condition: change.condition,
          summary: change.note ?? null,
          assessorId: change.changedBy,
          recordedAt: change.changedAt,
          evidenceStatus: "legacy",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  const snapshot =
    object.legacyConditionSnapshot ??
    (object.currentConditionAssessmentId ? undefined : object.condition);
  if (
    history.length === 0 &&
    snapshot &&
    inDateRange(scope.criteria, undefined)
  ) {
    const notRecorded = ["assessedAt", "assessorId", "recordedAt"];
    rows.push(
      registerRow(
        "condition",
        {
          evidenceSource: "collections.legacyConditionSnapshot",
          eventType: "legacy_condition_snapshot",
          ...subjectColumns(scope, subject, notRecorded),
          condition: snapshot,
          evidenceStatus: "legacy",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return { rows, last: null, done: true, scanned: history.length };
};

const SUBJECT_SOURCES: Record<"custody" | "condition", EvidenceSource[]> = {
  custody: [
    movementSource,
    loanHandoffSource,
    lenderExitSource,
    transferHandoffSource,
  ],
  condition: [
    assessmentSource,
    loanConditionReportSource,
    legacyConditionSource,
  ],
};

/** A held object, or one that left through its latest transfer out. */
async function subjectFor(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  object: Doc<"collections">,
  transfer?: Doc<"organizationMoveRequests">,
): Promise<Subject | null> {
  if (object.organizationId === organizationId)
    return transfer ? null : { object };
  const latest = await latestTransferOut(ctx, organizationId, object._id);
  if (!latest || (transfer && latest._id !== transfer._id)) return null;
  return { object, transfer: latest };
}

async function nextSubjects(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: SubjectCursor,
  limit: number,
): Promise<{
  subjects: Array<{
    subject: Subject | null;
    creationTime: number;
    scanned: number;
  }>;
  exhausted: boolean;
}> {
  const { organizationId, criteria, asOf } = scope;
  if (cursor.phase === "objects") {
    if (criteria.objectId) {
      if (cursor.after !== null) return { subjects: [], exhausted: true };
      const object = await ctx.db.get(criteria.objectId);
      return {
        subjects: object
          ? [
              {
                subject:
                  object._creationTime <= asOf
                    ? await subjectFor(ctx, organizationId, object)
                    : null,
                creationTime: object._creationTime,
                scanned: 1,
              },
            ]
          : [],
        exhausted: true,
      };
    }
    const objects = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        cursor.after === null
          ? q.eq("organizationId", organizationId)
          : q
              .eq("organizationId", organizationId)
              .gt("_creationTime", cursor.after),
      )
      .take(limit);
    return {
      subjects: objects.map((object) => ({
        subject: object._creationTime <= asOf ? { object } : null,
        creationTime: object._creationTime,
        scanned: 1,
      })),
      exhausted: objects.length < limit,
    };
  }
  if (criteria.objectId) return { subjects: [], exhausted: true };
  const requests = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_source_organization_and_status", (q) =>
      cursor.after === null
        ? q.eq("sourceOrganizationId", organizationId).eq("status", "executed")
        : q
            .eq("sourceOrganizationId", organizationId)
            .eq("status", "executed")
            .gt("_creationTime", cursor.after),
    )
    .take(limit);
  const subjects: Array<{
    subject: Subject | null;
    creationTime: number;
    scanned: number;
  }> = [];
  // Only the latest executed transfer of an object that is still elsewhere is
  // a subject, so its history is emitted once.
  for (const transfer of requests) {
    const object = await ctx.db.get(transfer.collectionId);
    subjects.push({
      subject: object
        ? await subjectFor(ctx, organizationId, object, transfer)
        : null,
      creationTime: transfer._creationTime,
      scanned: 2,
    });
  }
  return { subjects, exhausted: requests.length < limit };
}

async function loadCurrentSubject(
  ctx: QueryCtx,
  scope: RegisterScope,
  current: NonNullable<SubjectCursor["current"]>,
): Promise<Subject | null> {
  const object = await ctx.db.get(current.objectId);
  if (!object) return null;
  const transfer = current.transferId
    ? await ctx.db.get(current.transferId)
    : undefined;
  if (transfer === null) return null;
  // An object that left during capture is reached again by the transfers
  // phase; resuming it here would emit its history twice.
  if (
    !transfer &&
    !scope.criteria.objectId &&
    object.organizationId !== scope.organizationId
  )
    return null;
  return await subjectFor(ctx, scope.organizationId, object, transfer);
}

async function subjectPage(
  ctx: QueryCtx,
  scope: RegisterScope,
  sources: EvidenceSource[],
  rawCursor: string | null,
): Promise<RegisterPage> {
  const cursor = parseSubjectCursor(ctx, rawCursor);
  const cache: PageCache = { locations: new Map(), loans: new Map() };
  const rows: RegisterRow[] = [];
  let scanned = 0;
  let budget = EVIDENCE_BUDGET;
  let characters = 0;
  let subjectsLeft = SUBJECT_BUDGET;
  const emit = (next: SubjectCursor, done = false): RegisterPage => ({
    rows,
    cursor: done ? null : JSON.stringify(next),
    done,
    scanned,
  });
  /** Returns the unfinished position, or null when the subject is complete. */
  const drain = async (
    subject: Subject,
    startSource: number,
    startAfter: number | null,
  ) => {
    for (let index = startSource; index < sources.length; index++) {
      const source = sources[index];
      if (!source) break;
      let after = index === startSource ? startAfter : null;
      for (;;) {
        if (budget <= 0) return { source: index, sourceAfter: after };
        const result = await source(
          ctx,
          scope,
          subject,
          after,
          Math.min(budget, SOURCE_BATCH),
          cache,
        );
        rows.push(...result.rows);
        scanned += result.scanned;
        budget -= Math.max(result.scanned, 1);
        for (const row of result.rows) characters += JSON.stringify(row).length;
        if (characters >= ROW_CHARACTER_BUDGET) budget = 0;
        if (result.done) break;
        after = result.last;
      }
    }
    return null;
  };

  if (cursor.current) {
    const current = cursor.current;
    const subject = await loadCurrentSubject(ctx, scope, current);
    if (subject) {
      const pending = await drain(subject, current.source, current.sourceAfter);
      if (pending)
        return emit({ ...cursor, current: { ...current, ...pending } });
    }
    cursor.after = current.creationTime;
    cursor.current = undefined;
  }
  while (subjectsLeft > 0 && budget > 0) {
    const batch = await nextSubjects(ctx, scope, cursor, subjectsLeft);
    for (const { subject, creationTime, scanned: examined } of batch.subjects) {
      subjectsLeft--;
      scanned += examined;
      if (subject) {
        const pending = await drain(subject, 0, null);
        if (pending)
          return emit({
            ...cursor,
            current: {
              objectId: subject.object._id,
              transferId: subject.transfer?._id,
              creationTime,
              ...pending,
            },
          });
      }
      cursor.after = creationTime;
      if (budget <= 0) return emit(cursor);
    }
    if (!batch.exhausted) continue;
    if (cursor.phase === "transfers") return emit(cursor, true);
    cursor.phase = "transfers";
    cursor.after = null;
  }
  return emit(cursor);
}

export async function readRegisterPage(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: string | null,
): Promise<RegisterPage> {
  switch (scope.profile) {
    case "accession":
      return accessionPage(ctx, scope, cursor);
    case "disposal":
      return disposalPage(ctx, scope, cursor);
    case "custody":
    case "condition":
      return subjectPage(ctx, scope, SUBJECT_SOURCES[scope.profile], cursor);
  }
}
