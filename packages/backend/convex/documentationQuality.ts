import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { runCheckpointPage } from "./utils/boundedJobs";
import {
  CAPABILITY_MATRIX,
  isOrganizationModuleEnabled,
} from "./utils/capabilities";
import {
  applyCheckPage,
  CHECK_PAGE_SIZE,
  CHECK_PHASES,
  identifierGroup,
  markCheckPageFailed,
  normalizeObjectType,
  scheduleCheckPage,
} from "./utils/documentationChecks";
import { qualityError } from "./utils/documentationQualityErrors";
import {
  checkFailureCodeValidator,
  checkStatusValidator,
  DOCUMENTATION_REQUIREMENTS,
  DOCUMENTATION_STAGES,
  type DocumentationRequirement,
  type DocumentationStage,
  documentationFindingDocValidator,
  documentationRequirementValidator,
  documentationStageValidator,
  findingKindValidator,
  findingStatusValidator,
} from "./utils/documentationQualityValidators";
import { organizationAccess } from "./utils/featureGates";
import {
  findIdentifierMatches,
  recordIdentifierConflictReview,
} from "./utils/identifiers";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { hasPermission, requireCapability } from "./utils/permissions";

const QUALITY_PERMISSIONS = CAPABILITY_MATRIX.documentation_quality.permissions;
const PROFILE_MANAGE_PERMISSION = "organization.manage_settings";
export const MAX_ACTIVE_PROFILES = 20;
const MAX_ARCHIVED_PROFILES_LISTED = 100;
const MAX_PROFILE_NAME_LENGTH = 120;
const MAX_OBJECT_TYPE_LENGTH = 200;

/**
 * Members with the documentation quality capability; `extra` adds the
 * permissions a command needs on top of it.
 */
async function requireQualityAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  extra: readonly string[] = [],
) {
  await requireCapability(ctx, organizationId, "documentation_quality", [
    ...QUALITY_PERMISSIONS,
    ...extra,
  ]);
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

// ============================================
// PROFILES
// ============================================

const profileDefinitionArgs = {
  name: v.string(),
  /** Absent for a profile that applies to every object type. */
  objectType: v.optional(v.string()),
  stages: v.array(documentationStageValidator),
  requirements: v.array(documentationRequirementValidator),
};

function profileDefinition(input: {
  name: string;
  objectType?: string;
  stages: DocumentationStage[];
  requirements: DocumentationRequirement[];
}) {
  const name = input.name.trim();
  if (!name || name.length > MAX_PROFILE_NAME_LENGTH)
    throw qualityError(
      "PROFILE_INVALID",
      `Profile name must be 1-${MAX_PROFILE_NAME_LENGTH} characters`,
      { field: "name" },
    );
  const objectType = input.objectType?.trim() || undefined;
  if (objectType && objectType.length > MAX_OBJECT_TYPE_LENGTH)
    throw qualityError(
      "PROFILE_INVALID",
      `Object type must be at most ${MAX_OBJECT_TYPE_LENGTH} characters`,
      { field: "objectType" },
    );
  const stages = DOCUMENTATION_STAGES.filter((stage) =>
    input.stages.includes(stage),
  );
  if (stages.length === 0)
    throw qualityError("PROFILE_INVALID", "Choose at least one stage", {
      field: "stages",
    });
  const requirements = DOCUMENTATION_REQUIREMENTS.filter((requirement) =>
    input.requirements.includes(requirement),
  );
  if (requirements.length === 0)
    throw qualityError("PROFILE_INVALID", "Choose at least one requirement", {
      field: "requirements",
    });
  return {
    name,
    objectType,
    normalizedObjectType: objectType
      ? normalizeObjectType(objectType)
      : undefined,
    stages,
    requirements,
  };
}

async function requireActiveProfileSlot(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const active = await ctx.db
    .query("documentationProfiles")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    )
    .take(MAX_ACTIVE_PROFILES);
  if (active.length >= MAX_ACTIVE_PROFILES)
    throw qualityError(
      "PROFILE_LIMIT_REACHED",
      `An organization can have at most ${MAX_ACTIVE_PROFILES} active profiles`,
    );
}

async function loadProfileForChange(
  ctx: MutationCtx,
  profileId: Id<"documentationProfiles">,
) {
  const profile = await ctx.db.get(profileId);
  if (!profile) throw qualityError("PROFILE_NOT_FOUND", "Profile not found");
  const userId = await requireQualityAccess(ctx, profile.organizationId, [
    PROFILE_MANAGE_PERMISSION,
  ]);
  return { profile, userId };
}

async function logProfileChange(
  ctx: MutationCtx,
  profile: Pick<Doc<"documentationProfiles">, "organizationId" | "name">,
  profileId: Id<"documentationProfiles">,
  userId: Id<"users">,
  action: string,
  changes: Record<string, unknown> = {},
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: profile.organizationId,
    userId,
    action,
    entityType: "documentationProfile",
    entityId: profileId,
    changes: { name: profile.name, ...changes },
  });
}

const profileViewValidator = v.object({
  _id: v.id("documentationProfiles"),
  name: v.string(),
  objectType: v.optional(v.string()),
  stages: v.array(documentationStageValidator),
  requirements: v.array(documentationRequirementValidator),
  status: v.union(v.literal("active"), v.literal("archived")),
  version: v.number(),
  updatedAt: v.number(),
  updatedByName: v.optional(v.string()),
});

/** Active profiles by name, then archived ones. */
export const listProfiles = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    canManage: v.boolean(),
    profiles: v.array(profileViewValidator),
  }),
  handler: async (ctx, args) => {
    await requireQualityAccess(ctx, args.organizationId);
    const [canManage, active, archived] = await Promise.all([
      hasPermission(ctx, args.organizationId, PROFILE_MANAGE_PERMISSION),
      ctx.db
        .query("documentationProfiles")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "active"),
        )
        .take(MAX_ACTIVE_PROFILES),
      ctx.db
        .query("documentationProfiles")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "archived"),
        )
        .order("desc")
        .take(MAX_ARCHIVED_PROFILES_LISTED),
    ]);
    const byName = (
      a: Doc<"documentationProfiles">,
      b: Doc<"documentationProfiles">,
    ) => a.name.localeCompare(b.name) || a._creationTime - b._creationTime;
    const rows = [...active.sort(byName), ...archived.sort(byName)];
    const editors = await Promise.all(
      rows.map((profile) => ctx.db.get(profile.updatedBy)),
    );
    return {
      canManage,
      profiles: rows.map((profile, index) => ({
        _id: profile._id,
        name: profile.name,
        objectType: profile.objectType,
        stages: profile.stages,
        requirements: profile.requirements,
        status: profile.status,
        version: profile.version,
        updatedAt: profile.updatedAt,
        updatedByName:
          editors[index]?.name ?? editors[index]?.email ?? undefined,
      })),
    };
  },
});

export const createProfile = mutation({
  args: { organizationId: v.id("organizations"), ...profileDefinitionArgs },
  returns: v.id("documentationProfiles"),
  handler: async (ctx, args) => {
    const userId = await requireQualityAccess(ctx, args.organizationId, [
      PROFILE_MANAGE_PERMISSION,
    ]);
    const definition = profileDefinition(args);
    await requireActiveProfileSlot(ctx, args.organizationId);
    const now = Date.now();
    const profile = {
      organizationId: args.organizationId,
      ...definition,
      status: "active" as const,
      version: 1,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    };
    const profileId = await ctx.db.insert("documentationProfiles", profile);
    await logProfileChange(
      ctx,
      profile,
      profileId,
      userId,
      "documentation_profile_created",
      definition,
    );
    return profileId;
  },
});

/** Replaces a profile's definition; the next check applies it. */
export const updateProfile = mutation({
  args: { profileId: v.id("documentationProfiles"), ...profileDefinitionArgs },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, userId } = await loadProfileForChange(
      ctx,
      args.profileId,
    );
    const definition = profileDefinition(args);
    await ctx.db.patch(profile._id, {
      ...definition,
      version: profile.version + 1,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await logProfileChange(
      ctx,
      { organizationId: profile.organizationId, name: definition.name },
      profile._id,
      userId,
      "documentation_profile_updated",
      { ...definition, version: profile.version + 1 },
    );
    return null;
  },
});

export const archiveProfile = mutation({
  args: { profileId: v.id("documentationProfiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, userId } = await loadProfileForChange(
      ctx,
      args.profileId,
    );
    if (profile.status === "archived") return null;
    await ctx.db.patch(profile._id, {
      status: "archived",
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await logProfileChange(
      ctx,
      profile,
      profile._id,
      userId,
      "documentation_profile_archived",
    );
    return null;
  },
});

export const restoreProfile = mutation({
  args: { profileId: v.id("documentationProfiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, userId } = await loadProfileForChange(
      ctx,
      args.profileId,
    );
    if (profile.status === "active") return null;
    await requireActiveProfileSlot(ctx, profile.organizationId);
    await ctx.db.patch(profile._id, {
      status: "active",
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await logProfileChange(
      ctx,
      profile,
      profile._id,
      userId,
      "documentation_profile_restored",
    );
    return null;
  },
});

// ============================================
// CHECKS
// ============================================

const RECENT_CHECKS_LISTED = 10;

const checkViewValidator = v.object({
  _id: v.id("documentationChecks"),
  number: v.number(),
  status: checkStatusValidator,
  /** The phase being read, or `finished`. */
  phase: v.string(),
  phaseIndex: v.number(),
  phaseCount: v.number(),
  requestedByName: v.optional(v.string()),
  profileCount: v.number(),
  partiesChecked: v.boolean(),
  identifierIndexIncomplete: v.boolean(),
  checkedRecords: v.number(),
  detected: v.number(),
  opened: v.number(),
  reopened: v.number(),
  resolved: v.number(),
  attempts: v.number(),
  startedAt: v.number(),
  /** When the last page committed; clients flag a long-idle running check. */
  updatedAt: v.number(),
  finishedAt: v.optional(v.number()),
  failureCode: v.optional(checkFailureCodeValidator),
});

async function toCheckView(ctx: QueryCtx, check: Doc<"documentationChecks">) {
  const requester = await ctx.db.get(check.requestedBy);
  return {
    _id: check._id,
    number: check.number,
    status: check.status,
    phase: CHECK_PHASES[check.phase] ?? "finished",
    phaseIndex: Math.min(check.phase, CHECK_PHASES.length),
    phaseCount: CHECK_PHASES.length,
    requestedByName: requester?.name ?? requester?.email ?? undefined,
    profileCount: check.profiles.length,
    partiesChecked: check.partiesChecked,
    identifierIndexIncomplete: check.identifierIndexIncomplete,
    checkedRecords: check.checkedRecords,
    detected: check.detected,
    opened: check.opened,
    reopened: check.reopened,
    resolved: check.resolved,
    attempts: check.attempts,
    startedAt: check.startedAt,
    updatedAt: check.updatedAt,
    finishedAt: check.finishedAt,
    failureCode: check.failure?.code,
  };
}

/** The latest check and the ones before it, newest first. */
export const getCheckOverview = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    current: v.union(checkViewValidator, v.null()),
    recent: v.array(checkViewValidator),
  }),
  handler: async (ctx, args) => {
    await requireQualityAccess(ctx, args.organizationId);
    const checks = await ctx.db
      .query("documentationChecks")
      .withIndex("by_organization_and_number", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(RECENT_CHECKS_LISTED);
    const recent = await Promise.all(
      checks.map((check) => toCheckView(ctx, check)),
    );
    return { current: recent[0] ?? null, recent };
  },
});

async function hasUnindexedIdentifiers(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const [object, accession] = await Promise.all([
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("normalizedIdentifier", undefined),
      )
      .first(),
    ctx.db
      .query("accessions")
      .withIndex("by_organization_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("normalizedIdentifier", undefined),
      )
      .first(),
  ]);
  return object !== null || accession !== null;
}

/**
 * Starts a bounded check of every record against the active profiles and
 * the built-in checks. One check runs at a time per organization.
 */
export const startCheck = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.id("documentationChecks"),
  handler: async (ctx, args) => {
    const userId = await requireQualityAccess(ctx, args.organizationId);
    const running = await ctx.db
      .query("documentationChecks")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "running"),
      )
      .first();
    if (running)
      throw qualityError("CHECK_RUNNING", "A check is already running");
    const [organization, latest, profiles, identifierIndexIncomplete] =
      await Promise.all([
        ctx.db.get(args.organizationId),
        ctx.db
          .query("documentationChecks")
          .withIndex("by_organization_and_number", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .order("desc")
          .first(),
        ctx.db
          .query("documentationProfiles")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "active"),
          )
          .take(MAX_ACTIVE_PROFILES),
        hasUnindexedIdentifiers(ctx, args.organizationId),
      ]);
    if (!organization) throw new Error("Organization not found");
    const now = Date.now();
    const number = (latest?.number ?? 0) + 1;
    const checkId = await ctx.db.insert("documentationChecks", {
      organizationId: args.organizationId,
      number,
      status: "running",
      requestedBy: userId,
      actorId: userId,
      profiles: profiles.map((profile) => ({
        profileId: profile._id,
        name: profile.name,
        normalizedObjectType: profile.normalizedObjectType,
        stages: profile.stages,
        requirements: profile.requirements,
        version: profile.version,
      })),
      partiesChecked: isOrganizationModuleEnabled(
        organizationAccess(organization),
        "accounts",
      ),
      identifierIndexIncomplete,
      phase: 0,
      cursor: null,
      checkpoint: 0,
      attempts: 1,
      checkedRecords: 0,
      detected: 0,
      opened: 0,
      reopened: 0,
      resolved: 0,
      startedAt: now,
      updatedAt: now,
    });
    await scheduleCheckPage(ctx, checkId, 0);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "documentation_check_started",
      entityType: "documentationCheck",
      entityId: checkId,
      changes: { number, profiles: profiles.length },
    });
    return checkId;
  },
});

export const applyPage = internalMutation({
  args: {
    checkId: v.id("documentationChecks"),
    expectedCheckpoint: v.number(),
    pageSize: v.number(),
  },
  returns: v.union(v.literal("noop"), v.literal("continue"), v.literal("done")),
  handler: async (ctx, args) =>
    await applyCheckPage(
      ctx,
      args.checkId,
      args.expectedCheckpoint,
      args.pageSize,
    ),
});

export const markPageFailed = internalMutation({
  args: {
    checkId: v.id("documentationChecks"),
    expectedCheckpoint: v.number(),
    failure: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await markCheckPageFailed(
      ctx,
      args.checkId,
      args.expectedCheckpoint,
      args.failure,
    );
    return null;
  },
});

/** Runs one checkpoint page (see `runCheckpointPage`). */
export const advanceCheck = internalAction({
  args: {
    checkId: v.id("documentationChecks"),
    expectedCheckpoint: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runCheckpointPage({
      pageSize: CHECK_PAGE_SIZE,
      apply: (pageSize) =>
        ctx.runMutation(internal.documentationQuality.applyPage, {
          ...args,
          pageSize,
        }),
      fail: (failure) =>
        ctx.runMutation(internal.documentationQuality.markPageFailed, {
          ...args,
          failure,
        }),
    });
    return null;
  },
});

// ============================================
// FINDINGS
// ============================================

/** Findings in one status, oldest first, optionally of one kind. */
export const listFindings = query({
  args: {
    organizationId: v.id("organizations"),
    status: findingStatusValidator,
    kind: v.optional(findingKindValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(documentationFindingDocValidator),
  handler: async (ctx, args) => {
    await requireQualityAccess(ctx, args.organizationId);
    const kind = args.kind;
    return kind
      ? await ctx.db
          .query("documentationFindings")
          .withIndex("by_organization_and_status_and_kind", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status)
              .eq("kind", kind),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("documentationFindings")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status),
          )
          .paginate(args.paginationOpts);
  },
});

const MAX_REVIEW_NOTE_LENGTH = 2000;
/** Records of one duplicate identifier that one review may cover. */
const DUPLICATE_REVIEW_LIMIT = 100;

function reviewNote(value: string) {
  const note = value.trim();
  if (!note || note.length > MAX_REVIEW_NOTE_LENGTH)
    throw qualityError(
      "REVIEW_NOTE_REQUIRED",
      `Give a reason of 1-${MAX_REVIEW_NOTE_LENGTH} characters`,
    );
  return note;
}

async function loadFindingForReview(
  ctx: MutationCtx,
  findingId: Id<"documentationFindings">,
) {
  const finding = await ctx.db.get(findingId);
  if (!finding) throw qualityError("FINDING_NOT_FOUND", "Finding not found");
  const userId = await requireQualityAccess(ctx, finding.organizationId);
  return { finding, userId };
}

/**
 * A duplicate identifier is reviewed in the identifier register: every record
 * sharing it gets a conflict review, and nothing is renumbered.
 */
async function reviewDuplicateIdentifier(
  ctx: MutationCtx,
  finding: Extract<
    Doc<"documentationFindings">,
    { kind: "duplicate_identifier" }
  >,
  note: string,
  userId: Id<"users">,
) {
  const { needsBackfill } = await findIdentifierMatches(
    ctx,
    finding.organizationId,
    finding.register,
    finding.identifier,
  );
  if (needsBackfill)
    throw qualityError(
      "IDENTIFIER_INDEX_INCOMPLETE",
      "Complete the identifier index before reviewing duplicates",
    );
  const records = await identifierGroup(
    ctx,
    finding.organizationId,
    finding.register,
    finding.normalizedIdentifier,
    DUPLICATE_REVIEW_LIMIT + 1,
  );
  if (records.length > DUPLICATE_REVIEW_LIMIT)
    throw qualityError(
      "DUPLICATE_GROUP_TOO_LARGE",
      "Review these records in the identifier register",
    );
  for (const record of records)
    await recordIdentifierConflictReview(ctx, {
      organizationId: finding.organizationId,
      register: finding.register,
      record,
      note,
      userId,
    });
}

/**
 * Keeps an open finding as a reviewed exception, with the reason. The
 * record is not changed; the finding reopens if a later check finds
 * something different.
 */
export const acceptFinding = mutation({
  args: { findingId: v.id("documentationFindings"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { finding, userId } = await loadFindingForReview(
      ctx,
      args.findingId,
    );
    if (finding.status !== "open")
      throw qualityError(
        "FINDING_STATUS_CHANGED",
        "Only an open finding can be accepted",
      );
    const note = reviewNote(args.note);
    if (finding.kind === "duplicate_identifier")
      await reviewDuplicateIdentifier(ctx, finding, note, userId);
    await ctx.db.patch(finding._id, {
      status: "accepted",
      review: { note, reviewedBy: userId, reviewedAt: Date.now() },
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: finding.organizationId,
      userId,
      action: "documentation_finding_accepted",
      entityType: "documentationFinding",
      entityId: finding._id,
      changes: { kind: finding.kind, key: finding.key, note },
    });
    return null;
  },
});
