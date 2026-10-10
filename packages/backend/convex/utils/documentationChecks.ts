import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { evaluateCapability } from "./capabilities";
import type {
  FindingDetail,
  FindingKind,
} from "./documentationQualityValidators";
import {
  objectEvidence,
  objectStage,
  recordedLegacyText,
} from "./documentationRequirements";
import { organizationAccess } from "./featureGates";
import { memberPermissionNames } from "./memberPermissions";

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
  "objects_active",
  "objects_loaned",
  "objects_deaccessioned",
  "resolve_missing_evidence",
] as const;

export type CheckPhase = (typeof CHECK_PHASES)[number];

interface PageStats {
  rows: number;
  detected: number;
  opened: number;
  reopened: number;
  resolved: number;
}

interface PageProgress {
  cursor: string | null;
  done: boolean;
}

interface Detection {
  key: string;
  /** What was found; a change reopens an accepted finding. */
  signature: string;
  detail: FindingDetail;
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
  if (!existing) {
    await ctx.db.insert("documentationFindings", {
      organizationId: check.organizationId,
      key: detection.key,
      ...detection.detail,
      status: "open",
      standing: true,
      signature: detection.signature,
      firstCheckNumber: check.number,
      lastCheckNumber: check.number,
      firstDetectedAt: now,
      lastDetectedAt: now,
    });
    stats.opened++;
    return;
  }
  const reopen =
    existing.status === "resolved" ||
    (existing.status === "accepted" &&
      existing.signature !== detection.signature);
  if (reopen) stats.reopened++;
  await ctx.db.replace(existing._id, {
    organizationId: existing.organizationId,
    key: existing.key,
    ...detection.detail,
    status: reopen ? "open" : existing.status,
    standing: true,
    signature: detection.signature,
    firstCheckNumber: existing.firstCheckNumber,
    lastCheckNumber: check.number,
    firstDetectedAt: existing.firstDetectedAt,
    lastDetectedAt: now,
    reopenedAt: reopen ? now : existing.reopenedAt,
    review: existing.review,
  });
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
  for (const object of result.page) {
    stats.rows++;
    const objectType = normalizeObjectType(object.objectType ?? "");
    const profiles = check.profiles.filter(
      (profile) =>
        profile.normalizedObjectType === undefined ||
        profile.normalizedObjectType === objectType,
    );
    if (profiles.length === 0) continue;
    const stage = await objectStage(ctx, object);
    const missingOf = objectEvidence(ctx, object);
    for (const profile of profiles) {
      if (!profile.stages.includes(stage)) continue;
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
    .withIndex("by_organization_and_standing_and_kind_and_lastCheckNumber", (q) =>
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
    case "objects_active":
      return scanObjects(ctx, check, "active", pageSize, stats);
    case "objects_loaned":
      return scanObjects(ctx, check, "loaned", pageSize, stats);
    case "objects_deaccessioned":
      return scanObjects(ctx, check, "deaccessioned", pageSize, stats);
    case "resolve_missing_evidence":
      return resolveUndetected(ctx, check, "missing_evidence", pageSize, stats);
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
