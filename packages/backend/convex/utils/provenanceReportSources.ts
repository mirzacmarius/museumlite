import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  historicalDateEdtf,
  isContestedClaim,
  MAX_CLAIMS_PER_OBJECT,
  provenanceClaimSortKey,
} from "./provenance";
import { type RegisterRow, registerRow } from "./registerProfiles";
import {
  type EvidenceSource,
  type PageCache,
  type RegisterScope,
  type Subject,
  sourceResult,
  subjectColumns,
} from "./registerSources";

type Claim = Doc<"provenanceClaims">;

/** Review decisions read for a claim whose latest decision came after as-of. */
const MAX_REVIEWS_PER_CLAIM = 100;

/** Assertion fields a claim may leave unstated; reported in notRecorded. */
const UNSTATED_FIELDS = [
  "role",
  "method",
  "place",
  "startDate",
  "endDate",
] as const;

/**
 * The claim as it stood at as-of: a correction or retraction recorded later
 * had not happened yet.
 */
function claimAsOf(claim: Claim, asOf: number): Claim {
  if (claim.supersededAt === undefined || claim.supersededAt <= asOf)
    return claim;
  return {
    ...claim,
    supersededAt: undefined,
    supersededBy: undefined,
    supersededByClaimId: undefined,
    supersessionReason: undefined,
  };
}

async function objectClaims(
  ctx: QueryCtx,
  scope: RegisterScope,
  subject: Subject,
  cache: PageCache,
) {
  const objectId = subject.object._id;
  const cached = cache.claims.get(objectId);
  if (cached) return cached;
  const claims = await ctx.db
    .query("provenanceClaims")
    .withIndex("by_organization_and_objectId_and_supersededAt", (q) =>
      q.eq("organizationId", scope.organizationId).eq("objectId", objectId),
    )
    .take(MAX_CLAIMS_PER_OBJECT + 1);
  if (claims.length > MAX_CLAIMS_PER_OBJECT)
    throw new ConvexError(
      `Register provenance claims exceed processing limits (${MAX_CLAIMS_PER_OBJECT} per object)`,
    );
  cache.claims.set(objectId, claims);
  return claims;
}

/**
 * Claims recorded by as-of as they stood then, in the Provenance tab's
 * order: current claims chronologically, then corrected or retracted ones,
 * most recently superseded first.
 */
function claimsAsOf(claims: Claim[], asOf: number) {
  return claims
    .filter((claim) => claim.createdAt <= asOf)
    .map((claim) => claimAsOf(claim, asOf))
    .sort((left, right) => {
      const leftCurrent = left.supersededAt === undefined;
      if (leftCurrent !== (right.supersededAt === undefined))
        return leftCurrent ? -1 : 1;
      const order = leftCurrent
        ? provenanceClaimSortKey(left) - provenanceClaimSortKey(right) ||
          left.createdAt - right.createdAt
        : (right.supersededAt ?? 0) - (left.supersededAt ?? 0) ||
          right.createdAt - left.createdAt;
      return order || (left._id < right._id ? -1 : 1);
    });
}

/** The latest review decision made by as-of. */
async function reviewAsOf(ctx: QueryCtx, scope: RegisterScope, claim: Claim) {
  if (claim.reviewedAt === undefined || claim.reviewedAt <= scope.asOf)
    return {
      status: claim.reviewStatus,
      reviewedAt: claim.reviewedAt ?? null,
      reviewedBy: claim.reviewedBy ?? null,
      note: claim.reviewNote ?? null,
      read: 0,
    };
  const reviews = await ctx.db
    .query("provenanceReviews")
    .withIndex("by_organization_and_claimId", (q) =>
      q.eq("organizationId", scope.organizationId).eq("claimId", claim._id),
    )
    .take(MAX_REVIEWS_PER_CLAIM + 1);
  if (reviews.length > MAX_REVIEWS_PER_CLAIM)
    throw new ConvexError(
      `Register provenance reviews exceed processing limits (${MAX_REVIEWS_PER_CLAIM} per claim)`,
    );
  let latest: Doc<"provenanceReviews"> | null = null;
  for (const review of reviews)
    if (
      review.reviewedAt <= scope.asOf &&
      (!latest || review.reviewedAt >= latest.reviewedAt)
    )
      latest = review;
  return {
    status: latest?.decision ?? "unreviewed",
    reviewedAt: latest?.reviewedAt ?? null,
    reviewedBy: latest?.reviewedBy ?? null,
    note: latest?.note ?? null,
    read: reviews.length,
  };
}

const claimSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
  cache,
) => {
  const claims = claimsAsOf(
    await objectClaims(ctx, scope, subject, cache),
    scope.asOf,
  );
  const claimsById = new Map(claims.map((claim) => [claim._id, claim]));
  const start = after ?? 0;
  const batch = claims.slice(start, start + limit);
  const rows: RegisterRow[] = [];
  let scanned = batch.length;
  for (const claim of batch) {
    const review = await reviewAsOf(ctx, scope, claim);
    scanned += review.read;
    const notRecorded: string[] = [];
    const objectColumns = subjectColumns(scope, subject, notRecorded);
    if (claim.partyKind === "anonymous" && claim.partyText === undefined)
      notRecorded.push("partyText");
    for (const field of UNSTATED_FIELDS)
      if (claim[field] === undefined) notRecorded.push(field);
    rows.push(
      registerRow(
        "provenance",
        {
          recordType: "claim",
          ...objectColumns,
          claimId: claim._id,
          currentAsOf: claim.supersededAt === undefined,
          statement: claim.statement,
          partyKind: claim.partyKind,
          partyText: claim.partyText ?? null,
          role: claim.role ?? null,
          method: claim.method ?? null,
          place: claim.place ?? null,
          startDate: claim.startDate
            ? historicalDateEdtf(claim.startDate)
            : null,
          endDate: claim.endDate ? historicalDateEdtf(claim.endDate) : null,
          confidence: claim.confidence,
          reviewStatusAsOf: review.status,
          reviewedAt: review.reviewedAt,
          reviewedBy: review.reviewedBy,
          reviewNote: review.note,
          contradictsClaimId: claim.contradictsClaimId ?? null,
          contestedAsOf: isContestedClaim(claim, claimsById),
          supersedesClaimId: claim.supersedesClaimId ?? null,
          supersededAt: claim.supersededAt ?? null,
          supersededByClaimId: claim.supersededByClaimId ?? null,
          supersessionReason: claim.supersessionReason ?? null,
          recordedAt: claim.createdAt,
          evidenceStatus: "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  const next = start + batch.length;
  return { rows, last: next, done: next >= claims.length, scanned };
};

const evidenceSource: EvidenceSource = async (
  ctx,
  scope,
  subject,
  after,
  limit,
) => {
  const objectId = subject.object._id;
  const docs = await ctx.db
    .query("provenanceEvidence")
    .withIndex("by_organization_and_objectId", (q) =>
      after === null
        ? q.eq("organizationId", scope.organizationId).eq("objectId", objectId)
        : q
            .eq("organizationId", scope.organizationId)
            .eq("objectId", objectId)
            .gt("_creationTime", after),
    )
    .take(limit);
  const rows: RegisterRow[] = [];
  for (const evidence of docs) {
    if (evidence.linkedAt > scope.asOf) continue;
    const retracted =
      evidence.retractedAt !== undefined && evidence.retractedAt <= scope.asOf;
    const notRecorded: string[] = [];
    rows.push(
      registerRow(
        "provenance",
        {
          recordType: "evidence",
          ...subjectColumns(scope, subject, notRecorded),
          claimId: evidence.claimId,
          currentAsOf: !retracted,
          evidenceId: evidence._id,
          evidenceKind: evidence.kind,
          ...(evidence.kind === "citation"
            ? { citation: evidence.citation, url: evidence.url ?? null }
            : { mediaId: evidence.mediaId, fileName: evidence.fileNameSnapshot }),
          excerpt: evidence.excerpt ?? null,
          locator: evidence.locator ?? null,
          retractedAt: retracted ? (evidence.retractedAt ?? null) : null,
          retractionReason: retracted
            ? (evidence.retractionReason ?? null)
            : null,
          recordedAt: evidence.linkedAt,
          evidenceStatus: "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return sourceResult(rows, docs, limit);
};

/**
 * The legacy free-text provenance and ownership history kept on the object
 * record (ADR 0006). They are undated and belong to whoever holds the
 * object, so they are reported for held objects only.
 */
const legacyProvenanceSource: EvidenceSource = async (
  _ctx,
  scope,
  subject,
) => {
  const object = subject.object;
  const rows: RegisterRow[] = [];
  const legacyRow = (values: RegisterRow) => {
    const notRecorded: string[] = [];
    const objectColumns = subjectColumns(scope, subject, notRecorded);
    notRecorded.push("recordedAt");
    return registerRow(
      "provenance",
      {
        ...objectColumns,
        ...values,
        evidenceStatus: "legacy",
        capturedAt: scope.capturedAt,
      },
      notRecorded,
    );
  };
  if (object.organizationId === scope.organizationId) {
    if (object.provenance?.trim())
      rows.push(
        legacyRow({ recordType: "legacy_text", statement: object.provenance }),
      );
    for (const entry of object.ownershipHistory ?? [])
      rows.push(
        legacyRow({
          recordType: "legacy_ownership",
          statement: entry.description ?? null,
          partyText: entry.owner,
          legacyStartYear: entry.startYear ?? null,
          legacyEndYear: entry.endYear ?? null,
          legacyVerified: entry.verified ?? null,
          citation: entry.verificationSource ?? null,
        }),
      );
  }
  return { rows, last: null, done: true, scanned: 0 };
};

export const PROVENANCE_SOURCES: EvidenceSource[] = [
  claimSource,
  evidenceSource,
  legacyProvenanceSource,
];
