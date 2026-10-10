import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { evaluateCapability } from "./capabilities";
import type {
  FindingDetail,
  FindingKind,
  FindingReview,
  IdentifierCarry,
} from "./documentationQualityValidators";
import {
  objectEvidence,
  objectStage,
  recordedLegacyText,
} from "./documentationRequirements";
import { organizationAccess } from "./featureGates";
import type { IdentifierRegister } from "./identifiers";
import { memberPermissionNames } from "./memberPermissions";
import {
  accessionLegacyCandidate,
  awaitsLegacyPartyReview,
  deaccessionLegacyCandidate,
  type LegacyPartyCandidate,
} from "./partyLinks";
import {
  accessionReferenceProblems,
  type BrokenReference,
  deaccessionReferenceProblems,
  objectReferenceProblems,
} from "./recordReferences";

type Check = Doc<"documentationChecks">;

/** Records read per page; a page that fails is retried with fewer. */
export const CHECK_PAGE_SIZE = 25;
/** A running check with no committed page for this long can be resumed. */
export const CHECK_STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * One phase per scan, in order. Resolve phases run last, so only a check
 * that read every record closes findings it did not detect again.
 */
export const CHECK_PHASES = [
  "catalog_identifiers",
  "accession_identifiers",
  "objects_active",
  "objects_loaned",
  "objects_deaccessioned",
  "accessions",
  "deaccessions",
  "resolve_duplicate_identifier",
  "resolve_missing_evidence",
  "resolve_legacy_link",
  "resolve_orphan_reference",
] as const;

export type CheckPhase = (typeof CHECK_PHASES)[number];

interface PageStats {
  rows: number;
  detected: number;
  opened: number;
  reopened: number;
  resolved: number;
}

/** Records of one duplicate identifier shown on its finding. */
const DUPLICATE_RECORDS_KEPT = 10;
/** Records of one duplicate identifier read to confirm their reviews. */
const DUPLICATE_GROUP_READ_LIMIT = 100;

interface PageProgress {
  cursor: string | null;
  done: boolean;
  carry?: IdentifierCarry;
}

interface Detection {
  key: string;
  /** What was found; a change reopens an accepted finding. */
  signature: string;
  detail: FindingDetail;
  /**
   * For findings reviewed in another register (identifier conflict
   * reviews): that review, or null while it is incomplete. The finding
   * follows it instead of its own acceptance.
   */
  registerReview?: FindingReview | null;
}

export function normalizeObjectType(value: string) {
  return value.normalize("NFC").trim().toLowerCase();
}

/**
 * Upserts the finding for one detection. A resolved finding detected again
 * reopens; an accepted one stays accepted unless what was found changed.
 * Nothing in the checked record is touched.
 */
async function recordDetection(
  ctx: MutationCtx,
  check: Check,
  detection: Detection,
  stats: PageStats,
) {
  const existing = await ctx.db
    .query("documentationFindings")
    .withIndex("by_organization_and_key", (q) =>
      q.eq("organizationId", check.organizationId).eq("key", detection.key),
    )
    .unique();
  if (existing?.lastCheckNumber === check.number) return;
  stats.detected++;
  const now = Date.now();
  const { registerReview } = detection;
  if (!existing) {
    const status = registerReview ? "accepted" : "open";
    await ctx.db.insert("documentationFindings", {
      organizationId: check.organizationId,
      key: detection.key,
      ...detection.detail,
      status,
      standing: true,
      signature: detection.signature,
      firstCheckNumber: check.number,
      lastCheckNumber: check.number,
      firstDetectedAt: now,
      lastDetectedAt: now,
      review: registerReview ?? undefined,
    });
    if (status === "open") stats.opened++;
    return;
  }
  const status =
    registerReview !== undefined
      ? registerReview
        ? "accepted"
        : "open"
      : existing.status === "resolved" ||
          (existing.status === "accepted" &&
            existing.signature !== detection.signature)
        ? "open"
        : existing.status;
  const reopened = status === "open" && existing.status !== "open";
  if (reopened) stats.reopened++;
  await ctx.db.replace(existing._id, {
    organizationId: existing.organizationId,
    key: existing.key,
    ...detection.detail,
    status,
    standing: true,
    signature: detection.signature,
    firstCheckNumber: existing.firstCheckNumber,
    lastCheckNumber: check.number,
    firstDetectedAt: existing.firstDetectedAt,
    lastDetectedAt: now,
    reopenedAt: reopened ? now : existing.reopenedAt,
    review: registerReview ?? existing.review,
  });
}

/** The latest identifier conflict review, when every record has one. */
async function identifierRegisterReview(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  register: IdentifierRegister,
  normalizedIdentifier: string,
  records: ReadonlyArray<{ _id: Id<"collections"> | Id<"accessions"> }>,
): Promise<FindingReview | null> {
  let latest: FindingReview | null = null;
  for (const record of records) {
    const review = await ctx.db
      .query("identifierConflictReviews")
      .withIndex("by_organization_and_register_and_record", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("register", register)
          .eq("recordId", record._id),
      )
      .order("desc")
      .first();
    if (!review || review.normalizedIdentifier !== normalizedIdentifier)
      return null;
    if (!latest || review.reviewedAt > latest.reviewedAt)
      latest = {
        note: review.note,
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt,
      };
  }
  return latest;
}

/** Records sharing one normalized identifier in a register, oldest first. */
export async function identifierGroup(
  ctx: Pick<MutationCtx, "db">,
  organizationId: Id<"organizations">,
  register: IdentifierRegister,
  normalizedIdentifier: string,
  limit: number,
): Promise<Array<Doc<"collections"> | Doc<"accessions">>> {
  return register === "catalog"
    ? await ctx.db
        .query("collections")
        .withIndex("by_organization_and_normalizedIdentifier", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("normalizedIdentifier", normalizedIdentifier),
        )
        .take(limit)
    : await ctx.db
        .query("accessions")
        .withIndex("by_organization_and_normalizedIdentifier", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("normalizedIdentifier", normalizedIdentifier),
        )
        .take(limit);
}

async function duplicateRecordLabel(
  ctx: MutationCtx,
  record: Doc<"collections"> | Doc<"accessions">,
) {
  if ("title" in record) return record.title;
  if (!record.collectionId) return "";
  const object = await ctx.db.get(record.collectionId);
  return object?.organizationId === record.organizationId ? object.title : "";
}

async function flushDuplicateGroup(
  ctx: MutationCtx,
  check: Check,
  register: IdentifierRegister,
  carry: IdentifierCarry,
  stats: PageStats,
) {
  if (carry.count < 2) return;
  const records = await identifierGroup(
    ctx,
    check.organizationId,
    register,
    carry.normalizedIdentifier,
    DUPLICATE_GROUP_READ_LIMIT + 1,
  );
  const [first] = records;
  if (!first || records.length < 2) return;
  const shown = await Promise.all(
    records.slice(0, DUPLICATE_RECORDS_KEPT).map(async (record) => ({
      id: record._id,
      identifier: record.accessionNumber,
      label: await duplicateRecordLabel(ctx, record),
    })),
  );
  await recordDetection(
    ctx,
    check,
    {
      key: `duplicate_identifier:${register}:${carry.normalizedIdentifier}`,
      signature: records.map((record) => record._id).join(","),
      detail: {
        kind: "duplicate_identifier",
        register,
        normalizedIdentifier: carry.normalizedIdentifier,
        identifier: first.accessionNumber,
        records: shown,
        recordCount: Math.max(carry.count, records.length),
      },
      registerReview:
        records.length > DUPLICATE_GROUP_READ_LIMIT
          ? null
          : await identifierRegisterReview(
              ctx,
              check.organizationId,
              register,
              carry.normalizedIdentifier,
              records,
            ),
    },
    stats,
  );
}

/**
 * Walks a register in identifier order, so records sharing an identifier
 * are adjacent; a group may continue on the next page. Identifiers not yet
 * indexed are left out (the check reports that the index is incomplete).
 */
async function scanIdentifiers(
  ctx: MutationCtx,
  check: Check,
  register: IdentifierRegister,
  pageSize: number,
  stats: PageStats,
): Promise<PageProgress> {
  const result =
    register === "catalog"
      ? await ctx.db
          .query("collections")
          .withIndex("by_organization_and_normalizedIdentifier", (q) =>
            q
              .eq("organizationId", check.organizationId)
              .gte("normalizedIdentifier", ""),
          )
          .paginate({ cursor: check.cursor, numItems: pageSize })
      : await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_normalizedIdentifier", (q) =>
            q
              .eq("organizationId", check.organizationId)
              .gte("normalizedIdentifier", ""),
          )
          .paginate({ cursor: check.cursor, numItems: pageSize });
  let carry = check.carry;
  for (const record of result.page) {
    const key = record.normalizedIdentifier ?? "";
    if (carry?.normalizedIdentifier === key) {
      carry = { normalizedIdentifier: key, count: carry.count + 1 };
      continue;
    }
    if (carry) await flushDuplicateGroup(ctx, check, register, carry, stats);
    carry = { normalizedIdentifier: key, count: 1 };
  }
  if (result.isDone && carry) {
    await flushDuplicateGroup(ctx, check, register, carry, stats);
    carry = undefined;
  }
  return {
    cursor: result.isDone ? null : result.continueCursor,
    done: result.isDone,
    carry,
  };
}

async function scanObjects(
  ctx: MutationCtx,
  check: Check,
  status: "active" | "loaned" | "deaccessioned",
  pageSize: number,
  stats: PageStats,
): Promise<PageProgress> {
  const result = await ctx.db
    .query("collections")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", check.organizationId).eq("status", status),
    )
    .paginate({ cursor: check.cursor, numItems: pageSize });
  const checkedProfiles = check.profiles.map((profile) => ({
    ...profile,
    stageSet: new Set(profile.stages),
  }));
  for (const object of result.page) {
    stats.rows++;
    for (const problem of await objectReferenceProblems(ctx, object))
      await recordDetection(
        ctx,
        check,
        orphanDetection(
          { type: "object", id: object._id },
          object.accessionNumber,
          problem,
        ),
        stats,
      );
    const objectType = normalizeObjectType(object.objectType ?? "");
    const profiles = checkedProfiles.filter(
      (profile) =>
        profile.normalizedObjectType === undefined ||
        profile.normalizedObjectType === objectType,
    );
    if (profiles.length === 0) continue;
    const stage = await objectStage(ctx, object);
    const missingOf = objectEvidence(ctx, object);
    for (const profile of profiles) {
      if (!profile.stageSet.has(stage)) continue;
      const missing = await missingOf(profile.requirements);
      if (missing.length === 0) continue;
      await recordDetection(
        ctx,
        check,
        {
          key: `missing_evidence:${profile.profileId}:${object._id}`,
          signature: missing.join(","),
          detail: {
            kind: "missing_evidence",
            objectId: object._id,
            objectIdentifier: object.accessionNumber,
            objectTitle: object.title,
            stage,
            profileId: profile.profileId,
            profileName: profile.name,
            missing,
            recorded: recordedLegacyText(object, missing),
          },
        },
        stats,
      );
    }
  }
  return {
    cursor: result.isDone ? null : result.continueCursor,
    done: result.isDone,
  };
}

type OrphanSubject = Extract<
  FindingDetail,
  { kind: "orphan_reference" }
>["subject"];
type OrphanField = Extract<
  FindingDetail,
  { kind: "orphan_reference" }
>["field"];

function orphanDetection(
  subject: OrphanSubject,
  label: string,
  problem: BrokenReference<OrphanField>,
): Detection {
  return {
    key: `orphan_reference:${subject.type}:${subject.id}:${problem.field}`,
    signature: `${problem.problem}:${problem.referencedId}`,
    detail: {
      kind: "orphan_reference",
      subject,
      label,
      field: problem.field,
      referencedId: problem.referencedId,
      problem: problem.problem,
    },
  };
}

/** A record naming a Party without a typed link, while Parties are on. */
async function detectLegacyLink(
  ctx: MutationCtx,
  check: Check,
  candidate: LegacyPartyCandidate | null,
  stats: PageStats,
) {
  if (!check.partiesChecked || !candidate) return;
  const { target } = candidate;
  const [suggestedRole] = candidate.roles;
  if (
    !suggestedRole ||
    (target.type !== "accession" && target.type !== "deaccession") ||
    !(await awaitsLegacyPartyReview(ctx, check.organizationId, candidate))
  )
    return;
  const account = candidate.existingAccountId
    ? await ctx.db.get(candidate.existingAccountId)
    : null;
  const existingAccountId =
    account?.organizationId === check.organizationId ? account._id : undefined;
  await recordDetection(
    ctx,
    check,
    {
      key: `legacy_link:${target.type}:${target.id}`,
      signature: `${candidate.assertedName ?? ""}|${existingAccountId ?? ""}`,
      detail: {
        kind: "legacy_link",
        target,
        label: candidate.label,
        assertedName: candidate.assertedName,
        existingAccountId,
        suggestedRole,
      },
    },
    stats,
  );
}

async function scanAccessions(
  ctx: MutationCtx,
  check: Check,
  pageSize: number,
  stats: PageStats,
): Promise<PageProgress> {
  const result = await ctx.db
    .query("accessions")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", check.organizationId),
    )
    .paginate({ cursor: check.cursor, numItems: pageSize });
  for (const accession of result.page) {
    stats.rows++;
    for (const problem of await accessionReferenceProblems(ctx, accession))
      await recordDetection(
        ctx,
        check,
        orphanDetection(
          { type: "accession", id: accession._id },
          accession.accessionNumber,
          problem,
        ),
        stats,
      );
    await detectLegacyLink(
      ctx,
      check,
      accessionLegacyCandidate(accession),
      stats,
    );
  }
  return {
    cursor: result.isDone ? null : result.continueCursor,
    done: result.isDone,
  };
}

async function scanDeaccessions(
  ctx: MutationCtx,
  check: Check,
  pageSize: number,
  stats: PageStats,
): Promise<PageProgress> {
  const result = await ctx.db
    .query("deaccessions")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", check.organizationId),
    )
    .paginate({ cursor: check.cursor, numItems: pageSize });
  for (const deaccession of result.page) {
    stats.rows++;
    for (const problem of await deaccessionReferenceProblems(ctx, deaccession))
      await recordDetection(
        ctx,
        check,
        orphanDetection(
          { type: "deaccession", id: deaccession._id },
          deaccession.deaccessionNumber,
          problem,
        ),
        stats,
      );
    await detectLegacyLink(
      ctx,
      check,
      deaccessionLegacyCandidate(deaccession),
      stats,
    );
  }
  return {
    cursor: result.isDone ? null : result.continueCursor,
    done: result.isDone,
  };
}

/**
 * Closes findings of `kind` the check did not detect again. Each page takes
 * the next batch, because resolved rows leave the index range.
 */
async function resolveUndetected(
  ctx: MutationCtx,
  check: Check,
  kind: FindingKind,
  pageSize: number,
  stats: PageStats,
): Promise<PageProgress> {
  const undetected = await ctx.db
    .query("documentationFindings")
    .withIndex(
      "by_organization_and_standing_and_kind_and_lastCheckNumber",
      (q) =>
        q
          .eq("organizationId", check.organizationId)
          .eq("standing", true)
          .eq("kind", kind)
          .lt("lastCheckNumber", check.number),
    )
    .take(pageSize);
  const now = Date.now();
  for (const finding of undetected) {
    await ctx.db.patch(finding._id, {
      status: "resolved",
      standing: false,
      resolvedAt: now,
      resolvedCheckNumber: check.number,
    });
    stats.resolved++;
  }
  return { cursor: null, done: undetected.length < pageSize };
}

function runPhase(
  ctx: MutationCtx,
  check: Check,
  phase: CheckPhase,
  pageSize: number,
  stats: PageStats,
): Promise<PageProgress> {
  switch (phase) {
    case "catalog_identifiers":
      return scanIdentifiers(ctx, check, "catalog", pageSize, stats);
    case "accession_identifiers":
      return scanIdentifiers(ctx, check, "accession", pageSize, stats);
    case "objects_active":
      return scanObjects(ctx, check, "active", pageSize, stats);
    case "objects_loaned":
      return scanObjects(ctx, check, "loaned", pageSize, stats);
    case "objects_deaccessioned":
      return scanObjects(ctx, check, "deaccessioned", pageSize, stats);
    case "resolve_duplicate_identifier":
      return resolveUndetected(
        ctx,
        check,
        "duplicate_identifier",
        pageSize,
        stats,
      );
    case "accessions":
      return scanAccessions(ctx, check, pageSize, stats);
    case "deaccessions":
      return scanDeaccessions(ctx, check, pageSize, stats);
    case "resolve_missing_evidence":
      return resolveUndetected(ctx, check, "missing_evidence", pageSize, stats);
    case "resolve_legacy_link":
      // Unchecked party links keep their findings as they were.
      return check.partiesChecked
        ? resolveUndetected(ctx, check, "legacy_link", pageSize, stats)
        : Promise.resolve({ cursor: null, done: true });
    case "resolve_orphan_reference":
      return resolveUndetected(ctx, check, "orphan_reference", pageSize, stats);
  }
}

/** Whether `userId` may still run checks: delayed pages recheck access. */
export async function mayRunChecks(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const [organization, permissions] = await Promise.all([
    ctx.db.get(organizationId),
    memberPermissionNames(ctx, organizationId, userId),
  ]);
  if (!organization || !permissions) return false;
  return (
    evaluateCapability(
      "documentation_quality",
      organizationAccess(organization),
      [...permissions],
    ).status === "available"
  );
}

export async function scheduleCheckPage(
  ctx: MutationCtx,
  checkId: Id<"documentationChecks">,
  expectedCheckpoint: number,
) {
  await ctx.scheduler.runAfter(0, internal.documentationQuality.advanceCheck, {
    checkId,
    expectedCheckpoint,
  });
}

/**
 * Applies one checkpoint page. A stale or replayed continuation (another
 * checkpoint, or a check no longer running) does nothing.
 */
export async function applyCheckPage(
  ctx: MutationCtx,
  checkId: Id<"documentationChecks">,
  expectedCheckpoint: number,
  pageSize: number,
) {
  const check = await ctx.db.get(checkId);
  if (
    !check ||
    check.status !== "running" ||
    check.checkpoint !== expectedCheckpoint
  )
    return "noop" as const;
  const now = Date.now();
  if (!(await mayRunChecks(ctx, check.organizationId, check.actorId))) {
    await ctx.db.patch(check._id, {
      status: "failed",
      failure: {
        code: "ACTOR_NOT_PERMITTED",
        message: "The member running this check no longer has access to it",
      },
      finishedAt: now,
      updatedAt: now,
    });
    return "done" as const;
  }
  const phase = CHECK_PHASES[check.phase];
  if (!phase) {
    await ctx.db.patch(check._id, {
      status: "completed",
      finishedAt: now,
      updatedAt: now,
    });
    return "done" as const;
  }
  const stats: PageStats = {
    rows: 0,
    detected: 0,
    opened: 0,
    reopened: 0,
    resolved: 0,
  };
  const progress = await runPhase(ctx, check, phase, pageSize, stats);
  const checkpoint = check.checkpoint + 1;
  await ctx.db.patch(check._id, {
    phase: progress.done ? check.phase + 1 : check.phase,
    cursor: progress.cursor,
    carry: progress.carry,
    checkpoint,
    checkedRecords: check.checkedRecords + stats.rows,
    detected: check.detected + stats.detected,
    opened: check.opened + stats.opened,
    reopened: check.reopened + stats.reopened,
    resolved: check.resolved + stats.resolved,
    updatedAt: now,
  });
  await scheduleCheckPage(ctx, check._id, checkpoint);
  return "continue" as const;
}

export async function markCheckPageFailed(
  ctx: MutationCtx,
  checkId: Id<"documentationChecks">,
  expectedCheckpoint: number,
  message: string,
) {
  const check = await ctx.db.get(checkId);
  if (
    !check ||
    check.status !== "running" ||
    check.checkpoint !== expectedCheckpoint
  )
    return;
  const now = Date.now();
  await ctx.db.patch(check._id, {
    status: "failed",
    failure: { code: "PAGE_FAILED", message: message.slice(0, 500) },
    finishedAt: now,
    updatedAt: now,
  });
}
