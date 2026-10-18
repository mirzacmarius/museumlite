import { getAuthUserId } from "@convex-dev/auth/server";
import {
  type IndexRange,
  type PaginationOptions,
  paginationOptsValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalQuery, query } from "./_generated/server";
import { auditLogChanges } from "./schema";
import { loadCase } from "./utils/caseTaskRules";
import {
  CASE_TYPES,
  caseReadPermissions,
  caseTypeOfEntity,
} from "./utils/caseTypes";
import {
  requireFeatureAccess,
  requireModuleEnabled,
} from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";
import { workError } from "./utils/workErrors";

/** Max recent audit rows scanned for filter dropdown options. */
const DROPDOWN_SCAN_CAP = 1000;

const ENTITY_TYPES = [
  "collection",
  "loan",
  "accession",
  "deaccession",
  "location",
  "media",
  "user",
  "organization",
  "collectionGroup",
  "exhibition",
  "conservation",
  "conservationTreatment",
  "conditionAssessment",
  "conditionOption",
  "libraryAcquisitionRequest",
  "transitRecord",
  "organizationMoveRequest",
] as const;

export const auditEntryValidator = v.object({
  _id: v.id("auditLog"),
  action: v.string(),
  entityType: v.string(),
  entityId: v.string(),
  timestamp: v.number(),
  userId: v.id("users"),
  userName: v.optional(v.string()),
  userEmail: v.optional(v.string()),
  userImage: v.optional(v.string()),
  /** Legacy entries only: the actor's profile name today, never contemporaneous evidence. */
  currentActorName: v.optional(v.string()),
  changes: v.optional(auditLogChanges),
  actorSnapshot: v.optional(
    v.object({ name: v.optional(v.string()), email: v.optional(v.string()) }),
  ),
  subjectSnapshot: v.optional(
    v.object({
      label: v.optional(v.string()),
      identifier: v.optional(v.string()),
    }),
  ),
  evidenceStatus: v.union(v.literal("recorded"), v.literal("legacy")),
  objectId: v.optional(v.id("collections")),
  caseId: v.optional(v.string()),
  correctionOf: v.optional(v.id("auditLog")),
  correctionReason: v.optional(v.string()),
});

export const historyFilterArgs = {
  organizationId: v.id("organizations"),
  userId: v.optional(v.id("users")),
  entityType: v.optional(v.string()),
  entityId: v.optional(v.string()),
  action: v.optional(v.string()),
  actionMatch: v.optional(v.union(v.literal("exact"), v.literal("contains"))),
  fromDate: v.optional(v.number()),
  toDate: v.optional(v.number()),
  objectId: v.optional(v.id("collections")),
  caseId: v.optional(v.string()),
  asOf: v.optional(v.number()),
};
export const historyPageValidator = v.object({
  entries: v.array(auditEntryValidator),
  nextCursor: v.optional(v.string()),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
  isDone: v.boolean(),
  totalCount: v.number(),
  countKind: v.literal("page"),
});

function profileName(user: Doc<"users"> | null) {
  return user?.name || user?.username || user?.email || undefined;
}

/** Resolves today's profile name once per actor for legacy rows lacking recorded evidence. */
export async function currentProfileNames(
  ctx: QueryCtx,
  userIds: Iterable<Id<"users">>,
) {
  const ids = [...new Set(userIds)];
  const users = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return new Map(ids.map((id, i) => [id, profileName(users[i] ?? null)]));
}

export function presentEntry(
  entry: Doc<"auditLog">,
  currentActorName?: string,
) {
  // Legacy events have no contemporaneous evidence: today's profile is exposed
  // only as `currentActorName`, never as the snapshot `userName`/`userEmail`.
  return {
    _id: entry._id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    timestamp: entry.timestamp,
    userId: entry.userId,
    changes: entry.changes,
    userName: entry.actorSnapshot?.name,
    userEmail: entry.actorSnapshot?.email,
    currentActorName: entry.actorSnapshot ? undefined : currentActorName,
    actorSnapshot: entry.actorSnapshot,
    subjectSnapshot: entry.subjectSnapshot,
    evidenceStatus: entry.actorSnapshot
      ? ("recorded" as const)
      : ("legacy" as const),
    objectId: entry.objectId,
    caseId: entry.caseId,
    correctionOf: entry.correctionOf,
    correctionReason: entry.correctionReason,
  };
}

async function presentEntries(
  ctx: QueryCtx,
  entries: Doc<"auditLog">[],
  resolveCurrentActor: boolean,
) {
  const names = resolveCurrentActor
    ? await currentProfileNames(
        ctx,
        entries.flatMap((e) => (e.actorSnapshot ? [] : [e.userId])),
      )
    : new Map<Id<"users">, string | undefined>();
  return entries.map((entry) => presentEntry(entry, names.get(entry.userId)));
}

interface HistoryFilters {
  organizationId: Id<"organizations">;
  userId?: Id<"users">;
  entityType?: string;
  entityId?: string;
  action?: string;
  actionMatch?: "exact" | "contains";
  fromDate?: number;
  toDate?: number;
  objectId?: Id<"collections">;
  caseId?: string;
  asOf?: number;
}

export const AUDIT_READ_PERMISSION = "organization.view_analytics";

/** Cases filed in the audit log that hold no Tasks, so have no case type. */
const CASE_ACCESS: Record<
  string,
  {
    permission: "loans.read" | "collections.read";
    feature?: "loans";
    module?: "library";
  }
> = {
  transitRecord: { permission: "loans.read", feature: "loans" },
  organizationMoveRequest: { permission: "collections.read" },
  libraryAcquisitionRequest: {
    permission: "collections.read",
    module: "library",
  },
};

async function requireCaseAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseKind: string,
  requireMemberPermission: (permission: string) => Promise<unknown>,
) {
  const caseType = caseTypeOfEntity(caseKind);
  if (caseType && CASE_TYPES[caseType].auditCase !== false) {
    // Whoever may open the case may read its history.
    for (const permission of caseReadPermissions(caseType))
      await requireMemberPermission(permission);
    const { feature } = CASE_TYPES[caseType];
    if (feature) await requireFeatureAccess(ctx, organizationId, feature);
    return;
  }
  const access = Object.hasOwn(CASE_ACCESS, caseKind)
    ? CASE_ACCESS[caseKind]
    : undefined;
  if (!access) throw new Error("Invalid case filter");
  await requireMemberPermission(access.permission);
  if (access.feature)
    await requireFeatureAccess(ctx, organizationId, access.feature);
  if (access.module)
    await requireModuleEnabled(ctx, organizationId, access.module);
}

async function requireHistoryAccess(
  ctx: QueryCtx,
  args: HistoryFilters,
  requireMemberPermission: (permission: string) => Promise<unknown>,
) {
  await requireMemberPermission(AUDIT_READ_PERMISSION);
  if (args.caseId !== undefined)
    await requireCaseAccess(
      ctx,
      args.organizationId,
      args.caseId.split(":", 1)[0] ?? "",
      requireMemberPermission,
    );
}

export async function readHistoryPage(
  ctx: QueryCtx,
  args: HistoryFilters,
  paginationOpts: PaginationOptions,
) {
  await requireHistoryAccess(ctx, args, (permission) =>
    requirePermission(ctx, args.organizationId, permission),
  );
  return readAuthorizedHistoryPage(ctx, args, paginationOpts, true);
}

async function readAuthorizedHistoryPage(
  ctx: QueryCtx,
  args: HistoryFilters,
  paginationOpts: PaginationOptions,
  resolveCurrentActor: boolean,
) {
  for (const value of [args.fromDate, args.toDate, args.asOf]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0))
      throw new Error("Invalid history date");
  }
  if (
    args.fromDate !== undefined &&
    args.toDate !== undefined &&
    args.fromDate > args.toDate
  )
    throw new Error("Invalid history date range");
  if (args.entityId && !args.entityType)
    throw new Error("Entity type required");
  if (
    !Number.isInteger(paginationOpts.numItems) ||
    paginationOpts.numItems < 1 ||
    paginationOpts.numItems > 100
  )
    throw new Error("History page size must be between 1 and 100");
  const range = (
    q: IndexRange & {
      gte(
        field: "timestamp",
        value: number,
      ): IndexRange & { lte(field: "timestamp", value: number): IndexRange };
      lte(field: "timestamp", value: number): IndexRange;
    },
  ): IndexRange => {
    if (args.fromDate !== undefined && args.toDate !== undefined)
      return q.gte("timestamp", args.fromDate).lte("timestamp", args.toDate);
    if (args.fromDate !== undefined) return q.gte("timestamp", args.fromDate);
    if (args.toDate !== undefined) return q.lte("timestamp", args.toDate);
    return q;
  };
  let indexed = args.objectId
    ? ctx.db
        .query("auditLog")
        .withIndex("by_organization_and_objectId_and_timestamp", (q) =>
          range(
            q
              .eq("organizationId", args.organizationId)
              .eq("objectId", args.objectId),
          ),
        )
    : args.caseId
      ? ctx.db
          .query("auditLog")
          .withIndex("by_organization_and_caseId_and_timestamp", (q) =>
            range(
              q
                .eq("organizationId", args.organizationId)
                .eq("caseId", args.caseId),
            ),
          )
      : args.entityType && args.entityId
        ? ctx.db
            .query("auditLog")
            .withIndex(
              "by_organization_and_entityType_and_entityId_and_timestamp",
              (q) =>
                range(
                  q
                    .eq("organizationId", args.organizationId)
                    .eq("entityType", args.entityType!)
                    .eq("entityId", args.entityId!),
                ),
            )
        : args.userId
          ? ctx.db
              .query("auditLog")
              .withIndex("by_organization_and_userId_and_timestamp", (q) =>
                range(
                  q
                    .eq("organizationId", args.organizationId)
                    .eq("userId", args.userId!),
                ),
              )
          : args.entityType
            ? ctx.db
                .query("auditLog")
                .withIndex(
                  "by_organization_and_entityType_and_timestamp",
                  (q) =>
                    range(
                      q
                        .eq("organizationId", args.organizationId)
                        .eq("entityType", args.entityType!),
                    ),
                )
            : args.action && args.actionMatch === "exact"
              ? ctx.db
                  .query("auditLog")
                  .withIndex("by_organization_and_action_and_timestamp", (q) =>
                    range(
                      q
                        .eq("organizationId", args.organizationId)
                        .eq("action", args.action!),
                    ),
                  )
              : ctx.db
                  .query("auditLog")
                  .withIndex("by_organization_and_timestamp", (q) =>
                    range(q.eq("organizationId", args.organizationId)),
                  );
  if (args.userId)
    indexed = indexed.filter((q) => q.eq(q.field("userId"), args.userId!));
  if (args.entityType)
    indexed = indexed.filter((q) =>
      q.eq(q.field("entityType"), args.entityType!),
    );
  if (args.entityId)
    indexed = indexed.filter((q) => q.eq(q.field("entityId"), args.entityId!));
  if (args.action && args.actionMatch === "exact")
    indexed = indexed.filter((q) => q.eq(q.field("action"), args.action!));
  if (args.objectId)
    indexed = indexed.filter((q) => q.eq(q.field("objectId"), args.objectId!));
  if (args.caseId)
    indexed = indexed.filter((q) => q.eq(q.field("caseId"), args.caseId!));
  if (args.asOf !== undefined)
    indexed = indexed.filter((q) =>
      q.lte(q.field("_creationTime"), args.asOf!),
    );
  const result = await indexed.order("desc").paginate({
    ...paginationOpts,
    maximumRowsRead: Math.min(paginationOpts.maximumRowsRead ?? 1000, 1000),
    maximumBytesRead: Math.min(
      paginationOpts.maximumBytesRead ?? 2_000_000,
      2_000_000,
    ),
  });
  const matched =
    args.action && args.actionMatch !== "exact"
      ? result.page.filter((entry) =>
          entry.action.toLowerCase().includes(args.action!.toLowerCase()),
        )
      : result.page;
  const entries = await presentEntries(ctx, matched, resolveCurrentActor);
  return {
    entries,
    continueCursor: result.continueCursor,
    splitCursor: result.splitCursor,
    pageStatus: result.pageStatus,
    nextCursor: result.isDone ? undefined : result.continueCursor,
    isDone: result.isDone,
    totalCount: entries.length,
    countKind: "page" as const,
  };
}

export const list = query({
  args: {
    ...historyFilterArgs,
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  returns: historyPageValidator,
  handler: async (ctx, args) =>
    readHistoryPage(
      ctx,
      args,
      args.paginationOpts ?? {
        numItems: args.limit ?? 50,
        cursor: args.cursor ?? null,
      },
    ),
});

export const exportPageForJob = internalQuery({
  args: {
    ...historyFilterArgs,
    creatorId: v.id("users"),
    asOf: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: historyPageValidator,
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Export creator unavailable");
    await requireHistoryAccess(ctx, args, async (permission) => {
      const permitted: boolean = await ctx.runQuery(
        internal.utils.permissions.checkOrgPermission,
        {
          userId: args.creatorId,
          organizationId: args.organizationId,
          permissionName: permission,
        },
      );
      if (!permitted) throw new Error(`Permission denied: ${permission}`);
    });
    // Exports are evidence artefacts: snapshot columns only, no current-profile lookup.
    return readAuthorizedHistoryPage(ctx, args, args.paginationOpts, false);
  },
});

/**
 * Get available entity types for filter dropdown
 */
export const getEntityTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return [...ENTITY_TYPES];
  },
});

/**
 * Get available actions for filter dropdown (based on recent audit entries).
 * Bounded to the most recent {@link DROPDOWN_SCAN_CAP} entries.
 */
export const getAvailableActions = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const [, entries] = await Promise.all([
      requirePermission(ctx, args.organizationId, "collections.read"),
      ctx.db
        .query("auditLog")
        .withIndex("by_organization_and_timestamp", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(DROPDOWN_SCAN_CAP),
    ] as const);

    const actions = [...new Set(entries.map((e) => e.action))];
    return actions.sort();
  },
});

/**
 * Get users who have audit log entries (for filter dropdown).
 * Bounded to users appearing in the most recent {@link DROPDOWN_SCAN_CAP} entries.
 */
export const getActiveUsers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const [, entries] = await Promise.all([
      requirePermission(ctx, args.organizationId, "collections.read"),
      ctx.db
        .query("auditLog")
        .withIndex("by_organization_and_timestamp", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(DROPDOWN_SCAN_CAP),
    ] as const);

    const userIds = [...new Set(entries.map((e) => e.userId))];

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        return user
          ? { _id: user._id, name: user.name, email: user.email }
          : null;
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

/**
 * Get audit log entries for a specific entity
 */
export const getByEntity = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.string(),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLog"),
      action: v.string(),
      timestamp: v.number(),
      userName: v.optional(v.string()),
      userImage: v.optional(v.string()),
      changes: v.optional(auditLogChanges),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = Math.min(Math.max(args.limit ?? 10, 1), 100);

    const entries = await ctx.db
      .query("auditLog")
      .withIndex(
        "by_organization_and_entityType_and_entityId_and_timestamp",
        (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("entityType", args.entityType)
            .eq("entityId", args.entityId),
      )
      .order("desc")
      .take(limit);

    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        return {
          _id: entry._id,
          action: entry.action,
          timestamp: entry.timestamp,
          userName: entry.actorSnapshot?.name,
          userImage: undefined,
          changes: entry.changes,
        };
      }),
    );

    return enrichedEntries;
  },
});

/**
 * Get recent audit log entries for an organization
 */
export const getRecent = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLog"),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      timestamp: v.number(),
      userName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit);

    // Get user names for each entry
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        return {
          _id: entry._id,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          timestamp: entry.timestamp,
          userName: entry.actorSnapshot?.name,
        };
      }),
    );

    return enrichedEntries;
  },
});

export const getEntry = query({
  args: { organizationId: v.id("organizations"), eventId: v.id("auditLog") },
  returns: v.union(auditEntryValidator, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const entry = await ctx.db.get(args.eventId);
    if (!entry || entry.organizationId !== args.organizationId) return null;
    const [presented] = await presentEntries(ctx, [entry], true);
    return presented ?? null;
  },
});

export const correct = mutation({
  args: {
    organizationId: v.id("organizations"),
    eventId: v.id("auditLog"),
    reason: v.string(),
    statement: v.string(),
    requestId: v.string(),
  },
  returns: v.id("auditLog"),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );
    await requirePermission(ctx, args.organizationId, "collections.read");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const original = await ctx.db.get(args.eventId);
    if (!original || original.organizationId !== args.organizationId)
      throw new Error("Audit event not found");
    const reason = args.reason.trim(),
      statement = args.statement.trim(),
      requestId = args.requestId.trim();
    if (
      !reason ||
      reason.length > 2000 ||
      !statement ||
      statement.length > 10000 ||
      !requestId ||
      requestId.length > 200
    )
      throw new Error(
        "Correction requires a reason, statement and retry identifier",
      );
    const previous = await ctx.db
      .query("auditLog")
      .withIndex("by_organization_and_requestId", (q) =>
        q.eq("organizationId", args.organizationId).eq("requestId", requestId),
      )
      .unique();
    if (previous) {
      if (
        previous.correctionOf !== args.eventId ||
        previous.correctionReason !== reason ||
        previous.changes?.statement !== statement ||
        previous.userId !== userId
      )
        throw new Error("Correction retry conflicts with original request");
      return previous._id;
    }
    const user = await ctx.db.get(userId);
    return await ctx.db.insert("auditLog", {
      organizationId: args.organizationId,
      userId,
      action: "corrected",
      entityType: original.entityType,
      entityId: original.entityId,
      timestamp: Date.now(),
      actorSnapshot: { name: user?.name ?? user?.username, email: user?.email },
      subjectSnapshot: original.subjectSnapshot ?? {
        identifier: original.entityId,
      },
      objectId: original.objectId,
      caseId: original.caseId,
      correctionOf: original._id,
      correctionReason: reason,
      requestId,
      changes: { operation: "correction", statement },
    });
  },
});

const caseTypeValidator = v.union(
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("loan"),
  v.literal("exhibition"),
  v.literal("conservation"),
  v.literal("acquisition"),
);
const caseArgs = {
  organizationId: v.id("organizations"),
  caseType: caseTypeValidator,
  entityId: v.string(),
};
const approvalValidator = v.object({
  step: v.number(),
  approvedBy: v.id("users"),
  approvedAt: v.number(),
  comment: v.optional(v.string()),
  approverName: v.optional(v.string()),
});

export async function resolveCase(
  ctx: QueryCtx,
  args: {
    organizationId: Id<"organizations">;
    caseType:
      | "accession"
      | "deaccession"
      | "loan"
      | "exhibition"
      | "conservation"
      | "acquisition";
    entityId: string;
  },
) {
  if (args.caseType !== "acquisition") {
    const record = await loadCase(
      ctx,
      args.organizationId,
      args.caseType,
      args.entityId,
    );
    return record.doc;
  }
  // Acquisition requests hold no Tasks, so they are not a case type yet.
  await requireCaseAccess(
    ctx,
    args.organizationId,
    "libraryAcquisitionRequest",
    (permission) => requirePermission(ctx, args.organizationId, permission),
  );
  const id = ctx.db.normalizeId("libraryAcquisitionRequests", args.entityId);
  const entity = id ? await ctx.db.get(id) : null;
  if (!entity || entity.organizationId !== args.organizationId)
    throw workError("CASE_NOT_FOUND", "Case not found in this organization");
  return entity;
}

export const casePageValidator = v.object({
  entries: v.array(
    v.object({
      ordinal: v.number(),
      entry: approvalValidator,
      evidenceStatus: v.union(v.literal("recorded"), v.literal("legacy")),
      /** Legacy approvals without a recorded name: the approver's profile name today. */
      currentApproverName: v.optional(v.string()),
    }),
  ),
  nextCursor: v.optional(v.number()),
  isDone: v.boolean(),
});

export async function readCaseHistory(
  ctx: QueryCtx,
  args: {
    organizationId: Id<"organizations">;
    caseType:
      | "accession"
      | "deaccession"
      | "loan"
      | "exhibition"
      | "conservation"
      | "acquisition";
    entityId: string;
    limit?: number;
    cursor?: number;
  },
) {
  const entity = await resolveCase(ctx, args);
  const limit = args.limit ?? 50,
    cursor = args.cursor ?? 0;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(cursor) ||
    cursor < 0
  )
    throw new Error("Invalid case history page");
  const legacy = entity.workflowHistory ?? [];
  const entries: Array<{
    ordinal: number;
    entry: typeof approvalValidator.type;
    evidenceStatus: "recorded" | "legacy";
  }> = legacy.slice(cursor, cursor + limit + 1).map((entry, i) => ({
    ordinal: cursor + i,
    entry,
    evidenceStatus: "legacy",
  }));
  if (entries.length < limit + 1) {
    const children = await ctx.db
      .query("caseHistoryEntries")
      .withIndex("by_organization_and_caseType_and_entityId_and_ordinal", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("caseType", args.caseType)
          .eq("entityId", args.entityId)
          .gte("ordinal", Math.max(cursor, legacy.length)),
      )
      .order("asc")
      .take(limit + 1 - entries.length);
    entries.push(
      ...children.map(({ ordinal, entry, evidenceStatus }) => ({
        ordinal,
        entry,
        evidenceStatus,
      })),
    );
  }
  const isDone = entries.length <= limit;
  const page = entries.slice(0, limit);
  const unnamed = (row: (typeof page)[number]) =>
    row.evidenceStatus === "legacy" && !row.entry.approverName;
  const names = await currentProfileNames(
    ctx,
    page.flatMap((row) => (unnamed(row) ? [row.entry.approvedBy] : [])),
  );
  return {
    entries: page.map((row) => ({
      ...row,
      currentApproverName: unnamed(row)
        ? names.get(row.entry.approvedBy)
        : undefined,
    })),
    nextCursor: isDone ? undefined : entries[limit - 1]!.ordinal + 1,
    isDone,
  };
}

export const listCaseHistory = query({
  args: {
    ...caseArgs,
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  returns: casePageValidator,
  handler: readCaseHistory,
});

export const workflowHistoryPageValidator = v.object({
  entries: v.array(
    approvalValidator.extend({
      ordinal: v.number(),
      evidenceStatus: v.union(v.literal("recorded"), v.literal("legacy")),
    }),
  ),
  nextCursor: v.optional(v.number()),
  isDone: v.boolean(),
});
export async function readWorkflowHistoryPage(
  ctx: QueryCtx,
  args: Parameters<typeof readCaseHistory>[1],
) {
  const page = await readCaseHistory(ctx, args);
  return {
    ...page,
    entries: page.entries.map((row) => ({
      ...row.entry,
      ordinal: row.ordinal,
      evidenceStatus: row.evidenceStatus,
    })),
  };
}
