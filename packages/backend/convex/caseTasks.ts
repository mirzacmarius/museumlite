import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { resolveCase } from "./auditLog";
import {
  type CaseTaskCaseType,
  type CaseTaskEvidenceReference,
  type CaseTaskStatus,
  caseTaskCaseTypeValidator,
  caseTaskEvidenceReferenceValidator,
  caseTaskStatusValidator,
} from "./utils/caseTaskValidators";
import { CAPABILITY_MATRIX } from "./utils/capabilities";
import { findingLabel, findingObjectIds } from "./utils/documentationFindings";
import { hasFeatureAccess } from "./utils/featureGates";
import {
  memberPermissionNames,
  rolePermissionNames,
} from "./utils/memberPermissions";
import { mutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import type { NotificationEntityType } from "./utils/notificationTypes";
import {
  hasPermission,
  requireCapability,
  requirePermission,
} from "./utils/permissions";
import { workError } from "./utils/workErrors";

const MAX_TASKS_PER_CASE = 100;
const MAX_DEPENDENCIES = 10;
const MAX_EVIDENCE_PER_TASK = 20;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;
const UNDATED = Number.MAX_SAFE_INTEGER;
const AUDIT_READ_PERMISSION = "organization.view_analytics";

type CaseReadPermission = "loans.read" | "collections.read";
type CaseWorkPermission = "loans.update" | "collections.update";

interface CaseConfig {
  readPermission: CaseReadPermission;
  workPermission: CaseWorkPermission;
  feature?: "loans" | "exhibitions" | "conservation";
  /** Key that files task audit events under the case (see auditEvidence). */
  auditKey: string;
  /** Entity type used by notification links to open the case. */
  notificationEntityType: NotificationEntityType;
}

const CASE_CONFIG: Record<CaseTaskCaseType, CaseConfig> = {
  loan: {
    readPermission: "loans.read",
    workPermission: "loans.update",
    feature: "loans",
    auditKey: "loanId",
    notificationEntityType: "loan",
  },
  accession: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "accessionId",
    notificationEntityType: "accession",
  },
  deaccession: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "deaccessionId",
    notificationEntityType: "deaccession",
  },
  exhibition: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "exhibitions",
    auditKey: "exhibitionId",
    notificationEntityType: "exhibition",
  },
  conservation: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "conservation",
    auditKey: "conservationTreatmentId",
    notificationEntityType: "conservationTreatment",
  },
  documentationFinding: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "documentationFindingId",
    notificationEntityType: "documentationFinding",
  },
};

const evidenceKindValidator = v.union(
  v.literal("conditionAssessment"),
  v.literal("movement"),
  v.literal("media"),
  v.literal("auditEntry"),
);

const evidenceValidator = v.object({
  _id: v.id("caseTaskEvidence"),
  kind: evidenceKindValidator,
  /** Id of the cited record, so pickers can hide records already linked. */
  recordId: v.string(),
  /** False when the viewer may not read this kind of record. */
  visible: v.boolean(),
  label: v.optional(v.string()),
  objectId: v.optional(v.id("collections")),
  recordedAt: v.optional(v.number()),
  auditCaseId: v.optional(v.string()),
  linkedAt: v.number(),
  linkedByName: v.optional(v.string()),
});

const taskValidator = v.object({
  _id: v.id("caseTasks"),
  caseType: caseTaskCaseTypeValidator,
  caseId: v.string(),
  caseLabel: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  status: caseTaskStatusValidator,
  ownerId: v.id("users"),
  ownerName: v.optional(v.string()),
  reviewerId: v.optional(v.id("users")),
  reviewerName: v.optional(v.string()),
  /** True when the viewer is the reviewer who approves or returns it. */
  viewerIsReviewer: v.boolean(),
  /** True when the viewer holds the case's work permission. */
  viewerCanWork: v.boolean(),
  dueDate: v.optional(v.number()),
  dependsOn: v.array(
    v.object({
      _id: v.id("caseTasks"),
      title: v.string(),
      status: caseTaskStatusValidator,
    }),
  ),
  openDependencyCount: v.number(),
  blockedReason: v.optional(v.string()),
  reviewNote: v.optional(v.string()),
  completionNote: v.optional(v.string()),
  cancelReason: v.optional(v.string()),
  evidence: v.array(evidenceValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});

type CaseDoc =
  | Awaited<ReturnType<typeof resolveCase>>
  | Doc<"documentationFindings">;

function isFinding(entity: CaseDoc): entity is Doc<"documentationFindings"> {
  return "lastCheckNumber" in entity;
}

function caseLabelOf(entity: CaseDoc): string {
  if (isFinding(entity)) return findingLabel(entity);
  if ("loanNumber" in entity) return entity.loanNumber;
  if ("deaccessionNumber" in entity) return entity.deaccessionNumber;
  if ("accessionNumber" in entity) return entity.accessionNumber;
  return entity.title;
}

function displayName(user: Doc<"users"> | null) {
  return user?.name || user?.email || undefined;
}

function isOpenStatus(status: CaseTaskStatus) {
  return status !== "done" && status !== "cancelled";
}

function requiredText(value: string, maxLength: number, field: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength)
    throw workError("INVALID_INPUT", `${field} is required`);
  return trimmed;
}

function optionalText(value: string | undefined, field: string) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH)
    throw workError("INVALID_INPUT", `${field} is too long`);
  return trimmed || undefined;
}

function validDueDate(value: number | undefined) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0)
    throw workError("INVALID_INPUT", "Due date is invalid");
  return value;
}

async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * A documentation quality finding, for members with the documentation
 * quality capability.
 */
async function loadFindingCase(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseId: string,
) {
  await requireCapability(
    ctx,
    organizationId,
    "documentation_quality",
    CAPABILITY_MATRIX.documentation_quality.permissions,
  );
  const findingId = ctx.db.normalizeId("documentationFindings", caseId);
  const finding = findingId ? await ctx.db.get(findingId) : null;
  if (!finding || finding.organizationId !== organizationId)
    throw workError("CASE_NOT_FOUND", "Case not found in this organization");
  return finding;
}

/** Resolves the case for the caller, enforcing the case's read access. */
async function loadCase(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
  caseId: string,
): Promise<CaseDoc> {
  if (caseType === "documentationFinding")
    return await loadFindingCase(ctx, organizationId, caseId);
  try {
    return await resolveCase(ctx, {
      organizationId,
      caseType,
      entityId: caseId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Case not found")
      throw workError("CASE_NOT_FOUND", "Case not found in this organization");
    throw error;
  }
}

function canWorkWith(
  permissions: Set<string> | null,
  caseType: CaseTaskCaseType,
) {
  const config = CASE_CONFIG[caseType];
  return (
    !!permissions &&
    permissions.has(config.readPermission) &&
    permissions.has(config.workPermission)
  );
}

/** Owners and reviewers must be members who can work on this kind of case. */
async function requireEligible(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
  userId: Id<"users">,
  role: "owner" | "reviewer",
) {
  const permissions = await memberPermissionNames(ctx, organizationId, userId);
  if (canWorkWith(permissions, caseType)) return;
  throw role === "owner"
    ? workError(
        "ASSIGNEE_NOT_ELIGIBLE",
        "Owner must be a member who can work on this case",
      )
    : workError(
        "REVIEWER_NOT_ELIGIBLE",
        "Reviewer must be a member who can work on this case",
      );
}

async function canAccessCaseType(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
) {
  const config = CASE_CONFIG[caseType];
  if (config.feature) {
    const allowed = await hasFeatureAccess(ctx, organizationId, config.feature);
    if (!allowed) return false;
  }
  return await hasPermission(ctx, organizationId, config.readPermission);
}

async function readCaseLabel(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
  caseId: string,
) {
  const table = {
    loan: "loans",
    accession: "accessions",
    deaccession: "deaccessions",
    exhibition: "exhibitions",
    conservation: "conservationTreatments",
    documentationFinding: "documentationFindings",
  } as const;
  const id = ctx.db.normalizeId(table[caseType], caseId);
  const entity = id ? await ctx.db.get(id) : null;
  if (!entity || entity.organizationId !== organizationId) return null;
  return caseLabelOf(entity);
}

interface ViewerAccess {
  userId: Id<"users">;
  collectionsRead: boolean;
  mediaRead: boolean;
  auditRead: boolean;
}

async function viewerAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<ViewerAccess> {
  const [userId, collectionsRead, mediaRead, auditRead] = await Promise.all([
    requireUserId(ctx),
    hasPermission(ctx, organizationId, "collections.read"),
    hasPermission(ctx, organizationId, "media.read"),
    hasPermission(ctx, organizationId, AUDIT_READ_PERMISSION),
  ]);
  return {
    userId,
    collectionsRead,
    mediaRead: collectionsRead && mediaRead,
    auditRead,
  };
}

function canViewEvidence(
  access: ViewerAccess,
  kind: CaseTaskEvidenceReference["kind"],
) {
  if (kind === "auditEntry") return access.auditRead;
  if (kind === "media") return access.mediaRead;
  return access.collectionsRead;
}

async function presentTask(
  ctx: QueryCtx,
  task: Doc<"caseTasks">,
  caseLabel: string,
  access: ViewerAccess,
  viewerCanWork: boolean,
) {
  const [owner, reviewer, dependencies, evidenceRows] = await Promise.all([
    ctx.db.get(task.ownerId),
    task.reviewerId ? ctx.db.get(task.reviewerId) : null,
    Promise.all(task.dependsOnTaskIds.map((id) => ctx.db.get(id))),
    ctx.db
      .query("caseTaskEvidence")
      .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
      .take(MAX_EVIDENCE_PER_TASK),
  ]);
  const dependsOn = dependencies.flatMap((dependency) =>
    dependency && dependency.organizationId === task.organizationId
      ? [
          {
            _id: dependency._id,
            title: dependency.title,
            status: dependency.status,
          },
        ]
      : [],
  );
  const linkers = await Promise.all(
    evidenceRows.map((row) => ctx.db.get(row.linkedBy)),
  );
  return {
    _id: task._id,
    caseType: task.caseType,
    caseId: task.caseId,
    caseLabel,
    title: task.title,
    description: task.description,
    status: task.status,
    ownerId: task.ownerId,
    ownerName: displayName(owner),
    reviewerId: task.reviewerId,
    reviewerName: displayName(reviewer),
    viewerIsReviewer: task.reviewerId === access.userId,
    viewerCanWork,
    dueDate: task.dueDate,
    dependsOn,
    openDependencyCount: dependsOn.filter((row) => isOpenStatus(row.status))
      .length,
    blockedReason: task.blockedReason,
    reviewNote: task.reviewNote,
    completionNote: task.completionNote,
    cancelReason: task.cancelReason,
    evidence: evidenceRows.map((row, index) => {
      const visible = canViewEvidence(access, row.reference.kind);
      return {
        _id: row._id,
        kind: row.reference.kind,
        recordId: row.reference.id,
        visible,
        label: visible ? row.label : undefined,
        objectId: visible ? row.objectId : undefined,
        recordedAt: row.recordedAt,
        auditCaseId: visible ? row.auditCaseId : undefined,
        linkedAt: row.linkedAt,
        linkedByName: displayName(linkers[index] ?? null),
      };
    }),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };
}

async function logTaskEvent(
  ctx: MutationCtx,
  task: Pick<
    Doc<"caseTasks">,
    "organizationId" | "caseType" | "caseId" | "title"
  >,
  taskId: Id<"caseTasks">,
  userId: Id<"users">,
  action: string,
  details: Record<string, unknown> = {},
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: task.organizationId,
    userId,
    action,
    entityType: "caseTask",
    entityId: taskId,
    changes: {
      [CASE_CONFIG[task.caseType].auditKey]: task.caseId,
      caseType: task.caseType,
      title: task.title,
      ...details,
    },
  });
}

async function notifyTaskUser(
  ctx: MutationCtx,
  args: {
    task: Pick<
      Doc<"caseTasks">,
      "organizationId" | "caseType" | "caseId" | "title" | "dueDate"
    >;
    recipientId: Id<"users">;
    actorId: Id<"users">;
    type:
      | "task_assigned"
      | "task_review_requested"
      | "task_completed"
      | "task_returned";
    title: string;
    message: string;
  },
) {
  if (args.recipientId === args.actorId) return;
  const config = CASE_CONFIG[args.task.caseType];
  const actor = await ctx.db.get(args.actorId);
  await dispatchNotification(ctx, {
    organizationId: args.task.organizationId,
    type: args.type,
    recipients: [args.recipientId],
    title: args.title,
    message: args.message,
    related: {
      entityType: config.notificationEntityType,
      entityId: args.task.caseId,
    },
    email:
      args.type === "task_assigned"
        ? {
            kind: "taskAssigned",
            taskTitle: args.task.title,
            assignedBy: displayName(actor) ?? "A team member",
            dueDate: args.task.dueDate,
          }
        : undefined,
  });
}

// ============================================
// QUERIES
// ============================================

const caseArgs = {
  organizationId: v.id("organizations"),
  caseType: caseTaskCaseTypeValidator,
  caseId: v.string(),
};

export const listForCase = query({
  args: caseArgs,
  returns: v.object({
    canManage: v.boolean(),
    tasks: v.array(taskValidator),
  }),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const entity = await loadCase(
      ctx,
      args.organizationId,
      args.caseType,
      args.caseId,
    );
    const [canManage, access, tasks] = await Promise.all([
      hasPermission(
        ctx,
        args.organizationId,
        CASE_CONFIG[args.caseType].workPermission,
      ),
      viewerAccess(ctx, args.organizationId),
      ctx.db
        .query("caseTasks")
        .withIndex("by_organization_and_caseType_and_caseId", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("caseType", args.caseType)
            .eq("caseId", args.caseId),
        )
        .take(MAX_TASKS_PER_CASE),
    ]);
    const caseLabel = caseLabelOf(entity);
    return {
      canManage,
      tasks: await Promise.all(
        tasks.map((task) =>
          presentTask(ctx, task, caseLabel, access, canManage),
        ),
      ),
    };
  },
});

const MAX_PAGE_SIZE = 50;

async function requireMembership(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();
  if (!membership) throw new Error("Permission denied: not a member");
  return userId;
}

function requirePageSize(numItems: number) {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > MAX_PAGE_SIZE)
    throw workError("INVALID_INPUT", "Page size must be between 1 and 50");
}

/** Presents a page of queue rows, hiding tasks on cases the viewer cannot open. */
async function presentQueuePage(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  rows: Doc<"caseTasks">[],
) {
  const access = await viewerAccess(ctx, organizationId);
  const caseTypeAccess = new Map<
    CaseTaskCaseType,
    Promise<{ read: boolean; work: boolean }>
  >();
  const accessFor = (caseType: CaseTaskCaseType) => {
    let cached = caseTypeAccess.get(caseType);
    if (!cached) {
      cached = Promise.all([
        canAccessCaseType(ctx, organizationId, caseType),
        hasPermission(
          ctx,
          organizationId,
          CASE_CONFIG[caseType].workPermission,
        ),
      ]).then(([read, work]) => ({ read, work }));
      caseTypeAccess.set(caseType, cached);
    }
    return cached;
  };
  const presented = await Promise.all(
    rows.map(async (task) => {
      const allowed = await accessFor(task.caseType);
      if (!allowed.read) return null;
      const caseLabel = await readCaseLabel(
        ctx,
        organizationId,
        task.caseType,
        task.caseId,
      );
      return caseLabel === null
        ? null
        : await presentTask(ctx, task, caseLabel, access, allowed.work);
    }),
  );
  return presented.flatMap((task) => (task ? [task] : []));
}

const queueArgs = {
  organizationId: v.id("organizations"),
  paginationOpts: paginationOptsValidator,
};

/** Open tasks the caller owns, soonest due first. */
export const listMyWork = query({
  args: queueArgs,
  returns: paginationResultValidator(taskValidator),
  handler: async (ctx, args) => {
    const userId = await requireMembership(ctx, args.organizationId);
    requirePageSize(args.paginationOpts.numItems);
    const result = await ctx.db
      .query("caseTasks")
      .withIndex("by_organization_and_ownerId_and_open_and_queueDueAt", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("ownerId", userId)
          .eq("open", true),
      )
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await presentQueuePage(ctx, args.organizationId, result.page),
    };
  },
});

/** Tasks waiting for the caller's review, soonest due first. */
export const listReviewQueue = query({
  args: queueArgs,
  returns: paginationResultValidator(taskValidator),
  handler: async (ctx, args) => {
    const userId = await requireMembership(ctx, args.organizationId);
    requirePageSize(args.paginationOpts.numItems);
    const result = await ctx.db
      .query("caseTasks")
      .withIndex(
        "by_organization_and_reviewerId_and_status_and_queueDueAt",
        (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("reviewerId", userId)
            .eq("status", "in_review"),
      )
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await presentQueuePage(ctx, args.organizationId, result.page),
    };
  },
});

const ASSIGNED_CASE_SCAN = 100;
const ASSIGNED_CASE_LIMIT = 50;

/** Open accessions, deaccessions and loans assigned to the caller. */
export const listMyAssignedCases = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    cases: v.array(
      v.object({
        caseType: v.union(
          v.literal("loan"),
          v.literal("accession"),
          v.literal("deaccession"),
        ),
        caseId: v.string(),
        caseLabel: v.string(),
        status: v.string(),
        since: v.number(),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireMembership(ctx, args.organizationId);
    const [accessionAccess, deaccessionAccess, loanAccess] = await Promise.all([
      canAccessCaseType(ctx, args.organizationId, "accession"),
      canAccessCaseType(ctx, args.organizationId, "deaccession"),
      canAccessCaseType(ctx, args.organizationId, "loan"),
    ]);
    const [accessions, deaccessions, loans] = await Promise.all([
      accessionAccess
        ? ctx.db
            .query("accessions")
            .withIndex("by_assigned_to", (q) => q.eq("assignedTo", userId))
            .take(ASSIGNED_CASE_SCAN)
        : [],
      deaccessionAccess
        ? ctx.db
            .query("deaccessions")
            .withIndex("by_assigned_to", (q) => q.eq("assignedTo", userId))
            .take(ASSIGNED_CASE_SCAN)
        : [],
      loanAccess
        ? ctx.db
            .query("loans")
            .withIndex("by_assigned_to", (q) => q.eq("assignedTo", userId))
            .take(ASSIGNED_CASE_SCAN)
        : [],
    ]);
    const here = (row: { organizationId: Id<"organizations"> }) =>
      row.organizationId === args.organizationId;
    const cases = [
      ...accessions.flatMap((row) =>
        here(row) && row.status === "pending"
          ? [
              {
                caseType: "accession" as const,
                caseId: row._id,
                caseLabel: row.accessionNumber,
                status: row.status,
                since: row.dateReceived,
              },
            ]
          : [],
      ),
      ...deaccessions.flatMap((row) =>
        here(row) && row.status === "pending"
          ? [
              {
                caseType: "deaccession" as const,
                caseId: row._id,
                caseLabel: row.deaccessionNumber,
                status: row.status,
                since: row.dateDeaccessioned,
              },
            ]
          : [],
      ),
      ...loans.flatMap((row) =>
        here(row) &&
        (row.status === "pending" ||
          row.status === "active" ||
          row.status === "dispatched")
          ? [
              {
                caseType: "loan" as const,
                caseId: row._id,
                caseLabel: row.loanNumber,
                status: row.status,
                since: row.startDate,
              },
            ]
          : [],
      ),
    ].sort((a, b) => a.since - b.since);
    const scanFull = [accessions, deaccessions, loans].some(
      (rows) => rows.length === ASSIGNED_CASE_SCAN,
    );
    return {
      cases: cases.slice(0, ASSIGNED_CASE_LIMIT),
      truncated: scanFull || cases.length > ASSIGNED_CASE_LIMIT,
    };
  },
});

const MEMBER_SCAN = 200;

/** Members who may own or review tasks on this case. */
export const listAssignableMembers = query({
  args: caseArgs,
  returns: v.array(v.object({ userId: v.id("users"), name: v.string() })),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    await loadCase(ctx, args.organizationId, args.caseType, args.caseId);
    await requirePermission(
      ctx,
      args.organizationId,
      CASE_CONFIG[args.caseType].workPermission,
    );
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(MEMBER_SCAN);
    const rolePermissions = new Map<Id<"roles">, Promise<Set<string> | null>>();
    const eligible = await Promise.all(
      memberships.map(async (membership) => {
        let permissions = rolePermissions.get(membership.roleId);
        if (!permissions) {
          permissions = rolePermissionNames(ctx, membership.roleId);
          rolePermissions.set(membership.roleId, permissions);
        }
        if (!canWorkWith(await permissions, args.caseType)) return null;
        const user = await ctx.db.get(membership.userId);
        const name = displayName(user);
        return name ? { userId: membership.userId, name } : null;
      }),
    );
    return eligible
      .flatMap((member) => (member ? [member] : []))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

const CASE_OBJECT_LIMIT = 20;
const EVIDENCE_PER_OBJECT = 5;
const AUDIT_CANDIDATES = 15;

async function caseObjectIds(
  ctx: QueryCtx,
  caseType: CaseTaskCaseType,
  caseId: string,
  entity: CaseDoc,
) {
  const loanId =
    caseType === "loan" ? ctx.db.normalizeId("loans", caseId) : null;
  if (loanId) {
    const items = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .take(CASE_OBJECT_LIMIT);
    return items.map((item) => item.collectionId);
  }
  const exhibitionId =
    caseType === "exhibition"
      ? ctx.db.normalizeId("exhibitions", caseId)
      : null;
  if (exhibitionId) {
    const members = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) => q.eq("exhibitionId", exhibitionId))
      .take(CASE_OBJECT_LIMIT);
    return members.map((member) => member.collectionId);
  }
  if (isFinding(entity))
    return findingObjectIds(entity).flatMap((id) => {
      const objectId = ctx.db.normalizeId("collections", id);
      return objectId ? [objectId] : [];
    });
  return "collectionId" in entity && entity.collectionId
    ? [entity.collectionId]
    : [];
}

interface EvidenceCandidate {
  reference: CaseTaskEvidenceReference;
  label: string;
  objectId?: Id<"collections">;
  recordedAt?: number;
}

/** Recent accepted assessments, moves and files of one object in the caller's organization. */
async function objectEvidenceCandidates(
  ctx: QueryCtx,
  object: Doc<"collections">,
  includeMedia: boolean,
): Promise<EvidenceCandidate[]> {
  const { db } = ctx;
  const [assessments, movements, media] = await Promise.all([
    db
      .query("conditionAssessments")
      .withIndex("by_collection_and_status_and_acceptedAt", (q) =>
        q.eq("collectionId", object._id).eq("status", "accepted"),
      )
      .order("desc")
      .take(EVIDENCE_PER_OBJECT),
    db
      .query("locationHistory")
      .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
      .order("desc")
      .take(EVIDENCE_PER_OBJECT),
    includeMedia
      ? db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
          .order("desc")
          .take(EVIDENCE_PER_OBJECT)
      : [],
  ]);
  const locationIds = [
    ...new Set(
      movements.flatMap((row) =>
        [row.fromLocationId, row.toLocationId].flatMap((id) =>
          id ? [id] : [],
        ),
      ),
    ),
  ];
  const locations = new Map(
    (await Promise.all(locationIds.map((id) => db.get(id)))).flatMap(
      (location) => (location ? [[location._id, location.name]] : []),
    ),
  );
  const locationName = (id: Id<"locations"> | undefined) =>
    (id && locations.get(id)) || "-";
  return [
    ...assessments.map((row) => ({
      reference: { kind: "conditionAssessment" as const, id: row._id },
      label: clip(`${object.title} - ${row.condition}: ${row.summary}`),
      objectId: object._id,
      recordedAt: row.assessedAt,
    })),
    ...movements.map((row) => ({
      reference: { kind: "movement" as const, id: row._id },
      label: clip(
        `${object.title}: ${locationName(row.fromLocationId)} -> ${locationName(row.toLocationId)}`,
      ),
      objectId: object._id,
      recordedAt: row.movedAt,
    })),
    ...media.flatMap((row) =>
      row.organizationId === object.organizationId
        ? [
            {
              reference: { kind: "media" as const, id: row._id },
              label: clip(`${object.title} - ${row.fileName}`),
              objectId: object._id,
              recordedAt: row.uploadedAt,
            },
          ]
        : [],
    ),
  ];
}

/** Recent accepted assessments, moves and files for the case's objects, and its audit events. */
export const listEvidenceCandidates = query({
  args: caseArgs,
  returns: v.array(
    v.object({
      reference: caseTaskEvidenceReferenceValidator,
      label: v.string(),
      objectId: v.optional(v.id("collections")),
      recordedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const entity = await loadCase(
      ctx,
      args.organizationId,
      args.caseType,
      args.caseId,
    );
    const access = await viewerAccess(ctx, args.organizationId);
    const candidates: EvidenceCandidate[] = [];
    if (access.collectionsRead) {
      const objectIds = [
        ...new Set(
          await caseObjectIds(ctx, args.caseType, args.caseId, entity),
        ),
      ];
      const objects = await Promise.all(objectIds.map((id) => ctx.db.get(id)));
      const perObject = await Promise.all(
        objects.map((object) =>
          object && object.organizationId === args.organizationId
            ? objectEvidenceCandidates(ctx, object, access.mediaRead)
            : [],
        ),
      );
      candidates.push(...perObject.flat());
    }
    if (access.auditRead) {
      const caseKind =
        args.caseType === "conservation"
          ? "conservationTreatment"
          : args.caseType;
      const entries = await ctx.db
        .query("auditLog")
        .withIndex("by_organization_and_caseId_and_timestamp", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("caseId", `${caseKind}:${args.caseId}`),
        )
        .order("desc")
        .take(AUDIT_CANDIDATES);
      for (const row of entries)
        candidates.push({
          reference: { kind: "auditEntry", id: row._id },
          label: clip(
            `${row.action}: ${row.subjectSnapshot?.label ?? row.subjectSnapshot?.identifier ?? row.entityType}`,
          ),
          objectId: row.objectId,
          recordedAt: row.timestamp,
        });
    }
    return candidates;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    ...caseArgs,
    title: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    reviewerId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    dependsOnTaskIds: v.optional(v.array(v.id("caseTasks"))),
  },
  returns: v.id("caseTasks"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await loadCase(ctx, args.organizationId, args.caseType, args.caseId);
    await requirePermission(
      ctx,
      args.organizationId,
      CASE_CONFIG[args.caseType].workPermission,
    );
    const title = requiredText(args.title, MAX_TITLE_LENGTH, "Title");
    const description = optionalText(args.description, "Description");
    const dueDate = validDueDate(args.dueDate);
    await requireEligible(
      ctx,
      args.organizationId,
      args.caseType,
      args.ownerId,
      "owner",
    );
    if (args.reviewerId !== undefined) {
      if (args.reviewerId === args.ownerId)
        throw workError(
          "REVIEWER_NOT_ELIGIBLE",
          "Reviewer must be someone other than the owner",
        );
      await requireEligible(
        ctx,
        args.organizationId,
        args.caseType,
        args.reviewerId,
        "reviewer",
      );
    }

    const dependencyIds = [...new Set(args.dependsOnTaskIds ?? [])];
    if (dependencyIds.length > MAX_DEPENDENCIES)
      throw workError("LIMIT_REACHED", "Too many dependencies");
    const dependencies = await Promise.all(
      dependencyIds.map((id) => ctx.db.get(id)),
    );
    for (const dependency of dependencies) {
      if (
        !dependency ||
        dependency.organizationId !== args.organizationId ||
        dependency.caseType !== args.caseType ||
        dependency.caseId !== args.caseId
      )
        throw workError(
          "DEPENDENCY_INVALID",
          "Dependencies must be tasks on the same case",
        );
    }

    const existing = await ctx.db
      .query("caseTasks")
      .withIndex("by_organization_and_caseType_and_caseId", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("caseType", args.caseType)
          .eq("caseId", args.caseId),
      )
      .take(MAX_TASKS_PER_CASE);
    if (existing.length >= MAX_TASKS_PER_CASE)
      throw workError("LIMIT_REACHED", "This case has too many tasks");

    const now = Date.now();
    const task = {
      organizationId: args.organizationId,
      caseType: args.caseType,
      caseId: args.caseId,
      title,
      description,
      ownerId: args.ownerId,
      reviewerId: args.reviewerId,
      dueDate,
      queueDueAt: dueDate ?? UNDATED,
      status: "todo" as const,
      open: true,
      dependsOnTaskIds: dependencyIds,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    const taskId = await ctx.db.insert("caseTasks", task);
    await logTaskEvent(ctx, task, taskId, userId, "task_created", {
      ownerId: args.ownerId,
      reviewerId: args.reviewerId,
      dueDate,
      dependsOnTaskIds: dependencyIds,
    });
    await notifyTaskUser(ctx, {
      task,
      recipientId: args.ownerId,
      actorId: userId,
      type: "task_assigned",
      title: "Task Assigned",
      message: `You have been assigned to: ${title}`,
    });
    return taskId;
  },
});

async function loadTaskForWork(ctx: MutationCtx, taskId: Id<"caseTasks">) {
  const userId = await requireUserId(ctx);
  const task = await ctx.db.get(taskId);
  const membership = task
    ? await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", task.organizationId),
        )
        .first()
    : null;
  if (!task || !membership) throw workError("TASK_NOT_FOUND", "Task not found");
  await loadCase(ctx, task.organizationId, task.caseType, task.caseId);
  await requirePermission(
    ctx,
    task.organizationId,
    CASE_CONFIG[task.caseType].workPermission,
  );
  return { userId, task };
}

function requireStatus(task: Doc<"caseTasks">, allowed: CaseTaskStatus[]) {
  if (!allowed.includes(task.status))
    throw workError("STATUS_CHANGED", `Task is ${task.status}`);
}

async function requireDependenciesClosed(
  ctx: QueryCtx,
  task: Doc<"caseTasks">,
) {
  const dependencies = await Promise.all(
    task.dependsOnTaskIds.map((id) => ctx.db.get(id)),
  );
  const openCount = dependencies.filter(
    (dependency) => dependency && isOpenStatus(dependency.status),
  ).length;
  if (openCount > 0)
    throw workError(
      "DEPENDENCIES_OPEN",
      "Finish the tasks this task depends on first",
      { openCount },
    );
}

function requireReviewer(task: Doc<"caseTasks">, userId: Id<"users">) {
  if (task.reviewerId !== userId)
    throw workError("REVIEWER_ONLY", "Only the task reviewer can do this");
}

async function applyTransition(
  ctx: MutationCtx,
  task: Doc<"caseTasks">,
  userId: Id<"users">,
  action: string,
  patch: Partial<Omit<Doc<"caseTasks">, "_id" | "_creationTime">> & {
    status: CaseTaskStatus;
  },
  details: Record<string, unknown> = {},
) {
  await ctx.db.patch(task._id, {
    ...patch,
    open: isOpenStatus(patch.status),
    updatedAt: Date.now(),
  });
  await logTaskEvent(ctx, task, task._id, userId, action, {
    from: task.status,
    to: patch.status,
    ...details,
  });
}

const taskIdArgs = { taskId: v.id("caseTasks") };

export const start = mutation({
  args: taskIdArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    if (task.status === "in_progress") return null;
    requireStatus(task, ["todo"]);
    await requireDependenciesClosed(ctx, task);
    await applyTransition(ctx, task, userId, "task_started", {
      status: "in_progress",
      startedAt: task.startedAt ?? Date.now(),
    });
    return null;
  },
});

export const block = mutation({
  args: { ...taskIdArgs, reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    const reason = requiredText(args.reason, MAX_TEXT_LENGTH, "Reason");
    if (task.status === "blocked" && task.blockedReason === reason) return null;
    requireStatus(task, ["todo", "in_progress"]);
    await applyTransition(
      ctx,
      task,
      userId,
      "task_blocked",
      { status: "blocked", blockedReason: reason },
      { reason },
    );
    return null;
  },
});

export const unblock = mutation({
  args: taskIdArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    requireStatus(task, ["blocked"]);
    await applyTransition(ctx, task, userId, "task_unblocked", {
      status: task.startedAt === undefined ? "todo" : "in_progress",
      blockedReason: undefined,
    });
    return null;
  },
});

export const submitForReview = mutation({
  args: { ...taskIdArgs, note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    if (task.status === "in_review") return null;
    requireStatus(task, ["todo", "in_progress"]);
    if (!task.reviewerId)
      throw workError("INVALID_INPUT", "Assign a reviewer first");
    const note = optionalText(args.note, "Note");
    await requireDependenciesClosed(ctx, task);
    const now = Date.now();
    await applyTransition(
      ctx,
      task,
      userId,
      "task_submitted_for_review",
      {
        status: "in_review",
        submittedAt: now,
        startedAt: task.startedAt ?? now,
        completionNote: note,
      },
      { note },
    );
    await notifyTaskUser(ctx, {
      task,
      recipientId: task.reviewerId,
      actorId: userId,
      type: "task_review_requested",
      title: "Task Ready for Review",
      message: `Task "${task.title}" is ready for your review`,
    });
    return null;
  },
});

export const approve = mutation({
  args: { ...taskIdArgs, note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    requireReviewer(task, userId);
    if (task.status === "done") return null;
    requireStatus(task, ["in_review"]);
    const note = optionalText(args.note, "Note");
    const now = Date.now();
    await applyTransition(
      ctx,
      task,
      userId,
      "task_approved",
      {
        status: "done",
        reviewNote: note,
        completedAt: now,
        completedBy: userId,
      },
      { note },
    );
    await notifyTaskUser(ctx, {
      task,
      recipientId: task.ownerId,
      actorId: userId,
      type: "task_completed",
      title: "Task Approved",
      message: `Task "${task.title}" was approved`,
    });
    return null;
  },
});

export const returnForChanges = mutation({
  args: { ...taskIdArgs, note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    requireStatus(task, ["in_review"]);
    requireReviewer(task, userId);
    const note = requiredText(args.note, MAX_TEXT_LENGTH, "Note");
    await applyTransition(
      ctx,
      task,
      userId,
      "task_returned",
      { status: "in_progress", reviewNote: note },
      { note },
    );
    await notifyTaskUser(ctx, {
      task,
      recipientId: task.ownerId,
      actorId: userId,
      type: "task_returned",
      title: "Task Returned",
      message: `Task "${task.title}" was returned for changes`,
    });
    return null;
  },
});

export const complete = mutation({
  args: { ...taskIdArgs, note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    if (task.status === "done") return null;
    requireStatus(task, ["todo", "in_progress"]);
    if (task.reviewerId)
      throw workError(
        "REVIEW_REQUIRED",
        "This task must be approved by its reviewer",
      );
    const note = optionalText(args.note, "Note");
    await requireDependenciesClosed(ctx, task);
    const now = Date.now();
    await applyTransition(
      ctx,
      task,
      userId,
      "task_completed",
      {
        status: "done",
        completionNote: note,
        startedAt: task.startedAt ?? now,
        completedAt: now,
        completedBy: userId,
      },
      { note },
    );
    return null;
  },
});

export const cancel = mutation({
  args: { ...taskIdArgs, reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    if (task.status === "cancelled") return null;
    requireStatus(task, ["todo", "in_progress", "blocked", "in_review"]);
    const reason = requiredText(args.reason, MAX_TEXT_LENGTH, "Reason");
    await applyTransition(
      ctx,
      task,
      userId,
      "task_cancelled",
      { status: "cancelled", cancelReason: reason },
      { reason },
    );
    return null;
  },
});

export const assign = mutation({
  args: {
    ...taskIdArgs,
    ownerId: v.id("users"),
    reviewerId: v.union(v.id("users"), v.null()),
    dueDate: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    requireStatus(task, ["todo", "in_progress", "blocked", "in_review"]);
    const reviewerId = args.reviewerId ?? undefined;
    const dueDate = validDueDate(args.dueDate ?? undefined);
    await requireEligible(
      ctx,
      task.organizationId,
      task.caseType,
      args.ownerId,
      "owner",
    );
    if (reviewerId !== undefined) {
      if (reviewerId === args.ownerId)
        throw workError(
          "REVIEWER_NOT_ELIGIBLE",
          "Reviewer must be someone other than the owner",
        );
      await requireEligible(
        ctx,
        task.organizationId,
        task.caseType,
        reviewerId,
        "reviewer",
      );
    } else if (task.status === "in_review") {
      throw workError("INVALID_INPUT", "A task under review needs a reviewer");
    }
    await ctx.db.patch(task._id, {
      ownerId: args.ownerId,
      reviewerId,
      dueDate,
      queueDueAt: dueDate ?? UNDATED,
      updatedAt: Date.now(),
    });
    await logTaskEvent(ctx, task, task._id, userId, "task_assigned", {
      from: {
        ownerId: task.ownerId,
        reviewerId: task.reviewerId,
        dueDate: task.dueDate,
      },
      to: { ownerId: args.ownerId, reviewerId, dueDate },
    });
    const updated = { ...task, dueDate };
    if (args.ownerId !== task.ownerId)
      await notifyTaskUser(ctx, {
        task: updated,
        recipientId: args.ownerId,
        actorId: userId,
        type: "task_assigned",
        title: "Task Assigned",
        message: `You have been assigned to: ${task.title}`,
      });
    if (
      reviewerId !== undefined &&
      reviewerId !== task.reviewerId &&
      task.status === "in_review"
    )
      await notifyTaskUser(ctx, {
        task: updated,
        recipientId: reviewerId,
        actorId: userId,
        type: "task_review_requested",
        title: "Task Ready for Review",
        message: `Task "${task.title}" is ready for your review`,
      });
    return null;
  },
});

// ============================================
// EVIDENCE LINKS
// ============================================

function clip(value: string) {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

/** Validates a cited record's tenant and the caller's access to it. */
async function resolveEvidence(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  reference: CaseTaskEvidenceReference,
) {
  const notFound = () =>
    workError("EVIDENCE_NOT_FOUND", "Evidence record not found");
  switch (reference.kind) {
    case "conditionAssessment": {
      await requirePermission(ctx, organizationId, "collections.read");
      const row = await ctx.db.get(reference.id);
      if (
        !row ||
        row.organizationId !== organizationId ||
        row.status !== "accepted"
      )
        throw notFound();
      return {
        label: clip(`${row.condition}: ${row.summary}`),
        objectId: row.collectionId,
        recordedAt: row.assessedAt,
      };
    }
    case "movement": {
      await requirePermission(ctx, organizationId, "collections.read");
      const row = await ctx.db.get(reference.id);
      const object = row ? await ctx.db.get(row.collectionId) : null;
      if (!row || !object || object.organizationId !== organizationId)
        throw notFound();
      const [from, to] = await Promise.all([
        row.fromLocationId ? ctx.db.get(row.fromLocationId) : null,
        row.toLocationId ? ctx.db.get(row.toLocationId) : null,
      ]);
      return {
        label: clip(
          `${object.title}: ${from?.name ?? "-"} -> ${to?.name ?? "-"}`,
        ),
        objectId: object._id,
        recordedAt: row.movedAt,
      };
    }
    case "media": {
      await Promise.all([
        requirePermission(ctx, organizationId, "collections.read"),
        requirePermission(ctx, organizationId, "media.read"),
      ]);
      const row = await ctx.db.get(reference.id);
      if (!row || row.organizationId !== organizationId) throw notFound();
      return {
        label: clip(row.fileName),
        objectId: row.collectionId,
        recordedAt: row.uploadedAt,
      };
    }
    case "auditEntry": {
      await requirePermission(ctx, organizationId, AUDIT_READ_PERMISSION);
      const row = await ctx.db.get(reference.id);
      if (!row || row.organizationId !== organizationId) throw notFound();
      const subject =
        row.subjectSnapshot?.label ??
        row.subjectSnapshot?.identifier ??
        row.entityType;
      return {
        label: clip(`${row.action}: ${subject}`),
        objectId: row.objectId,
        recordedAt: row.timestamp,
        auditCaseId: row.caseId,
      };
    }
  }
}

export const linkEvidence = mutation({
  args: { ...taskIdArgs, reference: caseTaskEvidenceReferenceValidator },
  returns: v.id("caseTaskEvidence"),
  handler: async (ctx, args) => {
    const { userId, task } = await loadTaskForWork(ctx, args.taskId);
    requireStatus(task, ["todo", "in_progress", "blocked", "in_review"]);
    const existing = await ctx.db
      .query("caseTaskEvidence")
      .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
      .take(MAX_EVIDENCE_PER_TASK);
    const duplicate = existing.find(
      (row) =>
        row.reference.kind === args.reference.kind &&
        row.reference.id === args.reference.id,
    );
    if (duplicate) return duplicate._id;
    if (existing.length >= MAX_EVIDENCE_PER_TASK)
      throw workError("LIMIT_REACHED", "This task has too many evidence links");
    const evidence = await resolveEvidence(
      ctx,
      task.organizationId,
      args.reference,
    );
    const now = Date.now();
    const evidenceId = await ctx.db.insert("caseTaskEvidence", {
      organizationId: task.organizationId,
      taskId: task._id,
      reference: args.reference,
      ...evidence,
      linkedBy: userId,
      linkedAt: now,
    });
    await ctx.db.patch(task._id, { updatedAt: now });
    await logTaskEvent(ctx, task, task._id, userId, "task_evidence_linked", {
      evidenceKind: args.reference.kind,
      evidenceId: args.reference.id,
      objectId: evidence.objectId,
    });
    return evidenceId;
  },
});
