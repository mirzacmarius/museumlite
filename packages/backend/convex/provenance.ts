import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./utils/authorizationContext";
import { objectLabel } from "./utils/collectionDisplayHelpers";
import { hasModuleEnabled } from "./utils/featureGates";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { partyDisplayName, requireLinkableParty } from "./utils/parties";
import {
  currentPartyLink,
  endPartyLink,
  recordPartyLink,
} from "./utils/partyLinks";
import type { PartyTarget } from "./utils/partyValidators";
import { hasPermission, requirePermission } from "./utils/permissions";
import {
  assertCurrentClaim,
  currentClaimVersion,
  historicalDateEdtf,
  isWithdrawnObject,
  loadClaimEvidence,
  loadObjectClaims,
  MAX_CLAIMS_PER_OBJECT,
  MAX_EVIDENCE_PER_CLAIM,
  MAX_EVIDENCE_PER_OBJECT,
  MAX_REVIEWS_PER_OBJECT,
  optionalProvenanceText,
  PROVENANCE_REVIEW_PERMISSION,
  provenanceArrivingFrom,
  provenanceClaimSortKey,
  rehomeObjectProvenance,
  requireContradictedClaim,
  requiredProvenanceReason,
  requireProvenanceClaim,
  requireProvenanceObject,
  retractionNeedsReviewer,
  type ValidatedEvidence,
  validatedEvidence,
  validatedProvenanceAssertion,
} from "./utils/provenance";
import { provenanceError } from "./utils/provenanceErrors";
import {
  type ProvenanceAssertion,
  type ProvenanceEvidenceInput,
  provenanceAssertionFields,
  provenanceAssertionValidator,
  provenanceEvidenceInputValidator,
  provenanceEvidenceSourceValidator,
  provenanceReviewDecisionValidator,
  provenanceReviewStatusValidator,
} from "./utils/provenanceValidators";
import {
  type ColumnPage,
  firstKept,
  newestFirst,
} from "./utils/workBoardColumns";

const evidenceCommonFields = {
  _id: v.id("provenanceEvidence"),
  excerpt: v.optional(v.string()),
  locator: v.optional(v.string()),
  linkedAt: v.number(),
  linkedByName: v.optional(v.string()),
  isActive: v.boolean(),
  retractedAt: v.optional(v.number()),
  retractionReason: v.optional(v.string()),
};

const evidenceViewValidator = v.union(
  v.object({
    ...evidenceCommonFields,
    kind: v.literal("citation"),
    citation: v.string(),
    url: v.optional(v.string()),
  }),
  v.object({
    ...evidenceCommonFields,
    kind: v.literal("media"),
    restricted: v.literal(false),
    mediaId: v.id("mediaFiles"),
    /** The file name when it was cited. */
    fileName: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  /** The viewer lacks `media.read`: the cited file is not described. */
  v.object({
    ...evidenceCommonFields,
    kind: v.literal("media"),
    restricted: v.literal(true),
  }),
);

type EvidenceView = Infer<typeof evidenceViewValidator>;

const claimPartyViewValidator = v.object({
  linkId: v.id("partyLinks"),
  accountId: v.id("accounts"),
  /** The Party's current name; null when the account is unavailable. */
  partyName: v.union(v.string(), v.null()),
  partyArchived: v.boolean(),
  nameSnapshot: v.string(),
});

const reviewViewValidator = v.object({
  _id: v.id("provenanceReviews"),
  decision: provenanceReviewDecisionValidator,
  note: v.optional(v.string()),
  reviewedByName: v.optional(v.string()),
  reviewedAt: v.number(),
});

const claimViewValidator = v.object({
  _id: v.id("provenanceClaims"),
  ...provenanceAssertionFields,
  contradictsClaimId: v.optional(v.id("provenanceClaims")),
  /**
   * The current version of the contradicted claim; `earlierVersion` when
   * the claim recorded against it has since been corrected.
   */
  contradicts: v.optional(
    v.object({
      claimId: v.id("provenanceClaims"),
      earlierVersion: v.boolean(),
    }),
  ),
  /** Claims that contradict this claim or an earlier version of it. */
  contradictedByClaimIds: v.array(v.id("provenanceClaims")),
  supersedesClaimId: v.optional(v.id("provenanceClaims")),
  createdAt: v.number(),
  createdByName: v.optional(v.string()),
  reviewStatus: provenanceReviewStatusValidator,
  reviewedAt: v.optional(v.number()),
  reviewedByName: v.optional(v.string()),
  reviewNote: v.optional(v.string()),
  isCurrent: v.boolean(),
  supersededAt: v.optional(v.number()),
  supersededByName: v.optional(v.string()),
  supersededByClaimId: v.optional(v.id("provenanceClaims")),
  supersessionReason: v.optional(v.string()),
  /** Retracting it needs a reviewer: it was reviewed or is contested. */
  retractNeedsReview: v.boolean(),
  /** The Party the holder is identified as; null when none or not visible. */
  party: v.union(claimPartyViewValidator, v.null()),
  evidence: v.array(evidenceViewValidator),
  /** Every review decision, newest first. */
  reviews: v.array(reviewViewValidator),
});

function claimTarget(claimId: Id<"provenanceClaims">): PartyTarget {
  return { type: "provenanceClaim", id: claimId };
}

async function canReadParties(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const [moduleEnabled, permitted] = await Promise.all([
    hasModuleEnabled(ctx, organizationId, "accounts"),
    hasPermission(ctx, organizationId, "accounts.read"),
  ]);
  return moduleEnabled && permitted;
}

async function userNames(ctx: QueryCtx, ids: Array<Id<"users"> | undefined>) {
  const unique = [
    ...new Set(ids.filter((id): id is Id<"users"> => id !== undefined)),
  ];
  const users = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return new Map(
    users.flatMap((user) =>
      user
        ? [[user._id, user.name ?? user.username ?? undefined] as const]
        : [],
    ),
  );
}

async function toEvidenceView(
  ctx: QueryCtx,
  row: Doc<"provenanceEvidence">,
  names: Map<Id<"users">, string | undefined>,
  canReadMedia: boolean,
): Promise<EvidenceView> {
  const common = {
    _id: row._id,
    excerpt: row.excerpt,
    locator: row.locator,
    linkedAt: row.linkedAt,
    linkedByName: names.get(row.linkedBy),
    isActive: row.retractedAt === undefined,
    retractedAt: row.retractedAt,
    retractionReason: row.retractionReason,
  };
  if (row.kind === "citation") {
    return {
      ...common,
      kind: "citation",
      citation: row.citation,
      url: row.url,
    };
  }
  if (!canReadMedia) {
    return { ...common, kind: "media", restricted: true };
  }
  const media = await ctx.db.get(row.mediaId);
  const url =
    media && media.organizationId === row.organizationId
      ? await ctx.storage.getUrl(media.storageId)
      : null;
  return {
    ...common,
    kind: "media",
    restricted: false,
    mediaId: row.mediaId,
    fileName: row.fileNameSnapshot,
    url,
  };
}

async function claimPartyView(
  ctx: QueryCtx,
  claim: Doc<"provenanceClaims">,
): Promise<Infer<typeof claimPartyViewValidator> | null> {
  if (claim.partyKind !== "named" || !claim.role) return null;
  const link = await currentPartyLink(
    ctx,
    claim.organizationId,
    claimTarget(claim._id),
    claim.role,
  );
  if (!link) return null;
  const account = await ctx.db.get(link.accountId);
  const sameTenant = account?.organizationId === claim.organizationId;
  return {
    linkId: link._id,
    accountId: link.accountId,
    partyName: account && sameTenant ? partyDisplayName(account) : null,
    partyArchived: sameTenant && account?.status === "archived",
    nameSnapshot: link.nameSnapshot,
  };
}

/**
 * An Object's provenance: current claims in chronological order, then
 * corrected and retracted claims, each with its evidence, review and the
 * claims it contradicts. Also states what the viewer may do, which is nothing
 * while part of a transferred Object's history is still on its way.
 */
export const listForObject = query({
  args: { objectId: v.id("collections") },
  returns: v.union(
    v.object({
      viewer: v.object({
        canRecord: v.boolean(),
        canReview: v.boolean(),
        canLinkParties: v.boolean(),
      }),
      objectWithdrawn: v.boolean(),
      provenanceArriving: v.boolean(),
      claims: v.array(claimViewValidator),
      truncated: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const object = await ctx.db.get(args.objectId);
    if (!object) return null;
    const organizationId = object.organizationId;
    await requirePermission(ctx, organizationId, "collections.read");
    const [
      canUpdate,
      canReview,
      canReadMedia,
      partiesVisible,
      claims,
      arrivingFrom,
    ] = await Promise.all([
      hasPermission(ctx, organizationId, "collections.update"),
      hasPermission(ctx, organizationId, PROVENANCE_REVIEW_PERMISSION),
      hasPermission(ctx, organizationId, "media.read"),
      canReadParties(ctx, organizationId),
      loadObjectClaims(ctx, object),
      provenanceArrivingFrom(ctx, object),
    ]);
    const [evidenceRows, reviewRows] = await Promise.all([
      ctx.db
        .query("provenanceEvidence")
        .withIndex("by_organization_and_objectId", (q) =>
          q.eq("organizationId", organizationId).eq("objectId", object._id),
        )
        .take(MAX_EVIDENCE_PER_OBJECT),
      ctx.db
        .query("provenanceReviews")
        .withIndex("by_organization_and_objectId", (q) =>
          q.eq("organizationId", organizationId).eq("objectId", object._id),
        )
        .order("desc")
        .take(MAX_REVIEWS_PER_OBJECT),
    ]);
    const names = await userNames(ctx, [
      ...claims.flatMap((claim) => [
        claim.createdBy,
        claim.reviewedBy,
        claim.supersededBy,
      ]),
      ...evidenceRows.map((row) => row.linkedBy),
      ...reviewRows.map((row) => row.reviewedBy),
    ]);
    const claimsById = new Map(claims.map((claim) => [claim._id, claim]));
    // Contradictions follow corrections to the claim that is current now.
    const contradictionTargets = new Map(
      claims.flatMap((claim) =>
        claim.contradictsClaimId
          ? [
              [
                claim._id,
                currentClaimVersion(claimsById, claim.contradictsClaimId),
              ] as const,
            ]
          : [],
      ),
    );
    const reviewsByClaim = new Map<
      Id<"provenanceClaims">,
      Array<Infer<typeof reviewViewValidator>>
    >();
    for (const row of reviewRows) {
      reviewsByClaim.set(row.claimId, [
        ...(reviewsByClaim.get(row.claimId) ?? []),
        {
          _id: row._id,
          decision: row.decision,
          note: row.note,
          reviewedByName: names.get(row.reviewedBy),
          reviewedAt: row.reviewedAt,
        },
      ]);
    }
    const evidenceByClaim = new Map<Id<"provenanceClaims">, EvidenceView[]>();
    // Oldest citation first; rows saved together keep their insertion order.
    const orderedEvidence = evidenceRows.toSorted(
      (left, right) =>
        left.linkedAt - right.linkedAt ||
        left._creationTime - right._creationTime,
    );
    for (const row of orderedEvidence) {
      const view = await toEvidenceView(ctx, row, names, canReadMedia);
      evidenceByClaim.set(row.claimId, [
        ...(evidenceByClaim.get(row.claimId) ?? []),
        view,
      ]);
    }
    const views = await Promise.all(
      claims.map(async (claim) => ({
        _id: claim._id,
        statement: claim.statement,
        role: claim.role,
        partyKind: claim.partyKind,
        partyText: claim.partyText,
        method: claim.method,
        place: claim.place,
        startDate: claim.startDate,
        endDate: claim.endDate,
        confidence: claim.confidence,
        contradictsClaimId: claim.contradictsClaimId,
        contradicts: claim.contradictsClaimId
          ? {
              claimId:
                contradictionTargets.get(claim._id) ?? claim.contradictsClaimId,
              earlierVersion:
                contradictionTargets.get(claim._id) !==
                claim.contradictsClaimId,
            }
          : undefined,
        contradictedByClaimIds: claims.flatMap((other) =>
          other.contradictsClaimId === claim._id ||
          contradictionTargets.get(other._id) === claim._id
            ? [other._id]
            : [],
        ),
        supersedesClaimId: claim.supersedesClaimId,
        createdAt: claim.createdAt,
        createdByName: names.get(claim.createdBy),
        reviewStatus: claim.reviewStatus,
        reviewedAt: claim.reviewedAt,
        reviewedByName: claim.reviewedBy
          ? names.get(claim.reviewedBy)
          : undefined,
        reviewNote: claim.reviewNote,
        isCurrent: claim.supersededAt === undefined,
        supersededAt: claim.supersededAt,
        supersededByName: claim.supersededBy
          ? names.get(claim.supersededBy)
          : undefined,
        supersededByClaimId: claim.supersededByClaimId,
        supersessionReason: claim.supersessionReason,
        retractNeedsReview: retractionNeedsReviewer(claim, claimsById),
        party: partiesVisible ? await claimPartyView(ctx, claim) : null,
        evidence: evidenceByClaim.get(claim._id) ?? [],
        reviews: reviewsByClaim.get(claim._id) ?? [],
      })),
    );
    const withdrawn = isWithdrawnObject(object);
    const arriving = arrivingFrom !== null;
    const locked = withdrawn || arriving;
    return {
      viewer: {
        canRecord: canUpdate && !locked,
        canReview: canReview && !locked,
        canLinkParties: canUpdate && partiesVisible && !locked,
      },
      objectWithdrawn: withdrawn,
      provenanceArriving: arriving,
      claims: views.sort((left, right) => {
        if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
        if (!left.isCurrent) {
          return (
            (right.supersededAt ?? 0) - (left.supersededAt ?? 0) ||
            right.createdAt - left.createdAt ||
            left._id.localeCompare(right._id)
          );
        }
        return (
          provenanceClaimSortKey(left) - provenanceClaimSortKey(right) ||
          left.createdAt - right.createdAt ||
          left._id.localeCompare(right._id)
        );
      }),
      truncated:
        claims.length >= MAX_CLAIMS_PER_OBJECT ||
        evidenceRows.length >= MAX_EVIDENCE_PER_OBJECT ||
        reviewRows.length >= MAX_REVIEWS_PER_OBJECT,
    };
  },
});

export const claimAwaitingReviewValidator = provenanceAssertionValidator
  .pick(
    "statement",
    "role",
    "partyKind",
    "partyText",
    "confidence",
    "startDate",
    "endDate",
  )
  .extend({
    claimId: v.id("provenanceClaims"),
    objectId: v.id("collections"),
    objectLabel: v.string(),
    /** Disputed and still open, rather than never reviewed. */
    disputed: v.boolean(),
    contradictsClaimId: v.optional(v.id("provenanceClaims")),
    reviewNote: v.optional(v.string()),
    createdAt: v.number(),
  });

/**
 * Current claims awaiting a reviewer, unreviewed or disputed and still open,
 * newest first. Claims on withdrawn Objects wait until restoration. Null for members who do not review provenance, so they never
 * see the Work board column.
 */
export async function readClaimsAwaitingReview(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  limit: number,
): Promise<ColumnPage<Infer<typeof claimAwaitingReviewValidator>> | null> {
  if (!(await hasPermission(ctx, organizationId, PROVENANCE_REVIEW_PERMISSION)))
    return null;
  const awaitingReview = newestFirst(
    (["unreviewed", "disputed"] as const).map((status) =>
      ctx.db
        .query("provenanceClaims")
        .withIndex("by_organization_and_reviewStatus_and_supersededAt", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("reviewStatus", status)
            .eq("supersededAt", undefined),
        )
        .order("desc"),
    ),
  );
  const { kept, hasMore } = await firstKept(
    awaitingReview,
    limit,
    async (claim) => {
      const object = await ctx.db.get(claim.objectId);
      if (
        !object ||
        object.organizationId !== organizationId ||
        isWithdrawnObject(object)
      ) {
        return null;
      }
      return {
        claimId: claim._id,
        objectId: claim.objectId,
        objectLabel: objectLabel(object),
        disputed: claim.reviewStatus === "disputed",
        statement: claim.statement,
        role: claim.role,
        partyKind: claim.partyKind,
        partyText: claim.partyText,
        confidence: claim.confidence,
        startDate: claim.startDate,
        endDate: claim.endDate,
        contradictsClaimId: claim.contradictsClaimId,
        reviewNote: claim.reviewNote,
        createdAt: claim.createdAt,
      };
    },
  );
  return { cards: kept, hasMore };
}

interface ClaimInsert {
  object: Doc<"collections">;
  userId: Id<"users">;
  assertion: ProvenanceAssertion;
  partyAccountId?: Id<"accounts">;
  /** The Party the corrected claim already names; it may be archived. */
  keptAccountId?: Id<"accounts">;
  contradictsClaimId?: Id<"provenanceClaims">;
  evidence: ProvenanceEvidenceInput[];
  /** Active evidence of the claim being corrected, copied forward. */
  carriedEvidence?: Doc<"provenanceEvidence">[];
  supersedesClaimId?: Id<"provenanceClaims">;
}

/**
 * Validates and records one claim with its evidence and, for a named holder,
 * its Party link. Nothing is written when any part is invalid.
 */
async function insertClaim(ctx: MutationCtx, input: ClaimInsert) {
  const { object, userId } = input;
  const organizationId = object.organizationId;
  const assertion = validatedProvenanceAssertion(input.assertion);
  const carried = input.carriedEvidence ?? [];
  if (input.evidence.length + carried.length > MAX_EVIDENCE_PER_CLAIM) {
    throw provenanceError(
      "PROVENANCE_EVIDENCE_LIMIT",
      `A claim holds at most ${MAX_EVIDENCE_PER_CLAIM} evidence items`,
    );
  }
  const evidence: ValidatedEvidence[] = [];
  for (const item of input.evidence) {
    evidence.push(await validatedEvidence(ctx, object, item));
  }
  if (
    assertion.confidence === "documented" &&
    evidence.length + carried.length === 0
  ) {
    throw provenanceError(
      "PROVENANCE_EVIDENCE_REQUIRED",
      "A documented claim needs at least one evidence item",
    );
  }
  const linkRole = assertion.partyKind === "named" ? assertion.role : undefined;
  if (input.partyAccountId && !linkRole) {
    throw provenanceError(
      "PROVENANCE_PARTY_INVALID",
      "Only a named holder with a stated role can be identified as a Party",
    );
  }
  const account = input.partyAccountId
    ? await requireLinkableParty(ctx, organizationId, input.partyAccountId, {
        allowArchived: input.partyAccountId === input.keptAccountId,
      })
    : null;
  if (input.contradictsClaimId) {
    if (input.contradictsClaimId === input.supersedesClaimId) {
      throw provenanceError(
        "PROVENANCE_CONTRADICTION_INVALID",
        "A correction cannot contradict the claim it corrects",
      );
    }
    await requireContradictedClaim(ctx, object, input.contradictsClaimId);
  }

  const now = Date.now();
  const claimId = await ctx.db.insert("provenanceClaims", {
    organizationId,
    objectId: object._id,
    ...assertion,
    contradictsClaimId: input.contradictsClaimId,
    supersedesClaimId: input.supersedesClaimId,
    createdBy: userId,
    createdAt: now,
    reviewStatus: "unreviewed",
  });
  const rowBase = { organizationId, objectId: object._id, claimId };
  for (const row of carried) {
    // The copy keeps who cited the source and when.
    const copy = {
      ...rowBase,
      excerpt: row.excerpt,
      locator: row.locator,
      linkedBy: row.linkedBy,
      linkedAt: row.linkedAt,
      carriedFromEvidenceId: row._id,
    };
    await ctx.db.insert(
      "provenanceEvidence",
      row.kind === "citation"
        ? { ...copy, kind: "citation", citation: row.citation, url: row.url }
        : {
            ...copy,
            kind: "media",
            mediaId: row.mediaId,
            fileNameSnapshot: row.fileNameSnapshot,
          },
    );
  }
  for (const item of evidence) {
    await ctx.db.insert("provenanceEvidence", {
      ...item,
      ...rowBase,
      linkedBy: userId,
      linkedAt: now,
    });
  }
  if (account && linkRole) {
    await recordPartyLink(ctx, {
      organizationId,
      target: claimTarget(claimId),
      account,
      role: linkRole,
      allowedRoles: [linkRole],
      assertedName: assertion.partyText,
      userId,
      origin: "staff",
    });
  }
  return {
    claimId,
    assertion,
    evidenceCount: evidence.length + carried.length,
  };
}

function auditClaim(assertion: ProvenanceAssertion) {
  return {
    statement: assertion.statement,
    role: assertion.role,
    partyKind: assertion.partyKind,
    partyText: assertion.partyText,
    method: assertion.method,
    place: assertion.place,
    startDate: assertion.startDate
      ? historicalDateEdtf(assertion.startDate)
      : undefined,
    endDate: assertion.endDate
      ? historicalDateEdtf(assertion.endDate)
      : undefined,
    confidence: assertion.confidence,
  };
}

/** Ends the Party link of a claim that is no longer current; kept in history. */
async function endClaimPartyLink(
  ctx: MutationCtx,
  claim: Doc<"provenanceClaims">,
  userId: Id<"users">,
  reason: string,
) {
  const link = await claimPartyLink(ctx, claim);
  if (link) await endPartyLink(ctx, link, userId, reason);
}

/** The current Party link of a named holder with a stated role. */
async function claimPartyLink(
  ctx: MutationCtx,
  claim: Doc<"provenanceClaims">,
) {
  if (!claim.role) return null;
  return await currentPartyLink(
    ctx,
    claim.organizationId,
    claimTarget(claim._id),
    claim.role,
  );
}

const claimInputArgs = {
  ...provenanceAssertionFields,
  /** A Party the named holder is identified as. */
  partyAccountId: v.optional(v.id("accounts")),
  contradictsClaimId: v.optional(v.id("provenanceClaims")),
};

/**
 * Records a provenance claim about an Object as its author states it, with
 * any evidence. A named holder may be identified as a Party; anonymous and
 * unknown holders never are. The claim awaits review.
 */
export const recordClaim = mutation({
  args: {
    objectId: v.id("collections"),
    ...claimInputArgs,
    evidence: v.array(provenanceEvidenceInputValidator),
  },
  returns: v.id("provenanceClaims"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const object = await requireProvenanceObject(ctx, args.objectId, "write");
    const {
      objectId: _objectId,
      partyAccountId,
      contradictsClaimId,
      evidence,
      ...assertion
    } = args;
    const recorded = await insertClaim(ctx, {
      object,
      userId,
      assertion,
      partyAccountId,
      contradictsClaimId,
      evidence,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: object.organizationId,
      userId,
      action: "provenance_claim_recorded",
      entityType: "collection",
      entityId: object._id,
      changes: {
        claimId: recorded.claimId,
        ...auditClaim(recorded.assertion),
        contradictsClaimId,
        evidenceCount: recorded.evidenceCount,
      },
    });
    return recorded.claimId;
  },
});

/**
 * Corrects a current claim by recording a replacement that supersedes it.
 * The original keeps its wording, evidence and review; its active evidence
 * is copied to the replacement, which awaits review.
 */
export const correctClaim = mutation({
  args: {
    claimId: v.id("provenanceClaims"),
    reason: v.string(),
    ...claimInputArgs,
    /**
     * The Party the corrected holder is identified as. Omitted keeps the
     * current identification while the holder stays named with a role;
     * null removes it.
     */
    partyAccountId: v.optional(v.union(v.id("accounts"), v.null())),
    evidence: v.optional(v.array(provenanceEvidenceInputValidator)),
  },
  returns: v.id("provenanceClaims"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const { claim, object } = await requireProvenanceClaim(
      ctx,
      args.claimId,
      "write",
    );
    assertCurrentClaim(claim);
    const reason = requiredProvenanceReason(args.reason);
    const {
      claimId: _claimId,
      reason: _reason,
      partyAccountId,
      contradictsClaimId,
      evidence,
      ...assertion
    } = args;
    const [evidenceRows, currentLink] = await Promise.all([
      loadClaimEvidence(ctx, claim),
      claimPartyLink(ctx, claim),
    ]);
    const keepsIdentification =
      partyAccountId === undefined &&
      assertion.partyKind === "named" &&
      assertion.role !== undefined;
    const recorded = await insertClaim(ctx, {
      object,
      userId,
      assertion,
      partyAccountId: keepsIdentification
        ? currentLink?.accountId
        : (partyAccountId ?? undefined),
      keptAccountId: currentLink?.accountId,
      contradictsClaimId,
      evidence: evidence ?? [],
      carriedEvidence: evidenceRows.filter(
        (row) => row.retractedAt === undefined,
      ),
      supersedesClaimId: claim._id,
    });
    await ctx.db.patch(claim._id, {
      supersededAt: Date.now(),
      supersededBy: userId,
      supersededByClaimId: recorded.claimId,
      supersessionReason: reason,
    });
    await endClaimPartyLink(ctx, claim, userId, reason);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: object.organizationId,
      userId,
      action: "provenance_claim_corrected",
      entityType: "collection",
      entityId: object._id,
      changes: {
        claimId: claim._id,
        replacementClaimId: recorded.claimId,
        reason,
        previous: auditClaim(claim),
        replacement: auditClaim(recorded.assertion),
      },
    });
    return recorded.claimId;
  },
});

/**
 * Retracts a current claim without a replacement, for example one recorded
 * on the wrong Object. It stays in the Object's provenance history. A claim
 * that was reviewed or is contested leaves review only through a reviewer.
 */
export const retractClaim = mutation({
  args: { claimId: v.id("provenanceClaims"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const { claim, object } = await requireProvenanceClaim(
      ctx,
      args.claimId,
      "write",
    );
    assertCurrentClaim(claim);
    const reason = requiredProvenanceReason(args.reason);
    const claims = await loadObjectClaims(ctx, object);
    const claimsById = new Map(claims.map((row) => [row._id, row]));
    if (retractionNeedsReviewer(claim, claimsById)) {
      await requirePermission(
        ctx,
        object.organizationId,
        PROVENANCE_REVIEW_PERMISSION,
      );
    }
    await ctx.db.patch(claim._id, {
      supersededAt: Date.now(),
      supersededBy: userId,
      supersessionReason: reason,
    });
    await endClaimPartyLink(ctx, claim, userId, reason);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: object.organizationId,
      userId,
      action: "provenance_claim_retracted",
      entityType: "collection",
      entityId: object._id,
      changes: { claimId: claim._id, reason, statement: claim.statement },
    });
    return null;
  },
});

/**
 * Records a reviewer's decision on a current claim. Disputing or rejecting
 * needs a note. Each decision is appended to the claim's review history and
 * the claim's own wording never changes; repeating the latest decision is a
 * no-op.
 */
export const reviewClaim = mutation({
  args: {
    claimId: v.id("provenanceClaims"),
    decision: provenanceReviewDecisionValidator,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const { claim, object } = await requireProvenanceClaim(
      ctx,
      args.claimId,
      "review",
    );
    assertCurrentClaim(claim);
    const note = optionalProvenanceText(args.note, "note");
    if (args.decision !== "accepted" && !note) {
      throw provenanceError(
        "PROVENANCE_REVIEW_NOTE_REQUIRED",
        "Say why the claim is disputed or rejected",
      );
    }
    if (claim.reviewStatus === args.decision && claim.reviewNote === note) {
      return null;
    }
    const reviewedAt = Date.now();
    await ctx.db.insert("provenanceReviews", {
      organizationId: claim.organizationId,
      objectId: claim.objectId,
      claimId: claim._id,
      decision: args.decision,
      previousStatus: claim.reviewStatus,
      note,
      reviewedBy: userId,
      reviewedAt,
    });
    await ctx.db.patch(claim._id, {
      reviewStatus: args.decision,
      reviewedBy: userId,
      reviewedAt,
      reviewNote: note,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: object.organizationId,
      userId,
      action: "provenance_claim_reviewed",
      entityType: "collection",
      entityId: object._id,
      changes: {
        claimId: claim._id,
        decision: args.decision,
        previousStatus: claim.reviewStatus,
        note,
      },
    });
    return null;
  },
});

/** Cites further evidence for a current claim. */
export const addEvidence = mutation({
  args: {
    claimId: v.id("provenanceClaims"),
    source: provenanceEvidenceSourceValidator,
    excerpt: v.optional(v.string()),
    locator: v.optional(v.string()),
  },
  returns: v.id("provenanceEvidence"),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const { claim, object } = await requireProvenanceClaim(
      ctx,
      args.claimId,
      "write",
    );
    assertCurrentClaim(claim);
    const existing = await loadClaimEvidence(ctx, claim);
    if (existing.length >= MAX_EVIDENCE_PER_CLAIM) {
      throw provenanceError(
        "PROVENANCE_EVIDENCE_LIMIT",
        `A claim holds at most ${MAX_EVIDENCE_PER_CLAIM} evidence items`,
      );
    }
    const evidence = await validatedEvidence(ctx, object, {
      source: args.source,
      excerpt: args.excerpt,
      locator: args.locator,
    });
    const evidenceId = await ctx.db.insert("provenanceEvidence", {
      ...evidence,
      organizationId: object.organizationId,
      objectId: object._id,
      claimId: claim._id,
      linkedBy: userId,
      linkedAt: Date.now(),
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: object.organizationId,
      userId,
      action: "provenance_evidence_added",
      entityType: "collection",
      entityId: object._id,
      changes: {
        claimId: claim._id,
        evidenceId,
        kind: evidence.kind,
        citation:
          evidence.kind === "citation"
            ? evidence.citation
            : evidence.fileNameSnapshot,
      },
    });
    return evidenceId;
  },
});

/**
 * Retracts a mistaken evidence item with a reason; it stays visible as
 * retracted. A documented claim must keep at least one active item.
 */
export const retractEvidence = mutation({
  args: { evidenceId: v.id("provenanceEvidence"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    const evidence = await ctx.db.get(args.evidenceId);
    if (!evidence) {
      throw provenanceError(
        "PROVENANCE_EVIDENCE_NOT_FOUND",
        "Evidence not found",
      );
    }
    const { claim, object } = await requireProvenanceClaim(
      ctx,
      evidence.claimId,
      "write",
    );
    if (evidence.organizationId !== claim.organizationId) {
      throw provenanceError(
        "PROVENANCE_EVIDENCE_NOT_FOUND",
        "Evidence not found",
      );
    }
    if (evidence.retractedAt !== undefined) {
      throw provenanceError(
        "PROVENANCE_EVIDENCE_RETRACTED",
        "This evidence was already retracted",
      );
    }
    assertCurrentClaim(claim);
    const reason = requiredProvenanceReason(args.reason);
    if (claim.confidence === "documented") {
      const others = (await loadClaimEvidence(ctx, claim)).filter(
        (row) => row._id !== evidence._id && row.retractedAt === undefined,
      );
      if (others.length === 0) {
        throw provenanceError(
          "PROVENANCE_EVIDENCE_REQUIRED",
          "A documented claim needs at least one evidence item; correct the claim instead",
        );
      }
    }
    await ctx.db.patch(evidence._id, {
      retractedAt: Date.now(),
      retractedBy: userId,
      retractionReason: reason,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: object.organizationId,
      userId,
      action: "provenance_evidence_retracted",
      entityType: "collection",
      entityId: object._id,
      changes: { claimId: claim._id, evidenceId: evidence._id, reason },
    });
    return null;
  },
});

/**
 * Moves the rest of a transferred Object's provenance from an organization it
 * left to the one holding it now, a batch at a time. An Object that went back
 * to that organization already sits with what is left.
 */
export const rehomeRemaining = internalMutation({
  args: {
    objectId: v.id("collections"),
    fromOrganizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const object = await ctx.db.get(args.objectId);
    if (!object || object.organizationId === args.fromOrganizationId) {
      return null;
    }
    await rehomeObjectProvenance(ctx, {
      objectId: object._id,
      fromOrganizationId: args.fromOrganizationId,
      toOrganizationId: object.organizationId,
    });
    return null;
  },
});
