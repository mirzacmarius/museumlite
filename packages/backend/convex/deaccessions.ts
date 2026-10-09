import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import {
  readWorkflowHistoryPage,
  workflowHistoryPageValidator,
} from "./auditLog";
import { batchLookup } from "./utils/batchLookup";
import { appendCaseHistory, recentCaseHistory } from "./utils/caseHistory";
import {
  applyCollectionDisposition,
  canRestoreRejectedDisposition,
  markCollectionActive,
} from "./utils/collectionLifecycle";
import {
  DISPOSAL_POLICY_VERSION,
  type DisposalDecisionCheckKey,
  describeBlockingDecisionChecks,
  evaluateDisposalDecisionChecks,
  getBlockingDecisionChecks,
  hasCurrentValuation,
  isDisposalDecision,
  methodHasProceedsStage,
  resolveDecisionBasis,
  resolveExitState,
  resolveProceedsState,
} from "./utils/disposalPolicy";
import { assertCollectionNotOnLoan } from "./utils/loanOccupancy";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { getWorkflowCreatorRecipient } from "./utils/notificationRecipients";
import { generateNextDeaccessionNumber } from "./utils/numberGenerator";
import { requireLinkableParty } from "./utils/parties";
import { syncExitRecipientLink } from "./utils/partyLinks";
import {
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
  hasPermission,
  requirePermission,
} from "./utils/permissions";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
} from "./utils/uploadOwnership";
import { getWorkflowConfig } from "./utils/workflowConfigs";
import {
  prepareWorkflowStepAdvance,
  recordWorkflowStepAdvance,
  recordWorkflowStepApproval,
} from "./utils/workflowExecution";
import { resolveWorkflowStepState } from "./utils/workflowSteps";

const targetCollectionStatusValidator = v.union(
  v.literal("deaccessioned"),
  v.literal("archived"),
  v.literal("deleted"),
);

function resolveTargetCollectionStatus(deaccession: {
  targetCollectionStatus?: "deaccessioned" | "archived" | "deleted";
}) {
  return deaccession.targetCollectionStatus ?? "deaccessioned";
}

function buildSearchText(values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => {
      const trimmedValue = value?.trim();
      return trimmedValue ? [trimmedValue] : [];
    })
    .join(" ");
}

async function buildDeaccessionSearchText(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
) {
  const collection = await ctx.db.get(deaccession.collectionId);

  return buildSearchText([
    deaccession.deaccessionNumber,
    deaccession.reason,
    deaccession.disposition,
    deaccession.notes,
    collection?.title,
    collection?.accessionNumber,
    deaccession.method,
  ]);
}

async function upsertDeaccessionSearchDocument(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
) {
  const [searchText, existing] = await Promise.all([
    buildDeaccessionSearchText(ctx, deaccession),
    ctx.db
      .query("deaccessionSearchDocuments")
      .withIndex("by_deaccession", (q) =>
        q.eq("deaccessionId", deaccession._id),
      )
      .first(),
  ] as const);
  const fields = {
    organizationId: deaccession.organizationId,
    deaccessionId: deaccession._id,
    status: deaccession.status,
    searchText,
    dateDeaccessioned: deaccession.dateDeaccessioned,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return;
  }

  await ctx.db.insert("deaccessionSearchDocuments", fields);
}

async function syncDeaccessionSearchDocument(
  ctx: MutationCtx,
  deaccessionId: Id<"deaccessions">,
) {
  const deaccession = await ctx.db.get(deaccessionId);
  if (deaccession) {
    await upsertDeaccessionSearchDocument(ctx, deaccession);
  }
}

async function restoreRejectedCollectionStatus(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
  userId: Id<"users">,
) {
  const collection = await ctx.db.get(deaccession.collectionId);
  if (!collection) {
    return;
  }

  const targetCollectionStatus = resolveTargetCollectionStatus(deaccession);

  if (!canRestoreRejectedDisposition(collection, targetCollectionStatus)) {
    return;
  }

  await markCollectionActive(ctx, {
    collectionId: deaccession.collectionId,
    changedBy: userId,
    clearDisposition: true,
  });
}

async function applyApprovedCollectionStatus(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
  userId: Id<"users">,
) {
  await applyCollectionDisposition(ctx, {
    collectionId: deaccession.collectionId,
    changedBy: userId,
    targetStatus: resolveTargetCollectionStatus(deaccession),
    reason: deaccession.reason,
  });
}

/**
 * Evaluate the decision-stage checks for a disposal about to be authorized.
 * Outstanding required checks block the decision unless the authorizing
 * approver records an exception reason, which is retained with the decision.
 */
function reviewDisposalDecision(
  deaccession: Doc<"deaccessions">,
  userId: Id<"users">,
  exceptionReason: string | undefined,
  now: number,
): NonNullable<Doc<"deaccessions">["decisionReview"]> {
  const checks = evaluateDisposalDecisionChecks(deaccession, now);
  const blocking = getBlockingDecisionChecks(checks);
  const trimmedExceptionReason = exceptionReason?.trim();

  if (blocking.length === 0) {
    if (trimmedExceptionReason) {
      throw new ConvexError(
        "No decision checks are outstanding; approve without an exception",
      );
    }
    return { policyVersion: DISPOSAL_POLICY_VERSION, checkedAt: now, checks };
  }

  if (!trimmedExceptionReason) {
    throw new ConvexError(
      `Disposal decision is blocked. Outstanding: ${describeBlockingDecisionChecks(blocking)}. Complete the evidence or record an authorized exception reason.`,
    );
  }

  return {
    policyVersion: DISPOSAL_POLICY_VERSION,
    checkedAt: now,
    checks,
    exception: {
      reason: trimmedExceptionReason,
      waivedCheckKeys: blocking.map((check) => check.key),
      authorizedBy: userId,
      authorizedAt: now,
    },
  };
}

async function logDecisionException(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
  userId: Id<"users">,
  decisionReview: NonNullable<Doc<"deaccessions">["decisionReview"]>,
) {
  if (!decisionReview.exception) return;
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: deaccession.organizationId,
    userId,
    action: "disposal_decision_exception_authorized",
    entityType: "deaccession",
    entityId: deaccession._id,
    changes: {
      reason: decisionReview.exception.reason,
      waivedCheckKeys: decisionReview.exception.waivedCheckKeys,
      policyVersion: decisionReview.policyVersion,
    },
  });
}

async function canInitiateDeaccessionWorkflowForUser(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  workflowEnabled: boolean,
) {
  const userOrganization = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  if (!userOrganization) {
    return false;
  }

  // Organization administrators may start any workflow, as they may approve
  // any step (see canApproveAtStep).
  if (
    await hasPermission(ctx, organizationId, "organization.manage_settings")
  ) {
    return true;
  }

  const workflowConfig = workflowEnabled
    ? await getWorkflowConfig(ctx, organizationId, "deaccession")
    : null;

  if (workflowConfig) {
    return workflowConfig.canInitiateRoles.includes(userOrganization.roleId);
  }

  const rolePermissions = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q) => q.eq("roleId", userOrganization.roleId))
    .collect();

  const permissions = await Promise.all(
    rolePermissions.map((rolePermission) =>
      ctx.db.get(rolePermission.permissionId),
    ),
  );

  return permissions.some(
    (permission) =>
      permission?.name === "collections.create" ||
      permission?.name === "collections.delete",
  );
}

async function isDeaccessionWorkflowEnabled(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  return organization?.settings?.deaccessionWorkflowEnabled ?? true;
}

export async function createDeaccessionRecord(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    collectionId: Id<"collections">;
    deaccessionNumber?: string;
    dateDeaccessioned: number;
    reason: string;
    method: "sale" | "donation" | "destruction" | "transfer";
    targetCollectionStatus?: "deaccessioned" | "archived" | "deleted";
    disposition?: string;
    notes?: string;
    proceedsAmount?: number;
    proceedsCurrency?: string;
    proceedsRecipient?: string;
    proceedsDate?: number;
    proceedsNotes?: string;
  },
  userId: Id<"users">,
) {
  const collection = await ctx.db.get(args.collectionId);
  if (!collection) {
    throw new Error("Collection not found");
  }

  if (collection.organizationId !== args.organizationId) {
    throw new Error("Collection does not belong to organization");
  }

  await assertCollectionNotOnLoan(
    ctx,
    args.collectionId,
    "Cannot remove an object that is currently on loan",
  );

  const deaccessionWorkflowEnabled = await isDeaccessionWorkflowEnabled(
    ctx,
    args.organizationId,
  );
  const canInitiate = await canInitiateDeaccessionWorkflowForUser(
    ctx,
    args.organizationId,
    userId,
    deaccessionWorkflowEnabled,
  );

  if (!canInitiate) {
    throw new Error("Permission denied: cannot initiate deaccession workflow");
  }

  const deaccessionNumber = args.deaccessionNumber
    ? args.deaccessionNumber
    : await generateNextDeaccessionNumber(ctx, args.organizationId);

  const workflowConfig = deaccessionWorkflowEnabled
    ? await getWorkflowConfig(ctx, args.organizationId, "deaccession")
    : null;
  const workflowState = resolveWorkflowStepState(
    workflowConfig?.steps,
    undefined,
  );

  if (workflowConfig && workflowState.firstStep === undefined) {
    throw new Error("Workflow has no approval steps configured");
  }

  // Without an approval workflow the initiator's request becomes the decision
  // only when every decision-stage check passes; otherwise it waits for an
  // approver, who can complete the evidence or authorize an exception.
  const now = Date.now();
  const autoDecisionChecks = workflowConfig
    ? []
    : evaluateDisposalDecisionChecks(
        {
          method: args.method,
          reason: args.reason,
          disposition: args.disposition,
          targetCollectionStatus: args.targetCollectionStatus,
        },
        now,
      );
  const isAutoApproved =
    !workflowConfig &&
    getBlockingDecisionChecks(autoDecisionChecks).length === 0;
  const status = isAutoApproved ? "approved" : "pending";

  const workflowHistory = workflowConfig
    ? [
        {
          step: 0,
          approvedBy: userId,
          approvedAt: Date.now(),
          comment: "Created",
        },
      ]
    : [];

  const deaccessionId = await ctx.db.insert("deaccessions", {
    organizationId: args.organizationId,
    collectionId: args.collectionId,
    deaccessionNumber,
    dateDeaccessioned: args.dateDeaccessioned,
    reason: args.reason,
    method: args.method,
    disposition: args.disposition,
    notes: args.notes,
    status,
    ...(isAutoApproved
      ? {
          approvedBy: userId,
          approvedAt: now,
          decisionReview: {
            policyVersion: DISPOSAL_POLICY_VERSION,
            checkedAt: now,
            checks: autoDecisionChecks,
          },
        }
      : {}),
    targetCollectionStatus: args.targetCollectionStatus ?? "deaccessioned",
    workflowStep: workflowConfig ? (workflowState.firstStep ?? 1) : undefined,
    workflowHistory,
    proceedsAmount: args.proceedsAmount,
    proceedsCurrency: args.proceedsCurrency,
    proceedsRecipient: args.proceedsRecipient,
    proceedsDate: args.proceedsDate,
    proceedsNotes: args.proceedsNotes,
  });
  await Promise.all([
    syncDeaccessionSearchDocument(ctx, deaccessionId),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "deaccession",
      entityId: deaccessionId,
      changes: {
        deaccessionNumber,
        status,
      },
    }),
  ]);

  if (workflowConfig) {
    const usersToNotify = await getUsersToNotifyForWorkflowStep(
      ctx,
      args.organizationId,
      "deaccession",
      workflowState.firstStep ?? 1,
    );

    await Promise.all(
      usersToNotify.map((approverId) =>
        approverId !== userId
          ? ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: args.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "New Deaccession Requires Approval",
              message: `Deaccession ${deaccessionNumber} is pending your approval at step ${workflowState.firstStep ?? 1}.`,
              relatedEntityType: "deaccession",
              relatedEntityId: deaccessionId,
            })
          : Promise.resolve(),
      ),
    );
  }

  if (isAutoApproved) {
    const createdDeaccession = await ctx.db.get(deaccessionId);
    if (createdDeaccession) {
      await applyApprovedCollectionStatus(ctx, createdDeaccession, userId);
    }
  }

  return deaccessionId;
}

/**
 * Create deaccession record
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    deaccessionNumber: v.optional(v.string()),
    dateDeaccessioned: v.number(),
    reason: v.string(),
    method: v.union(
      v.literal("sale"),
      v.literal("donation"),
      v.literal("destruction"),
      v.literal("transfer"),
    ),
    targetCollectionStatus: v.optional(targetCollectionStatusValidator),
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
  },
  returns: v.id("deaccessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await createDeaccessionRecord(ctx, args, userId);
  },
});

export const createInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    createdByUserId: v.id("users"),
    deaccessionNumber: v.optional(v.string()),
    dateDeaccessioned: v.number(),
    reason: v.string(),
    method: v.union(
      v.literal("sale"),
      v.literal("donation"),
      v.literal("destruction"),
      v.literal("transfer"),
    ),
    targetCollectionStatus: v.optional(targetCollectionStatusValidator),
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
  },
  returns: v.id("deaccessions"),
  handler: async (ctx, args) => {
    return await createDeaccessionRecord(
      ctx,
      {
        organizationId: args.organizationId,
        collectionId: args.collectionId,
        deaccessionNumber: args.deaccessionNumber,
        dateDeaccessioned: args.dateDeaccessioned,
        reason: args.reason,
        method: args.method,
        targetCollectionStatus: args.targetCollectionStatus,
        disposition: args.disposition,
        notes: args.notes,
        proceedsAmount: args.proceedsAmount,
        proceedsCurrency: args.proceedsCurrency,
        proceedsRecipient: args.proceedsRecipient,
        proceedsDate: args.proceedsDate,
        proceedsNotes: args.proceedsNotes,
      },
      args.createdByUserId,
    );
  },
});

/**
 * List deaccessions
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("deaccessions"),
        deaccessionNumber: v.string(),
        collectionId: v.id("collections"),
        collectionTitle: v.string(),
        accessionNumber: v.optional(v.string()),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.union(
          v.literal("sale"),
          v.literal("donation"),
          v.literal("destruction"),
          v.literal("transfer"),
        ),
        targetCollectionStatus: targetCollectionStatusValidator,
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
        workflowStep: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const addCollectionInfo = async (page: Doc<"deaccessions">[]) => {
      const collectionMap = await batchLookup(
        ctx,
        page.map((deaccession) => deaccession.collectionId),
        "collections",
      );

      return page.map((deaccession) => {
        const collection = collectionMap.get(deaccession.collectionId);

        return {
          ...deaccession,
          collectionTitle: collection?.title || "",
          accessionNumber: collection?.accessionNumber,
        };
      });
    };

    const serializePage = (
      page: Awaited<ReturnType<typeof addCollectionInfo>>,
    ) =>
      page.map((item) => ({
        _id: item._id,
        deaccessionNumber: item.deaccessionNumber,
        collectionId: item.collectionId,
        collectionTitle: item.collectionTitle || "Unknown object",
        accessionNumber: item.accessionNumber,
        dateDeaccessioned: item.dateDeaccessioned,
        reason: item.reason,
        method: item.method,
        targetCollectionStatus: resolveTargetCollectionStatus(item),
        status: item.status,
        workflowStep: item.workflowStep,
      }));

    const searchLower = args.search?.trim().toLowerCase();

    if (!searchLower) {
      if (args.status) {
        const status = args.status;
        const paginationResult = await ctx.db
          .query("deaccessions")
          .withIndex("by_organization_and_status_and_dateDeaccessioned", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", status),
          )
          .order("desc")
          .paginate(args.paginationOpts);

        const page = await addCollectionInfo(paginationResult.page);

        return {
          page: serializePage(page),
          isDone: paginationResult.isDone,
          continueCursor: paginationResult.continueCursor,
        };
      }

      const paginationResult = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_dateDeaccessioned", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .paginate(args.paginationOpts);

      const page = await addCollectionInfo(paginationResult.page);

      return {
        page: serializePage(page),
        isDone: paginationResult.isDone,
        continueCursor: paginationResult.continueCursor,
      };
    }

    const hasSearchDocuments = await ctx.db
      .query("deaccessionSearchDocuments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (hasSearchDocuments) {
      const paginationResult = args.status
        ? await (() => {
            const status = args.status;
            return ctx.db
              .query("deaccessionSearchDocuments")
              .withSearchIndex("search_text", (q) =>
                q
                  .search("searchText", searchLower)
                  .eq("organizationId", args.organizationId)
                  .eq("status", status),
              )
              .paginate(args.paginationOpts);
          })()
        : await ctx.db
            .query("deaccessionSearchDocuments")
            .withSearchIndex("search_text", (q) =>
              q
                .search("searchText", searchLower)
                .eq("organizationId", args.organizationId),
            )
            .paginate(args.paginationOpts);

      const deaccessionsMap = await batchLookup(
        ctx,
        paginationResult.page.map(
          (searchDocument) => searchDocument.deaccessionId,
        ),
        "deaccessions",
      );
      const deaccessions = paginationResult.page.flatMap((searchDocument) => {
        const deaccession = deaccessionsMap.get(searchDocument.deaccessionId);
        return deaccession ? [deaccession] : [];
      });
      const page = await addCollectionInfo(deaccessions);

      return {
        page: serializePage(page),
        isDone: paginationResult.isDone,
        continueCursor: paginationResult.continueCursor,
      };
    }

    let allResults: Doc<"deaccessions">[];
    if (args.status) {
      const status = args.status;
      allResults = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", status),
        )
        .collect();
    } else {
      allResults = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
    }

    const deaccessionsWithCollectionInfo = await addCollectionInfo(allResults);

    // Apply search filter if provided
    const filteredResults = deaccessionsWithCollectionInfo.filter(
      (deaccession) => {
        return (
          deaccession.deaccessionNumber.toLowerCase().includes(searchLower) ||
          deaccession.reason.toLowerCase().includes(searchLower) ||
          deaccession.disposition?.toLowerCase().includes(searchLower) ||
          deaccession.notes?.toLowerCase().includes(searchLower) ||
          deaccession.collectionTitle.toLowerCase().includes(searchLower) ||
          deaccession.accessionNumber?.toLowerCase().includes(searchLower) ||
          deaccession.method.toLowerCase().includes(searchLower) ||
          false
        );
      },
    );

    // Sort by date deaccessioned (newest first)
    filteredResults.sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      filteredResults.length,
    );
    const page = filteredResults.slice(startIndex, endIndex);

    return {
      page: serializePage(page),
      isDone: endIndex >= filteredResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const backfillSearchDocuments = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    updatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const [, deaccessions] = await Promise.all([
      requirePermission(ctx, args.organizationId, "collections.read"),
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ] as const);

    await Promise.all(
      Array.from(deaccessions).map(async (deaccession) => {
        await upsertDeaccessionSearchDocument(ctx, deaccession);
      }),
    );

    return { updatedCount: deaccessions.length };
  },
});

export const getWorkflowSteps = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    hasWorkflow: v.boolean(),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        name: v.string(),
        roleName: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const workflowConfig = await getWorkflowConfig(
      ctx,
      args.organizationId,
      "deaccession",
    );

    if (!workflowConfig) {
      return {
        hasWorkflow: false,
        steps: [
          { stepNumber: 1, name: "Pending Review" },
          { stepNumber: -1, name: "Deaccessions" },
        ],
      };
    }

    const stepsWithRoles = await Promise.all(
      workflowConfig.steps.map(async (step) => {
        const role = await ctx.db.get(step.roleId);
        return {
          stepNumber: step.stepNumber,
          name: step.name,
          roleName: role?.name,
        };
      }),
    );

    const normalizedSteps = [
      ...stepsWithRoles,
      { stepNumber: -1, name: "Deaccessions" },
    ].filter(
      (step, index, steps) =>
        steps.findIndex(
          (candidate) => candidate.stepNumber === step.stepNumber,
        ) === index,
    );

    return {
      hasWorkflow: true,
      steps: normalizedSteps,
    };
  },
});

/**
 * Get deaccession details
 */
export const get = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("deaccessions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      collectionId: v.id("collections"),
      deaccessionNumber: v.string(),
      dateDeaccessioned: v.number(),
      reason: v.string(),
      method: v.union(
        v.literal("sale"),
        v.literal("donation"),
        v.literal("destruction"),
        v.literal("transfer"),
      ),
      targetCollectionStatus: targetCollectionStatusValidator,
      disposition: v.optional(v.string()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      notes: v.optional(v.string()),
      workflowStep: v.optional(v.number()),
      workflowHistory: v.optional(
        v.array(
          v.object({
            step: v.number(),
            approvedBy: v.id("users"),
            approvedAt: v.number(),
            comment: v.optional(v.string()),
          }),
        ),
      ),
      workflowHistoryIsPreview: v.literal(true),
      workflowHistoryHasMore: v.boolean(),
      proceedsAmount: v.optional(v.number()),
      proceedsCurrency: v.optional(v.string()),
      proceedsRecipient: v.optional(v.string()),
      proceedsDate: v.optional(v.number()),
      proceedsNotes: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      return null;
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    const historyPreview = await recentCaseHistory(
      ctx,
      deaccession,
      "deaccession",
    );
    return {
      _id: deaccession._id,
      _creationTime: deaccession._creationTime,
      organizationId: deaccession.organizationId,
      collectionId: deaccession.collectionId,
      deaccessionNumber: deaccession.deaccessionNumber,
      dateDeaccessioned: deaccession.dateDeaccessioned,
      reason: deaccession.reason,
      method: deaccession.method,
      targetCollectionStatus: resolveTargetCollectionStatus(deaccession),
      disposition: deaccession.disposition,
      approvedBy: deaccession.approvedBy,
      approvedAt: deaccession.approvedAt,
      status: deaccession.status,
      notes: deaccession.notes,
      workflowStep: deaccession.workflowStep,
      workflowHistory: historyPreview.entries,
      workflowHistoryIsPreview: true as const,
      workflowHistoryHasMore: historyPreview.hasMore,
      proceedsAmount: deaccession.proceedsAmount,
      proceedsCurrency: deaccession.proceedsCurrency,
      proceedsRecipient: deaccession.proceedsRecipient,
      proceedsDate: deaccession.proceedsDate,
      proceedsNotes: deaccession.proceedsNotes,
    };
  },
});

/**
 * Update deaccession (before approval)
 */
export const update = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    reason: v.optional(v.string()),
    method: v.optional(
      v.union(
        v.literal("sale"),
        v.literal("donation"),
        v.literal("destruction"),
        v.literal("transfer"),
      ),
    ),
    targetCollectionStatus: v.optional(targetCollectionStatusValidator),
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, deaccession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.deaccessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // Can only update if pending
    if (deaccession.status !== "pending") {
      throw new Error("Can only update pending deaccessions");
    }

    // Check permission
    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    const updates: {
      reason?: string;
      method?: "sale" | "donation" | "destruction" | "transfer";
      targetCollectionStatus?: "deaccessioned" | "archived" | "deleted";
      disposition?: string;
      notes?: string;
      proceedsAmount?: number;
      proceedsCurrency?: string;
      proceedsRecipient?: string;
      proceedsDate?: number;
      proceedsNotes?: string;
    } = {};

    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.method !== undefined) updates.method = args.method;
    if (args.targetCollectionStatus !== undefined) {
      updates.targetCollectionStatus = args.targetCollectionStatus;
    }
    if (args.disposition !== undefined) updates.disposition = args.disposition;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.proceedsAmount !== undefined)
      updates.proceedsAmount = args.proceedsAmount;
    if (args.proceedsCurrency !== undefined)
      updates.proceedsCurrency = args.proceedsCurrency;
    if (args.proceedsRecipient !== undefined)
      updates.proceedsRecipient = args.proceedsRecipient;
    if (args.proceedsDate !== undefined)
      updates.proceedsDate = args.proceedsDate;
    if (args.proceedsNotes !== undefined)
      updates.proceedsNotes = args.proceedsNotes;

    await ctx.db.patch(args.deaccessionId, updates);
    await syncDeaccessionSearchDocument(ctx, args.deaccessionId);

    return null;
  },
});

/**
 * Submit for approval
 */
export const submitForApproval = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, deaccession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.deaccessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    if (deaccession.status !== "pending") {
      throw new Error("Deaccession is not pending");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    const workflowConfig = await getWorkflowConfig(
      ctx,
      deaccession.organizationId,
      "deaccession",
    );

    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      undefined,
    );

    if (workflowConfig && workflowState.firstStep === undefined) {
      throw new Error("Workflow has no approval steps configured");
    }

    // Reset workflow step if needed
    await ctx.db.patch(args.deaccessionId, {
      workflowStep: workflowState.firstStep ?? 1,
    });

    return null;
  },
});

/**
 * Approve deaccession
 */
export const approve = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    comment: v.optional(v.string()),
    exceptionReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, deaccession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.deaccessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    if (deaccession.status !== "pending") {
      throw new Error("Deaccession is not pending");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.approve_deaccession",
    );

    const workflowConfig = (await isDeaccessionWorkflowEnabled(
      ctx,
      deaccession.organizationId,
    ))
      ? await getWorkflowConfig(ctx, deaccession.organizationId, "deaccession")
      : null;

    if (workflowConfig) {
      const workflowState = resolveWorkflowStepState(
        workflowConfig.steps,
        deaccession.workflowStep,
      );
      const currentStep = workflowState.currentStep;

      if (currentStep === undefined) {
        throw new Error("Workflow has no approval steps configured");
      }
      if (!workflowState.hasCurrentStep && !workflowState.isPastLastStep) {
        throw new Error("Current workflow step is not configured");
      }

      const canApprove = await canApproveAtStep(
        ctx,
        deaccession.organizationId,
        "deaccession",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      const currentStepConfig = workflowConfig.steps.find(
        (step) => step.stepNumber === currentStep,
      );
      if (!currentStepConfig) {
        throw new Error("Current workflow step is not configured");
      }

      // Check if this is the last step
      const isLastStep =
        workflowState.isPastLastStep || workflowState.isLastStep;
      if (!isLastStep && args.exceptionReason?.trim()) {
        throw new ConvexError(
          "Exceptions can only be authorized at the final disposal decision",
        );
      }
      const decisionReview = isLastStep
        ? reviewDisposalDecision(
            deaccession,
            userId,
            args.exceptionReason,
            Date.now(),
          )
        : undefined;

      const { approvalDecision, approvalMode } =
        await recordWorkflowStepApproval(ctx, {
          organizationId: deaccession.organizationId,
          workflowType: "deaccession",
          entityId: args.deaccessionId,
          stepNumber: currentStep,
          step: currentStepConfig,
          performedBy: userId,
          comment: args.comment,
          isPastLastStep: workflowState.isPastLastStep,
        });

      if (!approvalDecision.shouldAdvance) {
        return null;
      }

      // Add to workflow history
      const history = [...(deaccession.workflowHistory ?? [])];
      if (!workflowState.isPastLastStep) {
        history.push({
          step: currentStep,
          approvedBy: userId,
          approvedAt: Date.now(),
          comment: args.comment,
        });
      }

      if (isLastStep && decisionReview) {
        await Promise.all([
          ctx.db.patch(args.deaccessionId, {
            status: "approved",
            approvedBy: userId,
            approvedAt: Date.now(),
            ...(await appendCaseHistory(
              ctx,
              deaccession,
              "deaccession",
              history,
            )),
            decisionReview,
          }),
          logDecisionException(ctx, deaccession, userId, decisionReview),
          syncDeaccessionSearchDocument(ctx, args.deaccessionId),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: deaccession.organizationId,
            userId,
            action: "approved",
            entityType: "deaccession",
            entityId: args.deaccessionId,
            changes: { status: "approved", step: currentStep },
          }),
        ] as const);

        // Notify users who were involved in the workflow (from history)
        const creatorId = getWorkflowCreatorRecipient(history, userId);
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: deaccession.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Deaccession Approved",
            message: `Deaccession ${deaccession.deaccessionNumber} has been fully approved.`,
            relatedEntityType: "deaccession",
            relatedEntityId: args.deaccessionId,
          });
        }

        await applyApprovedCollectionStatus(ctx, deaccession, userId);
      } else {
        const nextStep = await prepareWorkflowStepAdvance(ctx, {
          organizationId: deaccession.organizationId,
          workflowType: "deaccession",
          fromStep: currentStep,
          toStep: workflowState.nextStep,
        });

        await ctx.db.patch(args.deaccessionId, {
          workflowStep: nextStep,
          ...(await appendCaseHistory(
            ctx,
            deaccession,
            "deaccession",
            history,
          )),
        });

        if (approvalMode !== "single") {
          await ctx.runMutation(internal.workflows.clearStepApprovals, {
            workflowType: "deaccession",
            entityId: args.deaccessionId,
            stepNumber: currentStep,
          });
        }

        await recordWorkflowStepAdvance(ctx, {
          organizationId: deaccession.organizationId,
          workflowType: "deaccession",
          entityId: args.deaccessionId,
          fromStep: currentStep,
          toStep: nextStep,
          performedBy: userId,
          notification: {
            title: "Deaccession Requires Your Approval",
            message: `Deaccession ${deaccession.deaccessionNumber} is pending your approval at step ${nextStep}.`,
          },
        });
      }
    } else {
      const decisionReview = reviewDisposalDecision(
        deaccession,
        userId,
        args.exceptionReason,
        Date.now(),
      );
      const [, userOrgs] = await Promise.all([
        Promise.all([
          ctx.db.patch(args.deaccessionId, {
            status: "approved",
            approvedBy: userId,
            approvedAt: Date.now(),
            decisionReview,
          }),
          logDecisionException(ctx, deaccession, userId, decisionReview),
          syncDeaccessionSearchDocument(ctx, args.deaccessionId),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: deaccession.organizationId,
            userId,
            action: "approved",
            entityType: "deaccession",
            entityId: args.deaccessionId,
            changes: { status: "approved" },
          }),
        ]),
        ctx.db
          .query("userOrganizations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", deaccession.organizationId),
          )
          .collect(),
      ] as const);

      await Promise.all(
        Array.from(userOrgs).map(async (userOrg) => {
          if (userOrg.userId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: deaccession.organizationId,
              userId: userOrg.userId,
              type: "workflow_approved",
              title: "Deaccession Approved",
              message: `Deaccession ${deaccession.deaccessionNumber} has been approved.`,
              relatedEntityType: "deaccession",
              relatedEntityId: args.deaccessionId,
            });
          }
        }),
      );

      await applyApprovedCollectionStatus(ctx, deaccession, userId);
    }

    return null;
  },
});

/**
 * Reject deaccession
 */
export const reject = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, deaccession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.deaccessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    if (deaccession.status !== "pending") {
      throw new Error("Deaccession is not pending");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.approve_deaccession",
    );

    await Promise.all([
      ctx.db.patch(args.deaccessionId, {
        status: "rejected",
        approvedBy: userId,
        approvedAt: Date.now(),
        notes: args.comment
          ? `${deaccession.notes || ""}\nRejected: ${args.comment}`.trim()
          : deaccession.notes,
      }),
      syncDeaccessionSearchDocument(ctx, args.deaccessionId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: "rejected",
        entityType: "deaccession",
        entityId: args.deaccessionId,
        changes: { status: "rejected", comment: args.comment },
      }),
      restoreRejectedCollectionStatus(ctx, deaccession, userId),
    ] as const);

    // Notify users who were involved in the workflow (from history)
    const history = [...(deaccession.workflowHistory ?? [])];
    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: deaccession.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Deaccession Rejected",
        message: `Deaccession ${deaccession.deaccessionNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "deaccession",
        relatedEntityId: args.deaccessionId,
      });
    }

    return null;
  },
});

/**
 * Get workflow history
 */
export const getWorkflowHistory = query({
  args: {
    deaccessionId: v.id("deaccessions"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: workflowHistoryPageValidator,
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    return await readWorkflowHistoryPage(ctx, {
      organizationId: deaccession.organizationId,
      caseType: "deaccession",
      entityId: args.deaccessionId,
      cursor: args.cursor,
      limit: args.limit,
    });
  },
});

export const getExportData = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.union(
    v.object({
      deaccession: v.object({
        _id: v.id("deaccessions"),
        deaccessionNumber: v.string(),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.string(),
        disposition: v.optional(v.string()),
        status: v.string(),
        notes: v.optional(v.string()),
        proceedsAmount: v.optional(v.number()),
        proceedsCurrency: v.optional(v.string()),
        proceedsRecipient: v.optional(v.string()),
        proceedsDate: v.optional(v.number()),
        proceedsNotes: v.optional(v.string()),
        approvedAt: v.optional(v.number()),
      }),
      collection: v.union(
        v.object({
          _id: v.id("collections"),
          title: v.string(),
          accessionNumber: v.optional(v.string()),
          description: v.optional(v.string()),
          primaryImageUrl: v.optional(v.string()),
        }),
        v.null(),
      ),
      organization: v.object({
        name: v.string(),
        slug: v.string(),
      }),
      workflowHistory: v.array(
        v.object({
          step: v.number(),
          approverName: v.string(),
          approvedAt: v.number(),
          comment: v.optional(v.string()),
        }),
      ),
      workflowHistoryIsPreview: v.literal(true),
      workflowHistoryHasMore: v.boolean(),
      approverName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      return null;
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    const [collection, organization] = await Promise.all([
      ctx.db.get(deaccession.collectionId),
      ctx.db.get(deaccession.organizationId),
    ] as const);
    if (!organization) {
      return null;
    }

    const historyPreview = await recentCaseHistory(
      ctx,
      deaccession,
      "deaccession",
    );
    const history = historyPreview.entries;
    const enrichedHistory = await Promise.all(
      history.map(async (item) => {
        return {
          step: item.step,
          approverName: item.approverName ?? "Unknown",
          approvedAt: item.approvedAt,
          comment: item.comment,
        };
      }),
    );

    const approverName = history.findLast(
      (entry) =>
        entry.approvedBy === deaccession.approvedBy &&
        entry.approvedAt === deaccession.approvedAt,
    )?.approverName;

    let primaryImageUrl: string | undefined;
    if (collection) {
      const primaryMedia = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .first();
      if (primaryMedia?.storageId) {
        primaryImageUrl =
          (await ctx.storage.getUrl(primaryMedia.storageId)) ?? undefined;
      }
    }

    return {
      deaccession: {
        _id: deaccession._id,
        deaccessionNumber: deaccession.deaccessionNumber,
        dateDeaccessioned: deaccession.dateDeaccessioned,
        reason: deaccession.reason,
        method: deaccession.method,
        disposition: deaccession.disposition,
        status: deaccession.status,
        notes: deaccession.notes,
        proceedsAmount: deaccession.proceedsAmount,
        proceedsCurrency: deaccession.proceedsCurrency,
        proceedsRecipient: deaccession.proceedsRecipient,
        proceedsDate: deaccession.proceedsDate,
        proceedsNotes: deaccession.proceedsNotes,
        approvedAt: deaccession.approvedAt,
      },
      collection: collection
        ? {
            _id: collection._id,
            title: collection.title,
            accessionNumber: collection.accessionNumber,
            description: collection.description,
            primaryImageUrl,
          }
        : null,
      organization: {
        name: organization.name,
        slug: organization.slug,
      },
      workflowHistory: enrichedHistory,
      workflowHistoryIsPreview: true as const,
      workflowHistoryHasMore: historyPreview.hasMore,
      approverName,
    };
  },
});

export const listForExport = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        deaccessionNumber: v.string(),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.string(),
        disposition: v.optional(v.string()),
        status: v.string(),
        collectionTitle: v.string(),
        accessionNumber: v.optional(v.string()),
        proceedsAmount: v.optional(v.number()),
        proceedsCurrency: v.optional(v.string()),
        proceedsRecipient: v.optional(v.string()),
        proceedsDate: v.optional(v.number()),
        approverName: v.optional(v.string()),
        approvedAt: v.optional(v.number()),
      }),
    ),
    totals: v.object({
      count: v.number(),
      pendingCount: v.number(),
      approvedCount: v.number(),
      rejectedCount: v.number(),
      totalProceeds: v.number(),
    }),
    organization: v.object({
      name: v.string(),
      slug: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    let results = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    if (args.status) {
      results = results.filter((d) => d.status === args.status);
    }
    if (args.dateFrom) {
      results = results.filter((d) => d.dateDeaccessioned >= args.dateFrom!);
    }
    if (args.dateTo) {
      results = results.filter((d) => d.dateDeaccessioned <= args.dateTo!);
    }

    results.sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned);

    const items = await Promise.all(
      results.map(async (d) => {
        const collection = await ctx.db.get(d.collectionId);
        let approverName: string | undefined;
        if (d.approvedBy) {
          const approver = await ctx.db.get(d.approvedBy);
          approverName = approver?.name || approver?.username || undefined;
        }
        return {
          deaccessionNumber: d.deaccessionNumber,
          dateDeaccessioned: d.dateDeaccessioned,
          reason: d.reason,
          method: d.method,
          disposition: d.disposition,
          status: d.status,
          collectionTitle: collection?.title || "Unknown",
          accessionNumber: collection?.accessionNumber,
          proceedsAmount: d.proceedsAmount,
          proceedsCurrency: d.proceedsCurrency,
          proceedsRecipient: d.proceedsRecipient,
          proceedsDate: d.proceedsDate,
          approverName,
          approvedAt: d.approvedAt,
        };
      }),
    );

    const pendingCount = results.filter((d) => d.status === "pending").length;
    const approvedCount = results.filter((d) => d.status === "approved").length;
    const rejectedCount = results.filter((d) => d.status === "rejected").length;
    const totalProceeds = results.reduce(
      (sum, d) => sum + (d.proceedsAmount || 0),
      0,
    );

    return {
      items,
      totals: {
        count: results.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        totalProceeds,
      },
      organization: {
        name: organization.name,
        slug: organization.slug,
      },
    };
  },
});

// ============================================
// Proceeds Accountability
// ============================================

async function requireApprovedDisposal(
  ctx: MutationCtx,
  deaccessionId: Id<"deaccessions">,
) {
  const [userId, deaccession] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(deaccessionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!deaccession) {
    throw new Error("Deaccession not found");
  }
  await requirePermission(
    ctx,
    deaccession.organizationId,
    "collections.update",
  );
  if (!isDisposalDecision(deaccession)) {
    throw new ConvexError(
      "Exit and proceeds apply only to deaccession disposals, not withdrawals",
    );
  }
  if (deaccession.status !== "approved") {
    throw new ConvexError(
      "Exit and proceeds can only be recorded after the disposal decision is approved",
    );
  }
  return { userId, deaccession };
}

function requireSale(deaccession: Doc<"deaccessions">) {
  if (!methodHasProceedsStage(deaccession.method)) {
    throw new ConvexError("Proceeds are recorded only for sale disposals");
  }
}

/**
 * Record the physical exit of a disposed object. An existing exit record is
 * only replaced with a correction reason; the superseded entry is retained in
 * the audit log.
 */
export const recordExit = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    exitDate: v.number(),
    recipient: v.string(),
    /** Optional Party the recipient text names; linked in the recipient role. */
    recipientAccountId: v.optional(v.id("accounts")),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    correctionReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, deaccession } = await requireApprovedDisposal(
      ctx,
      args.deaccessionId,
    );
    const recipient = args.recipient.trim();
    if (!recipient) {
      throw new ConvexError("Recipient, destination or witness is required");
    }
    if (!Number.isFinite(args.exitDate) || args.exitDate <= 0) {
      throw new ConvexError("Exit date is required");
    }
    const recipientParty = args.recipientAccountId
      ? await requireLinkableParty(
          ctx,
          deaccession.organizationId,
          args.recipientAccountId,
        )
      : null;
    const now = Date.now();
    const exitRecord = {
      exitDate: args.exitDate,
      recipient,
      reference: args.reference?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      recordedBy: userId,
      recordedAt: now,
    };
    const previous = deaccession.exitRecord;
    const correctionReason = args.correctionReason?.trim();
    const linkRecipient = () =>
      syncExitRecipientLink(ctx, {
        deaccession,
        previousExit: previous,
        exitDate: args.exitDate,
        recipient,
        recipientParty,
        correctionReason,
        userId,
      });

    if (previous) {
      if (
        previous.exitDate === exitRecord.exitDate &&
        previous.recipient === exitRecord.recipient &&
        previous.reference === exitRecord.reference &&
        previous.notes === exitRecord.notes
      ) {
        await linkRecipient();
        return null;
      }
      if (!correctionReason) {
        throw new ConvexError(
          "An exit is already recorded; provide a correction reason to replace it",
        );
      }
    }

    await Promise.all([
      ctx.db.patch(args.deaccessionId, {
        exitRecord,
        ...(previous
          ? { exitCorrectionCount: (deaccession.exitCorrectionCount ?? 0) + 1 }
          : {}),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: previous ? "disposal_exit_corrected" : "disposal_exit_recorded",
        entityType: "deaccession",
        entityId: args.deaccessionId,
        changes: {
          exitDate: exitRecord.exitDate,
          recipient: exitRecord.recipient,
          reference: exitRecord.reference,
          correctionReason,
          previousExitRecord: previous,
        },
      }),
    ] as const);
    await linkRecipient();

    return null;
  },
});

/**
 * Upload session for a sale proceeds receipt.
 */
export const generateReceiptUploadUrl = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { userId, deaccession } = await requireApprovedDisposal(
      ctx,
      args.deaccessionId,
    );
    requireSale(deaccession);
    return await createAuthorizedUploadUrl(
      ctx,
      userId,
      deaccession.organizationId,
    );
  },
});

/**
 * Record sale proceeds after the disposal decision. The receipt is optional
 * at this point; it is required (or excepted) when proceeds are verified.
 */
export const recordProceeds = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    amount: v.number(),
    currency: v.string(),
    recipient: v.string(),
    date: v.number(),
    notes: v.optional(v.string()),
    receiptDocument: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, deaccession } = await requireApprovedDisposal(
      ctx,
      args.deaccessionId,
    );
    requireSale(deaccession);
    if (deaccession.proceedsVerified === true) {
      throw new ConvexError("Verified proceeds cannot be changed");
    }
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new ConvexError("Proceeds amount must be zero or more");
    }
    if (!args.currency.trim() || !args.recipient.trim()) {
      throw new ConvexError("Currency and recipient are required");
    }
    if (args.receiptDocument) {
      await claimStorageOwnership(ctx, {
        storageId: args.receiptDocument,
        organizationId: deaccession.organizationId,
        uploadedBy: userId,
        ownerType: "deaccessionProceedsReceipt",
        ownerId: args.deaccessionId,
      });
    }
    await Promise.all([
      ctx.db.patch(args.deaccessionId, {
        proceedsAmount: args.amount,
        proceedsCurrency: args.currency.trim(),
        proceedsRecipient: args.recipient.trim(),
        proceedsDate: args.date,
        proceedsNotes: args.notes?.trim() || deaccession.proceedsNotes,
        proceedsReceiptDocument:
          args.receiptDocument ?? deaccession.proceedsReceiptDocument,
        proceedsRecordedBy: userId,
        proceedsRecordedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: "proceeds_recorded",
        entityType: "deaccession",
        entityId: args.deaccessionId,
        changes: {
          amount: args.amount,
          currency: args.currency,
          hasReceipt: Boolean(
            args.receiptDocument ?? deaccession.proceedsReceiptDocument,
          ),
        },
      }),
    ] as const);

    return null;
  },
});

/**
 * Verify that sale proceeds were received. A receipt is required unless the
 * verifier records an exception reason, which is retained and audited.
 */
export const verifyProceeds = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    notes: v.optional(v.string()),
    exceptionReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, deaccession } = await requireApprovedDisposal(
      ctx,
      args.deaccessionId,
    );
    requireSale(deaccession);
    if (deaccession.proceedsVerified === true) {
      return null;
    }
    if (deaccession.proceedsAmount === undefined) {
      throw new ConvexError("Record the proceeds before verifying them");
    }
    const exceptionReason = args.exceptionReason?.trim();
    if (!deaccession.proceedsReceiptDocument && !exceptionReason) {
      throw new ConvexError(
        "A receipt document is required to verify sale proceeds, or record an exception reason",
      );
    }
    const now = Date.now();
    const useException = !deaccession.proceedsReceiptDocument;

    await Promise.all([
      ctx.db.patch(args.deaccessionId, {
        proceedsVerified: true,
        proceedsVerifiedBy: userId,
        proceedsVerifiedAt: now,
        proceedsNotes: args.notes
          ? `${deaccession.proceedsNotes || ""}\nVerification: ${args.notes}`.trim()
          : deaccession.proceedsNotes,
        ...(useException && exceptionReason
          ? {
              proceedsVerificationException: {
                reason: exceptionReason,
                authorizedBy: userId,
                authorizedAt: now,
              },
            }
          : {}),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: useException
          ? "proceeds_verified_with_exception"
          : "proceeds_verified",
        entityType: "deaccession",
        entityId: args.deaccessionId,
        changes: {
          verified: true,
          exceptionReason: useException ? exceptionReason : undefined,
        },
      }),
    ] as const);

    return null;
  },
});

// ============================================
// Regulatory Approval
// ============================================

/**
 * Request regulatory approval from external approver
 */
export const requestRegulatoryApproval = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    approverEmail: v.string(),
    approverName: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.object({
    token: v.string(),
    approvalUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const [userId, deaccession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.deaccessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    // Generate unique token for approval link
    const token = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    await Promise.all([
      ctx.db.patch(args.deaccessionId, {
        regulatoryApprovalRequired: true,
        regulatoryApprovalStatus: "requested",
        regulatoryApproverEmail: args.approverEmail,
        regulatoryApproverName: args.approverName,
        regulatoryApprovalRequestedAt: Date.now(),
        regulatoryApprovalToken: token,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: "regulatory_approval_requested",
        entityType: "deaccession",
        entityId: args.deaccessionId,
        changes: {
          approverEmail: args.approverEmail,
          approverName: args.approverName,
        },
      }),
    ]);

    // Note: In production, this URL would be your actual domain
    const approvalUrl = `/api/regulatory-approval/${token}`;

    return { token, approvalUrl };
  },
});

/**
 * Record regulatory approval (can be called via external link or internally)
 */
export const recordRegulatoryApproval = mutation({
  args: {
    deaccessionId: v.optional(v.id("deaccessions")),
    token: v.optional(v.string()),
    approved: v.boolean(),
    notes: v.optional(v.string()),
    documents: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let deaccession: Doc<"deaccessions"> | null = null;

    if (args.deaccessionId) {
      deaccession = await ctx.db.get(args.deaccessionId);
    } else if (args.token) {
      // Find by token for external approval
      deaccession = await ctx.db
        .query("deaccessions")
        .withIndex("by_regulatory_token", (q) =>
          q.eq("regulatoryApprovalToken", args.token),
        )
        .first();
    } else {
      throw new Error("Either deaccessionId or token is required");
    }

    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // If authenticated, check permission
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await requirePermission(
        ctx,
        deaccession.organizationId,
        "collections.update",
      );
    }

    await ctx.db.patch(deaccession._id, {
      regulatoryApprovalStatus: args.approved ? "approved" : "rejected",
      regulatoryApprovalReceivedAt: Date.now(),
      regulatoryApprovalNotes: args.notes,
      regulatoryApprovalDocuments: args.documents,
      regulatoryApprovalToken: undefined, // Clear token after use
    });

    if (userId) {
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: args.approved
          ? "regulatory_approval_granted"
          : "regulatory_approval_denied",
        entityType: "deaccession",
        entityId: deaccession._id,
        changes: { approved: args.approved, notes: args.notes },
      });
    }

    // Notify organization users about the decision
    const userOrgs = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", deaccession.organizationId),
      )
      .collect();

    await Promise.all(
      Array.from(userOrgs).map(async (userOrg) => {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: deaccession.organizationId,
          userId: userOrg.userId,
          type: args.approved
            ? "regulatory_approval_granted"
            : "regulatory_approval_denied",
          title: args.approved
            ? "Regulatory Approval Granted"
            : "Regulatory Approval Denied",
          message: `Regulatory approval for deaccession ${deaccession.deaccessionNumber} has been ${args.approved ? "granted" : "denied"}`,
          relatedEntityType: "deaccession",
          relatedEntityId: deaccession._id,
        });
      }),
    );

    return null;
  },
});

// ============================================
// Valuation/Appraisal Verification
// ============================================

/**
 * Link an appraisal to a deaccession and verify it meets requirements
 */
export const linkAppraisal = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    appraisalId: v.id("appraisals"),
  },
  returns: v.object({
    valid: v.boolean(),
    message: v.string(),
    appraisalAge: v.optional(v.number()), // Age in days
  }),
  handler: async (ctx, args) => {
    const [userId, deaccession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.deaccessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    if (deaccession.status !== "pending") {
      throw new ConvexError(
        "Valuation evidence is linked before the decision; decided records keep their original evidence",
      );
    }

    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    // Verify appraisal belongs to same collection
    if (appraisal.collectionId !== deaccession.collectionId) {
      throw new Error("Appraisal does not belong to the deaccessioned item");
    }

    // Check appraisal age (max 2 years = 730 days)
    const maxAgeMs = 730 * 24 * 60 * 60 * 1000; // 2 years in ms
    const appraisalAge = Date.now() - appraisal.appraisalDate;
    const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));

    const isValid = appraisalAge <= maxAgeMs;

    await ctx.db.patch(args.deaccessionId, {
      appraisalId: args.appraisalId,
      appraisalValue: appraisal.value,
      appraisalDate: appraisal.appraisalDate,
      appraisalVerified: isValid,
      appraisalVerifiedBy: userId,
      appraisalVerifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId,
      action: "appraisal_linked",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: {
        appraisalId: args.appraisalId,
        value: appraisal.value,
        ageDays,
        valid: isValid,
      },
    });

    return {
      valid: isValid,
      message: isValid
        ? `Appraisal is valid (${ageDays} days old)`
        : `Appraisal is too old (${ageDays} days). Maximum age is 730 days (2 years).`,
      appraisalAge: ageDays,
    };
  },
});

/**
 * Get current appraisal for an item
 */
export const getCurrentAppraisal = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("appraisals"),
      appraisalDate: v.number(),
      appraiserName: v.string(),
      appraiserCompany: v.optional(v.string()),
      appraisalType: v.string(),
      value: v.number(),
      currency: v.string(),
      ageDays: v.number(),
      isValid: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    const [, appraisals] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "collections.read"),
      ctx.db
        .query("appraisals")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect(),
    ] as const);

    if (appraisals.length === 0) {
      return null;
    }

    // Sort by date descending and get most recent
    appraisals.sort((a, b) => b.appraisalDate - a.appraisalDate);
    const current = appraisals[0];
    if (!current) {
      return null;
    }

    const maxAgeMs = 730 * 24 * 60 * 60 * 1000;
    const appraisalAge = Date.now() - current.appraisalDate;
    const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));

    return {
      _id: current._id,
      appraisalDate: current.appraisalDate,
      appraiserName: current.appraiserName,
      appraiserCompany: current.appraiserCompany,
      appraisalType: current.appraisalType,
      value: current.value,
      currency: current.currency,
      ageDays,
      isValid: appraisalAge <= maxAgeMs,
    };
  },
});

const disposalCheckValidator = v.object({
  key: v.string(),
  required: v.boolean(),
  passed: v.boolean(),
});

/**
 * Stage-by-stage disposal evidence: the decision checklist (live while
 * pending, the retained snapshot once decided), the physical exit and, for
 * sales, proceeds receipt. Legacy decisions are reported without checks.
 */
export const getDisposalStages = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.union(
    v.object({
      appliesToDisposal: v.boolean(),
      decision: v.object({
        basis: v.union(
          v.literal("pending"),
          v.literal("rejected"),
          v.literal("policy_checked"),
          v.literal("authorized_exception"),
          v.literal("legacy"),
        ),
        ready: v.boolean(),
        checks: v.array(disposalCheckValidator),
        checkedAt: v.optional(v.number()),
        exception: v.optional(
          v.object({
            reason: v.string(),
            waivedCheckKeys: v.array(v.string()),
            authorizedBy: v.id("users"),
            authorizedByName: v.optional(v.string()),
            authorizedAt: v.number(),
          }),
        ),
      }),
      valuation: v.object({
        linkedAppraisalId: v.optional(v.id("appraisals")),
        value: v.optional(v.number()),
        appraisalDate: v.optional(v.number()),
        isCurrent: v.boolean(),
      }),
      exit: v.object({
        state: v.union(
          v.literal("not_applicable"),
          v.literal("awaiting_decision"),
          v.literal("outstanding"),
          v.literal("recorded"),
        ),
        record: v.optional(
          v.object({
            exitDate: v.number(),
            recipient: v.string(),
            reference: v.optional(v.string()),
            notes: v.optional(v.string()),
            recordedByName: v.optional(v.string()),
            recordedAt: v.number(),
          }),
        ),
        correctionCount: v.number(),
      }),
      proceeds: v.object({
        state: v.union(
          v.literal("not_applicable"),
          v.literal("awaiting_decision"),
          v.literal("outstanding"),
          v.literal("recorded"),
          v.literal("verified"),
        ),
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        recipient: v.optional(v.string()),
        date: v.optional(v.number()),
        hasReceipt: v.boolean(),
        verifiedAt: v.optional(v.number()),
        verificationExceptionReason: v.optional(v.string()),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      return null;
    }
    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    const now = Date.now();
    const basis = resolveDecisionBasis(deaccession);
    const review = deaccession.decisionReview;
    const checks =
      basis === "pending"
        ? evaluateDisposalDecisionChecks(deaccession, now)
        : (review?.checks ?? []);
    const userName = async (userId: Id<"users">) => {
      const user = await ctx.db.get(userId);
      return user?.name || user?.username || undefined;
    };
    const [exceptionAuthorName, exitRecorderName] = await Promise.all([
      review?.exception
        ? userName(review.exception.authorizedBy)
        : Promise.resolve(undefined),
      deaccession.exitRecord
        ? userName(deaccession.exitRecord.recordedBy)
        : Promise.resolve(undefined),
    ] as const);

    return {
      appliesToDisposal: isDisposalDecision(deaccession),
      decision: {
        basis,
        ready:
          basis === "pending"
            ? checks.every((check) => !check.required || check.passed)
            : basis !== "rejected",
        checks: checks.map(({ key, required, passed }) => ({
          key,
          required,
          passed,
        })),
        checkedAt: review?.checkedAt,
        exception: review?.exception
          ? {
              ...review.exception,
              authorizedByName: exceptionAuthorName,
            }
          : undefined,
      },
      valuation: {
        linkedAppraisalId: deaccession.appraisalId,
        value: deaccession.appraisalValue,
        appraisalDate: deaccession.appraisalDate,
        isCurrent: hasCurrentValuation(deaccession, now),
      },
      exit: {
        state: resolveExitState(deaccession),
        record: deaccession.exitRecord
          ? {
              exitDate: deaccession.exitRecord.exitDate,
              recipient: deaccession.exitRecord.recipient,
              reference: deaccession.exitRecord.reference,
              notes: deaccession.exitRecord.notes,
              recordedByName: exitRecorderName,
              recordedAt: deaccession.exitRecord.recordedAt,
            }
          : undefined,
        correctionCount: deaccession.exitCorrectionCount ?? 0,
      },
      proceeds: {
        state: resolveProceedsState(deaccession),
        amount: deaccession.proceedsAmount,
        currency: deaccession.proceedsCurrency,
        recipient: deaccession.proceedsRecipient,
        date: deaccession.proceedsDate,
        hasReceipt: deaccession.proceedsReceiptDocument !== undefined,
        verifiedAt: deaccession.proceedsVerifiedAt,
        verificationExceptionReason:
          deaccession.proceedsVerificationException?.reason,
      },
    };
  },
});

/**
 * Check deaccession readiness - validates all requirements are met
 */
export const checkReadiness = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.object({
    ready: v.boolean(),
    checks: v.array(
      v.object({
        name: v.string(),
        passed: v.boolean(),
        message: v.string(),
        required: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    // Decision-stage readiness only. Exit and proceeds evidence belong to
    // later stages and are reported by getDisposalStages.
    const checkCopy: Record<
      DisposalDecisionCheckKey,
      { name: string; passed: string; failed: string }
    > = {
      reason: {
        name: "Reason",
        passed: "Reason recorded",
        failed: "Record the reason for disposal",
      },
      disposition: {
        name: "Intended Disposition",
        passed: "Intended recipient, destination or means recorded",
        failed: "Record the intended recipient, destination or means",
      },
      valuation: {
        name: "Valuation",
        passed: "Current valuation linked",
        failed: "Requires a valuation less than 2 years old",
      },
      regulatory_approval: {
        name: "Regulatory Approval",
        passed: "Regulatory approval received or not required",
        failed: "Awaiting regulatory approval",
      },
    };
    const checks = evaluateDisposalDecisionChecks(deaccession, Date.now()).map(
      (check) => ({
        name: checkCopy[check.key].name,
        passed: check.passed,
        message: check.passed
          ? checkCopy[check.key].passed
          : checkCopy[check.key].failed,
        required: check.required,
      }),
    );

    const requiredChecks = checks.filter((c) => c.required);
    const passedRequired = requiredChecks.filter((c) => c.passed);
    const ready = passedRequired.length === requiredChecks.length;

    return { ready, checks };
  },
});

// ============================================
// BULK EXPORT
// ============================================

/**
 * Bulk export deaccessions data for CSV/Excel export
 */
export const bulkExport = query({
  args: {
    deaccessionIds: v.array(v.id("deaccessions")),
  },
  returns: v.array(
    v.object({
      _id: v.id("deaccessions"),
      deaccessionNumber: v.string(),
      dateDeaccessioned: v.number(),
      reason: v.string(),
      method: v.string(),
      status: v.string(),
      disposition: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionTitle: v.optional(v.string()),
      collectionAccessionNumber: v.optional(v.string()),
      approvedByName: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      workflowStep: v.optional(v.number()),
      proceedsAmount: v.optional(v.number()),
      proceedsCurrency: v.optional(v.string()),
      proceedsRecipient: v.optional(v.string()),
      proceedsVerified: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results: Array<{
      _id: Id<"deaccessions">;
      deaccessionNumber: string;
      dateDeaccessioned: number;
      reason: string;
      method: string;
      status: string;
      disposition?: string;
      notes?: string;
      collectionTitle?: string;
      collectionAccessionNumber?: string;
      approvedByName?: string;
      approvedAt?: number;
      workflowStep?: number;
      proceedsAmount?: number;
      proceedsCurrency?: string;
      proceedsRecipient?: string;
      proceedsVerified?: boolean;
    }> = [];

    await Promise.all(
      Array.from(args.deaccessionIds).map(async (deaccessionId) => {
        const deaccession = await ctx.db.get(deaccessionId);
        if (!deaccession) return;

        await requirePermission(
          ctx,
          deaccession.organizationId,
          "collections.read",
        );

        // Get collection info
        let collectionTitle: string | undefined;
        let collectionAccessionNumber: string | undefined;
        if (deaccession.collectionId) {
          const collection = await ctx.db.get(deaccession.collectionId);
          if (collection) {
            collectionTitle = collection.title;
            collectionAccessionNumber = collection.accessionNumber;
          }
        }

        // Get approver name
        let approvedByName: string | undefined;
        if (deaccession.approvedBy) {
          const approver = await ctx.db.get(deaccession.approvedBy);
          approvedByName = approver?.name ?? approver?.username;
        }

        results.push({
          _id: deaccession._id,
          deaccessionNumber: deaccession.deaccessionNumber,
          dateDeaccessioned: deaccession.dateDeaccessioned,
          reason: deaccession.reason,
          method: deaccession.method,
          status: deaccession.status,
          disposition: deaccession.disposition,
          notes: deaccession.notes,
          collectionTitle,
          collectionAccessionNumber,
          approvedByName,
          approvedAt: deaccession.approvedAt,
          workflowStep: deaccession.workflowStep,
          proceedsAmount: deaccession.proceedsAmount,
          proceedsCurrency: deaccession.proceedsCurrency,
          proceedsRecipient: deaccession.proceedsRecipient,
          proceedsVerified: deaccession.proceedsVerified,
        });
      }),
    );

    return results;
  },
});
