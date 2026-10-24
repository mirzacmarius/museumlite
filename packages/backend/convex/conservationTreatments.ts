import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  readWorkflowHistoryPage,
  workflowHistoryPageValidator,
} from "./auditLog";
import { describeBreach } from "./utils/alertEpisodePolicy";
import { acceptReading } from "./utils/alertEpisodes";
import { batchLookup } from "./utils/batchLookup";
import { appendCaseHistory } from "./utils/caseHistory";
import { conditionAssessmentStatusValidator } from "./utils/conditionAssessmentStatus";
import { conservationError } from "./utils/conservationErrors";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { hasFeatureAccess, requireFeatureAccess } from "./utils/featureGates";
import { countIndexedQuery } from "./utils/indexedCounts";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import {
  requireInOrganization,
  requireMemberOfOrganization,
} from "./utils/organizationScope";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
  hasPermission,
  requirePermission,
  resolveCaseApproval,
} from "./utils/permissions";
import { canReadRecord } from "./utils/recordAccess";
import { claimStorageOwnership } from "./utils/uploadOwnership";
import { workflowApprovalError } from "./utils/workflowApprovalErrors";
import { getWorkflowConfig } from "./utils/workflowConfigs";
import { resolveWorkflowStepState } from "./utils/workflowSteps";

const treatmentTypeValidator = v.union(
  v.literal("routine"),
  v.literal("stabilization"),
  v.literal("restoration"),
  v.literal("cleaning"),
  v.literal("repair"),
  v.literal("assessment"),
  v.literal("other"),
);

const treatmentStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("rejected"),
);

const followUpStatusValidator = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("completed"),
);

const assessmentEvidenceSummary = v.object({
  assessmentId: v.id("conditionAssessments"),
  condition: v.string(),
  summary: v.string(),
  assessedAt: v.number(),
  status: conditionAssessmentStatusValidator,
});

interface TreatmentObject {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
}

/**
 * The assessment when it exists and records this treatment's object; null
 * otherwise, which the evidence panel shows as not linked.
 */
async function getTreatmentAssessment(
  ctx: QueryCtx | MutationCtx,
  treatment: TreatmentObject,
  assessmentId: Id<"conditionAssessments"> | undefined,
) {
  const assessment = assessmentId ? await ctx.db.get(assessmentId) : null;
  if (
    !assessment ||
    assessment.collectionId !== treatment.collectionId ||
    assessment.organizationId !== treatment.organizationId
  ) {
    return null;
  }
  return assessment;
}

async function loadTreatmentAssessment(
  ctx: QueryCtx | MutationCtx,
  treatment: TreatmentObject,
  assessmentId: Id<"conditionAssessments">,
) {
  const assessment = await getTreatmentAssessment(ctx, treatment, assessmentId);
  if (!assessment) {
    throw new Error("Assessment must belong to this treatment object");
  }
  return assessment;
}

const approvalBlockerValidator = v.union(
  v.literal("TREATMENT_BASELINE_REQUIRED"),
  v.null(),
);

const completionBlockerValidator = v.union(
  v.literal("TREATMENT_OUTCOME_REQUIRED"),
  v.literal("TREATMENT_OUTCOME_NOT_ACCEPTED"),
  v.literal("TREATMENT_BASELINE_REQUIRED"),
  v.null(),
);

/**
 * The treatment's linked baseline and outcome assessments, and the evidence
 * each workflow step still lacks. `approve` and `complete` refuse with the
 * blocker, and the evidence panel shows it before staff click.
 */
async function loadAssessmentEvidence(
  ctx: QueryCtx | MutationCtx,
  treatment: Doc<"conservationTreatments">,
) {
  const [baseline, outcome] = await Promise.all([
    getTreatmentAssessment(ctx, treatment, treatment.baselineAssessmentId),
    getTreatmentAssessment(ctx, treatment, treatment.outcomeAssessmentId),
  ] as const);
  const approvalBlocker: Infer<typeof approvalBlockerValidator> = baseline
    ? null
    : "TREATMENT_BASELINE_REQUIRED";
  let completionBlocker: Infer<typeof completionBlockerValidator> = null;
  if (!outcome) {
    completionBlocker = "TREATMENT_OUTCOME_REQUIRED";
  } else if (outcome.status !== "accepted") {
    completionBlocker = "TREATMENT_OUTCOME_NOT_ACCEPTED";
  } else if (!baseline) {
    completionBlocker = "TREATMENT_BASELINE_REQUIRED";
  }
  return { baseline, outcome, approvalBlocker, completionBlocker };
}

async function requireConservationAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireFeatureAccess(ctx, organizationId, "conservation");
}

const TREATMENT_TYPES = treatmentTypeValidator.members.map(
  (member) => member.value,
);

const treatmentListItemValidator = v.object({
  _id: v.id("conservationTreatments"),
  _creationTime: v.number(),
  treatmentType: treatmentTypeValidator,
  title: v.string(),
  description: v.string(),
  performedAt: v.number(),
  performedByName: v.optional(v.string()),
  status: v.optional(treatmentStatusValidator),
  collectionId: v.id("collections"),
  collectionTitle: v.optional(v.string()),
});

async function toTreatmentListItems(
  ctx: QueryCtx,
  treatments: Doc<"conservationTreatments">[],
) {
  const [collections, performers] = await Promise.all([
    batchLookup(
      ctx,
      treatments.map((treatment) => treatment.collectionId),
      "collections",
    ),
    batchLookup(
      ctx,
      treatments.map((treatment) => treatment.performedBy),
      "users",
    ),
  ] as const);
  return treatments.map((treatment) => {
    const performer = performers.get(treatment.performedBy);
    return {
      notes: treatment.notes,
      item: {
        _id: treatment._id,
        _creationTime: treatment._creationTime,
        treatmentType: treatment.treatmentType,
        title: treatment.title,
        description: treatment.description,
        performedAt: treatment.performedAt,
        performedByName:
          treatment.performedByName || performer?.name || performer?.email,
        status: treatment.status,
        collectionId: treatment.collectionId,
        collectionTitle: collections.get(treatment.collectionId)?.title,
      },
    };
  });
}

function queryTreatments(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  {
    status,
    treatmentType,
  }: {
    status?: Doc<"conservationTreatments">["status"];
    treatmentType?: Doc<"conservationTreatments">["treatmentType"];
  },
) {
  const treatments = ctx.db.query("conservationTreatments");
  if (status && treatmentType) {
    return treatments.withIndex(
      "by_organization_and_status_and_treatmentType",
      (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("status", status)
          .eq("treatmentType", treatmentType),
    );
  }
  if (status) {
    return treatments.withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", status),
    );
  }
  if (treatmentType) {
    return treatments.withIndex("by_organization_and_treatmentType", (q) =>
      q.eq("organizationId", organizationId).eq("treatmentType", treatmentType),
    );
  }
  return treatments.withIndex("by_organization", (q) =>
    q.eq("organizationId", organizationId),
  );
}

/**
 * One page of an organization's treatments, newest first, optionally limited
 * to a treatment type and a status. A search keeps the rows of the page whose
 * title, description, notes, object or performer contain it, so a page can
 * hold fewer rows than requested while more remain.
 */
export const listPage = query({
  args: {
    organizationId: v.id("organizations"),
    treatmentType: v.optional(treatmentTypeValidator),
    status: v.optional(treatmentStatusValidator),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(treatmentListItemValidator),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const result = await queryTreatments(ctx, args.organizationId, args)
      .order("desc")
      .paginate(args.paginationOpts);

    const search = args.search?.trim().toLowerCase();
    const rows = await toTreatmentListItems(ctx, result.page);
    return {
      ...result,
      page: rows.flatMap(({ item, notes }) =>
        !search ||
        [
          item.title,
          item.description,
          notes,
          item.collectionTitle,
          item.performedByName,
        ].some((value) => value?.toLowerCase().includes(search))
          ? [item]
          : [],
      ),
    };
  },
});

/** Exact treatment totals, overall and per type, for the list filters. */
export const getListCounts = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(treatmentStatusValidator),
  },
  returns: v.object({
    total: v.number(),
    byType: v.array(
      v.object({ treatmentType: treatmentTypeValidator, count: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const counts = await Promise.all(
      TREATMENT_TYPES.map(async (treatmentType) => ({
        treatmentType,
        count: await countIndexedQuery(
          queryTreatments(ctx, args.organizationId, {
            status: args.status,
            treatmentType,
          }),
        ),
      })),
    );
    const byType = counts.filter((entry) => entry.count > 0);
    return {
      total: byType.reduce((total, entry) => total + entry.count, 0),
      byType,
    };
  },
});

export const get = query({
  args: {
    // A string, so malformed links and other tables' IDs read as missing.
    id: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("conservationTreatments"),
      _creationTime: v.number(),
      treatmentType: treatmentTypeValidator,
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedBy: v.id("users"),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
      status: v.optional(treatmentStatusValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const treatmentId = ctx.db.normalizeId("conservationTreatments", args.id);
    const treatment = treatmentId ? await ctx.db.get(treatmentId) : null;
    if (
      !treatment ||
      !(await canReadRecord(ctx, treatment.organizationId, "collections.read", {
        capability: "conservation",
      }))
    ) {
      return null;
    }

    const [collection, user] = await Promise.all([
      ctx.db.get(treatment.collectionId),
      ctx.db.get(treatment.performedBy),
    ] as const);
    return {
      _id: treatment._id,
      _creationTime: treatment._creationTime,
      treatmentType: treatment.treatmentType,
      title: treatment.title,
      description: treatment.description,
      performedAt: treatment.performedAt,
      performedBy: treatment.performedBy,
      performedByName: treatment.performedByName || user?.name || user?.email,
      notes: treatment.notes,
      collectionId: treatment.collectionId,
      organizationId: treatment.organizationId,
      collectionTitle: collection?.title,
      status: treatment.status,
    };
  },
});

export const getTreatmentEvidence = query({
  args: { treatmentId: v.id("conservationTreatments") },
  returns: v.object({
    treatmentId: v.id("conservationTreatments"),
    collectionId: v.id("collections"),
    status: v.optional(treatmentStatusValidator),
    baseline: v.union(assessmentEvidenceSummary, v.null()),
    outcome: v.union(assessmentEvidenceSummary, v.null()),
    comparison: v.object({
      baselineCondition: v.union(v.string(), v.null()),
      outcomeCondition: v.union(v.string(), v.null()),
    }),
    followUp: v.object({
      status: followUpStatusValidator,
      notes: v.optional(v.string()),
      dueAt: v.optional(v.number()),
    }),
    attachmentCount: v.number(),
    approvalBlocker: approvalBlockerValidator,
    completionBlocker: completionBlockerValidator,
  }),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    await Promise.all([
      requireConservationAccess(ctx, treatment.organizationId),
      requirePermission(ctx, treatment.organizationId, "collections.read"),
    ]);

    const summarize = (assessment: Doc<"conditionAssessments"> | null) =>
      assessment && {
        assessmentId: assessment._id,
        condition: assessment.condition,
        summary: assessment.summary,
        assessedAt: assessment.assessedAt,
        status: assessment.status,
      };

    const [evidence, attachments] = await Promise.all([
      loadAssessmentEvidence(ctx, treatment),
      ctx.db
        .query("conservationAttachments")
        .withIndex("by_treatment", (q) => q.eq("treatmentId", args.treatmentId))
        .collect(),
    ] as const);
    const baseline = summarize(evidence.baseline);
    const outcome = summarize(evidence.outcome);

    return {
      treatmentId: treatment._id,
      collectionId: treatment.collectionId,
      status: treatment.status,
      baseline,
      outcome,
      comparison: {
        baselineCondition: baseline?.condition ?? null,
        outcomeCondition: outcome?.condition ?? null,
      },
      followUp: {
        status: treatment.followUpStatus ?? "none",
        notes: treatment.followUpNotes,
        dueAt: treatment.followUpDueAt,
      },
      attachmentCount: attachments.length,
      approvalBlocker: evidence.approvalBlocker,
      completionBlocker: evidence.completionBlocker,
    };
  },
});

export const linkBaselineAssessment = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    assessmentId: v.id("conditionAssessments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }
    if (treatment.status === "completed" || treatment.status === "rejected") {
      throw new Error("Cannot change baseline on a closed treatment");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );
    await loadTreatmentAssessment(ctx, treatment, args.assessmentId);

    await ctx.db.patch(args.treatmentId, {
      baselineAssessmentId: args.assessmentId,
    });
    return null;
  },
});

export const linkOutcomeAssessment = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    assessmentId: v.id("conditionAssessments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }
    if (treatment.status === "completed" || treatment.status === "rejected") {
      throw new Error("Cannot change outcome on a closed treatment");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );
    await loadTreatmentAssessment(ctx, treatment, args.assessmentId);

    await ctx.db.patch(args.treatmentId, {
      outcomeAssessmentId: args.assessmentId,
    });
    return null;
  },
});

export const setFollowUp = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    status: followUpStatusValidator,
    notes: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    if (args.status !== "none" && treatment.status !== "completed") {
      throw new Error(
        "Follow-up can only be scheduled after treatment completion",
      );
    }
    if (args.dueAt !== undefined && !Number.isFinite(args.dueAt)) {
      throw new Error("Follow-up due date must be valid");
    }

    await ctx.db.patch(args.treatmentId, {
      followUpStatus: args.status,
      followUpNotes: args.notes?.trim() || undefined,
      followUpDueAt: args.dueAt,
    });
    return null;
  },
});

export const update = mutation({
  args: {
    id: v.id("conservationTreatments"),
    treatmentType: v.optional(treatmentTypeValidator),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    performedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.id),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    if (treatment.status === "completed" || treatment.status === "rejected") {
      throw new Error("Cannot update completed or rejected treatment");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await Promise.all([
      ctx.db.patch(args.id, filteredUpdates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: treatment.organizationId,
        userId,
        action: "updated",
        entityType: "conservationTreatment",
        entityId: args.id,
        changes: filteredUpdates,
      }),
    ]);

    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("conservationTreatments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.id),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    if (treatment.status === "in_progress") {
      throw new Error("Cannot delete treatment in progress");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.delete",
    );

    return rejectPermanentEvidenceDeletion();
  },
});

/**
 * List conservation treatments for a collection
 */
export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationTreatments"),
      treatmentType: v.union(
        v.literal("routine"),
        v.literal("stabilization"),
        v.literal("restoration"),
        v.literal("cleaning"),
        v.literal("repair"),
        v.literal("assessment"),
        v.literal("other"),
      ),
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    const hasConservationFeature = await hasFeatureAccess(
      ctx,
      collection.organizationId,
      "conservation",
    );
    if (!hasConservationFeature) {
      return [];
    }

    const canReadCollections = await hasPermission(
      ctx,
      collection.organizationId,
      "collections.read",
    );
    if (!canReadCollections) {
      return [];
    }

    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .collect();

    // Enrich with performer names
    const enrichedTreatments = await Promise.all(
      treatments.map(async (treatment) => {
        const user = await ctx.db.get(treatment.performedBy);
        return {
          _id: treatment._id,
          treatmentType: treatment.treatmentType,
          title: treatment.title,
          description: treatment.description,
          performedAt: treatment.performedAt,
          performedByName:
            treatment.performedByName || user?.name || user?.email,
          notes: treatment.notes,
        };
      }),
    );

    return enrichedTreatments;
  },
});

/**
 * Create a conservation treatment record
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    treatmentType: v.union(
      v.literal("routine"),
      v.literal("stabilization"),
      v.literal("restoration"),
      v.literal("cleaning"),
      v.literal("repair"),
      v.literal("assessment"),
      v.literal("other"),
    ),
    title: v.string(),
    description: v.string(),
    performedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("conservationTreatments"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    const canInitiate = await canInitiateWorkflow(
      ctx,
      collection.organizationId,
      "conservation",
    );

    if (!canInitiate) {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.update",
      );
    }

    const [user, workflowConfig] = await Promise.all([
      ctx.db.get(userId),
      getWorkflowConfig(ctx, collection.organizationId, "conservation"),
    ] as const);
    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      undefined,
    );

    if (workflowConfig && workflowState.firstStep === undefined) {
      throw workflowApprovalError(
        "WORKFLOW_NOT_CONFIGURED",
        "Workflow has no approval steps configured",
      );
    }

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

    let baselineAssessmentId: Id<"conditionAssessments"> | undefined;
    if (collection.currentConditionAssessmentId) {
      const baseline = await ctx.db.get(
        collection.currentConditionAssessmentId,
      );
      if (
        baseline?.status === "accepted" &&
        baseline.collectionId === args.collectionId
      ) {
        baselineAssessmentId = baseline._id;
      }
    }

    const treatmentId = await ctx.db.insert("conservationTreatments", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      treatmentType: args.treatmentType,
      title: args.title,
      description: args.description,
      performedBy: userId,
      performedByName: user?.name || user?.email || undefined,
      performedAt: args.performedAt ?? Date.now(),
      notes: args.notes,
      status: workflowConfig ? "proposed" : "approved",
      workflowStep: workflowConfig ? (workflowState.firstStep ?? 1) : undefined,
      workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
      createdBy: userId,
      baselineAssessmentId,
      followUpStatus: "none",
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "conservationTreatment",
      entityId: treatmentId,
      changes: {
        title: args.title,
        status: workflowConfig ? "proposed" : "approved",
      },
    });

    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        collection.organizationId,
        "conservation",
        workflowState.firstStep ?? 1,
      );

      await dispatchNotification(ctx, {
        organizationId: collection.organizationId,
        type: "workflow_pending",
        recipients: usersToNotify.filter((approverId) => approverId !== userId),
        title: "New Conservation Treatment Requires Approval",
        message: `Conservation treatment "${args.title}" is pending your approval at step ${workflowState.firstStep ?? 1}.`,
        related: { entityType: "conservationTreatment", entityId: treatmentId },
      });
    }

    return treatmentId;
  },
});

export const approve = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "proposed") {
      throw conservationError(
        "TREATMENT_STATUS_CHANGED",
        "Treatment is not pending approval",
      );
    }

    const approval = await resolveCaseApproval(
      ctx,
      treatment.organizationId,
      "conservation",
      treatment.workflowStep,
    );
    if (!approval.allowed) {
      throw approval.refusal;
    }

    const { approvalBlocker } = await loadAssessmentEvidence(ctx, treatment);
    if (approvalBlocker) {
      throw conservationError(
        approvalBlocker,
        "Assessment evidence is incomplete for approval",
      );
    }

    if (approval.workflow) {
      const { state: workflowState, currentStep } = approval.workflow;

      const history = [...(treatment.workflowHistory ?? [])];
      if (!workflowState.isPastLastStep) {
        history.push({
          step: currentStep,
          approvedBy: userId,
          approvedAt: Date.now(),
          comment: args.comment,
        });
      }

      const isLastStep =
        workflowState.isPastLastStep || workflowState.isLastStep;

      if (isLastStep) {
        await Promise.all([
          ctx.db.patch(args.treatmentId, {
            status: "approved",
            approvedBy: userId,
            approvedAt: Date.now(),
            ...(await appendCaseHistory(
              ctx,
              treatment,
              "conservation",
              history,
            )),
          }),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: treatment.organizationId,
            userId,
            action: "approved",
            entityType: "conservationTreatment",
            entityId: args.treatmentId,
            changes: { status: "approved", step: currentStep },
          }),
        ]);

        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await dispatchNotification(ctx, {
            organizationId: treatment.organizationId,
            type: "workflow_approved",
            recipients: [creatorId],
            title: "Conservation Treatment Approved",
            message: `Conservation treatment "${treatment.title}" has been approved.`,
            related: {
              entityType: "conservationTreatment",
              entityId: args.treatmentId,
            },
          });
        }
      } else {
        const nextStep = workflowState.nextStep;
        if (nextStep === undefined) {
          throw workflowApprovalError(
            "WORKFLOW_NOT_CONFIGURED",
            "Next workflow step is not configured",
          );
        }
        const [, usersToNotify] = await Promise.all([
          Promise.all([
            ctx.db.patch(args.treatmentId, {
              workflowStep: nextStep,
              ...(await appendCaseHistory(
                ctx,
                treatment,
                "conservation",
                history,
              )),
            }),
            ctx.runMutation(internal.audit.logAction, {
              organizationId: treatment.organizationId,
              userId,
              action: "step_approved",
              entityType: "conservationTreatment",
              entityId: args.treatmentId,
              changes: { step: currentStep, nextStep },
            }),
          ]),
          getUsersToNotifyForWorkflowStep(
            ctx,
            treatment.organizationId,
            "conservation",
            nextStep,
          ),
        ] as const);

        await dispatchNotification(ctx, {
          organizationId: treatment.organizationId,
          type: "workflow_pending",
          recipients: usersToNotify.filter(
            (approverId) => approverId !== userId,
          ),
          title: "Conservation Treatment Requires Your Approval",
          message: `Conservation treatment "${treatment.title}" is pending your approval at step ${nextStep}.`,
          related: {
            entityType: "conservationTreatment",
            entityId: args.treatmentId,
          },
        });
      }
    } else {
      await Promise.all([
        ctx.db.patch(args.treatmentId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: treatment.organizationId,
          userId,
          action: "approved",
          entityType: "conservationTreatment",
          entityId: args.treatmentId,
          changes: { status: "approved" },
        }),
      ] as const);
    }

    return null;
  },
});

export const reject = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "proposed") {
      throw conservationError(
        "TREATMENT_STATUS_CHANGED",
        "Treatment is not pending approval",
      );
    }

    const workflowConfig = await getWorkflowConfig(
      ctx,
      treatment.organizationId,
      "conservation",
    );
    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      treatment.workflowStep,
    );
    const currentStep =
      workflowState.currentStep ?? treatment.workflowStep ?? 1;
    const canApprove = await canApproveAtStep(
      ctx,
      treatment.organizationId,
      "conservation",
      currentStep,
    );

    if (!canApprove) {
      await requirePermission(
        ctx,
        treatment.organizationId,
        "collections.update",
      );
    }

    const history = [...(treatment.workflowHistory ?? [])];
    history.push({
      step: currentStep,
      approvedBy: userId,
      approvedAt: Date.now(),
      comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
    });

    await Promise.all([
      ctx.db.patch(args.treatmentId, {
        status: "rejected",
        ...(await appendCaseHistory(ctx, treatment, "conservation", history)),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: treatment.organizationId,
        userId,
        action: "rejected",
        entityType: "conservationTreatment",
        entityId: args.treatmentId,
        changes: { status: "rejected", comment: args.comment },
      }),
    ]);

    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await dispatchNotification(ctx, {
        organizationId: treatment.organizationId,
        type: "workflow_rejected",
        recipients: [creatorId],
        title: "Conservation Treatment Rejected",
        message: `Conservation treatment "${treatment.title}" has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        related: {
          entityType: "conservationTreatment",
          entityId: args.treatmentId,
        },
      });
    }

    return null;
  },
});

export const startProgress = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "approved") {
      throw conservationError(
        "TREATMENT_STATUS_CHANGED",
        "Treatment must be approved before starting",
      );
    }
    await Promise.all([
      requirePermission(ctx, treatment.organizationId, "collections.update"),
      ctx.db.patch(args.treatmentId, {
        status: "in_progress",
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: treatment.organizationId,
        userId,
        action: "started",
        entityType: "conservationTreatment",
        entityId: args.treatmentId,
        changes: { status: "in_progress" },
      }),
    ] as const);

    return null;
  },
});

export const complete = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "in_progress" && treatment.status !== "approved") {
      throw conservationError(
        "TREATMENT_STATUS_CHANGED",
        "Treatment must be approved or in progress to complete",
      );
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    const { completionBlocker } = await loadAssessmentEvidence(ctx, treatment);
    if (completionBlocker) {
      throw conservationError(
        completionBlocker,
        "Assessment evidence is incomplete for completion",
      );
    }

    const updates: {
      status: "completed";
      notes?: string;
      performedAt: number;
    } = {
      status: "completed",
      performedAt: Date.now(),
    };

    if (args.notes) {
      updates.notes = treatment.notes
        ? `${treatment.notes}\n\nCompletion notes: ${args.notes}`
        : args.notes;
    }

    await Promise.all([
      ctx.db.patch(args.treatmentId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: treatment.organizationId,
        userId,
        action: "completed",
        entityType: "conservationTreatment",
        entityId: args.treatmentId,
        changes: { status: "completed" },
      }),
    ]);

    return null;
  },
});

export const getWorkflowHistory = query({
  args: {
    treatmentId: v.id("conservationTreatments"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: workflowHistoryPageValidator,
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    await Promise.all([
      requireConservationAccess(ctx, treatment.organizationId),
      requirePermission(ctx, treatment.organizationId, "collections.read"),
    ]);

    return await readWorkflowHistoryPage(ctx, {
      organizationId: treatment.organizationId,
      caseType: "conservation",
      entityId: args.treatmentId,
      cursor: args.cursor,
      limit: args.limit,
    });
  },
});

// ============================================
// ATTACHMENT FUNCTIONS (MUS-337)
// ============================================

const attachmentTypeValidator = v.union(
  v.literal("before_photo"),
  v.literal("after_photo"),
  v.literal("during_photo"),
  v.literal("report"),
  v.literal("lab_notes"),
  v.literal("x_ray"),
  v.literal("uv_photo"),
  v.literal("microscopy"),
  v.literal("other"),
);

export const addAttachment = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    attachmentType: attachmentTypeValidator,
    caption: v.optional(v.string()),
    notes: v.optional(v.string()),
    takenAt: v.optional(v.number()),
  },
  returns: v.id("conservationAttachments"),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Treatment not found");
    }
    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );
    const attachmentId = await ctx.db.insert("conservationAttachments", {
      organizationId: treatment.organizationId,
      treatmentId: args.treatmentId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      attachmentType: args.attachmentType,
      caption: args.caption,
      notes: args.notes,
      takenAt: args.takenAt,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });
    await claimStorageOwnership(ctx, {
      storageId: args.storageId,
      organizationId: treatment.organizationId,
      uploadedBy: userId,
      ownerType: "conservationAttachment",
      ownerId: attachmentId,
      expectedFileSize: args.fileSize,
      expectedMimeType: args.fileType,
    });

    return attachmentId;
  },
});

export const removeAttachment = mutation({
  args: {
    attachmentId: v.id("conservationAttachments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, attachment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.attachmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!attachment) {
      throw new Error("Attachment not found");
    }
    await requirePermission(
      ctx,
      attachment.organizationId,
      "collections.update",
    );
    return rejectPermanentEvidenceDeletion();
  },
});

export const listAttachments = query({
  args: {
    treatmentId: v.id("conservationTreatments"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAttachments"),
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      attachmentType: attachmentTypeValidator,
      caption: v.optional(v.string()),
      notes: v.optional(v.string()),
      takenAt: v.optional(v.number()),
      uploadedBy: v.id("users"),
      uploadedByName: v.optional(v.string()),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      return [];
    }
    await Promise.all([
      requireConservationAccess(ctx, treatment.organizationId),
      requirePermission(ctx, treatment.organizationId, "collections.read"),
    ]);
    const attachments = await ctx.db
      .query("conservationAttachments")
      .withIndex("by_treatment", (q) => q.eq("treatmentId", args.treatmentId))
      .collect();

    return Promise.all(
      attachments.map(async (attachment) => {
        const [url, user] = await Promise.all([
          ctx.storage.getUrl(attachment.storageId),
          ctx.db.get(attachment.uploadedBy),
        ] as const);
        return {
          _id: attachment._id,
          storageId: attachment.storageId,
          url,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          attachmentType: attachment.attachmentType,
          caption: attachment.caption,
          notes: attachment.notes,
          takenAt: attachment.takenAt,
          uploadedBy: attachment.uploadedBy,
          uploadedByName: user?.name || user?.email,
          uploadedAt: attachment.uploadedAt,
        };
      }),
    );
  },
});

export const getAttachmentsByType = query({
  args: {
    treatmentId: v.id("conservationTreatments"),
    attachmentType: attachmentTypeValidator,
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAttachments"),
      url: v.union(v.string(), v.null()),
      fileName: v.string(),
      caption: v.optional(v.string()),
      takenAt: v.optional(v.number()),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      return [];
    }
    await Promise.all([
      requireConservationAccess(ctx, treatment.organizationId),
      requirePermission(ctx, treatment.organizationId, "collections.read"),
    ]);
    const attachments = await ctx.db
      .query("conservationAttachments")
      .withIndex("by_treatment_and_type", (q) =>
        q
          .eq("treatmentId", args.treatmentId)
          .eq("attachmentType", args.attachmentType),
      )
      .collect();

    return Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          _id: attachment._id,
          url,
          fileName: attachment.fileName,
          caption: attachment.caption,
          takenAt: attachment.takenAt,
          uploadedAt: attachment.uploadedAt,
        };
      }),
    );
  },
});

// ============================================
// ALERT RULE FUNCTIONS (MUS-338)
// ============================================

const triggerTypeValidator = v.union(
  v.literal("condition_threshold"),
  v.literal("treatment_overdue"),
  v.literal("assessment_due"),
  v.literal("urgent_treatment"),
  v.literal("environmental"),
);

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

/** Alert recipients must be roles and members of the rule's organization. */
async function requireAlertRecipients(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  recipients: {
    notifyRoles?: Id<"roles">[];
    notifyUsers?: Id<"users">[];
  },
) {
  for (const roleId of recipients.notifyRoles ?? []) {
    await requireInOrganization(ctx, roleId, organizationId, "Role");
  }
  for (const userId of recipients.notifyUsers ?? []) {
    await requireMemberOfOrganization(ctx, userId, organizationId, "Recipient");
  }
}

export const createAlertRule = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerType: triggerTypeValidator,
    conditionThreshold: v.optional(v.string()),
    daysOverdue: v.optional(v.number()),
    assessmentIntervalDays: v.optional(v.number()),
    priority: priorityValidator,
    notifyRoles: v.optional(v.array(v.id("roles"))),
    notifyUsers: v.optional(v.array(v.id("users"))),
    emailNotification: v.boolean(),
    inAppNotification: v.boolean(),
  },
  returns: v.id("conservationAlertRules"),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireConservationAccess(ctx, args.organizationId),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await requireAlertRecipients(ctx, args.organizationId, args);
    const ruleId = await ctx.db.insert("conservationAlertRules", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      triggerType: args.triggerType,
      conditionThreshold: args.conditionThreshold,
      daysOverdue: args.daysOverdue,
      assessmentIntervalDays: args.assessmentIntervalDays,
      priority: args.priority,
      notifyRoles: args.notifyRoles,
      notifyUsers: args.notifyUsers,
      emailNotification: args.emailNotification,
      inAppNotification: args.inAppNotification,
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "conservationAlertRule",
      entityId: ruleId,
      changes: { name: args.name, triggerType: args.triggerType },
    });

    return ruleId;
  },
});

export const updateAlertRule = mutation({
  args: {
    ruleId: v.id("conservationAlertRules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    triggerType: v.optional(triggerTypeValidator),
    conditionThreshold: v.optional(v.string()),
    daysOverdue: v.optional(v.number()),
    assessmentIntervalDays: v.optional(v.number()),
    priority: v.optional(priorityValidator),
    notifyRoles: v.optional(v.array(v.id("roles"))),
    notifyUsers: v.optional(v.array(v.id("users"))),
    emailNotification: v.optional(v.boolean()),
    inAppNotification: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, rule] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.ruleId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!rule) {
      throw new Error("Alert rule not found");
    }

    await Promise.all([
      requireConservationAccess(ctx, rule.organizationId),
      requirePermission(
        ctx,
        rule.organizationId,
        "organization.manage_settings",
      ),
    ]);

    await requireAlertRecipients(ctx, rule.organizationId, args);

    const { ruleId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await Promise.all([
      ctx.db.patch(args.ruleId, {
        ...filteredUpdates,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: rule.organizationId,
        userId,
        action: "updated",
        entityType: "conservationAlertRule",
        entityId: args.ruleId,
        changes: filteredUpdates,
      }),
    ]);

    return null;
  },
});

export const deleteAlertRule = mutation({
  args: {
    ruleId: v.id("conservationAlertRules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, rule] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.ruleId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!rule) {
      throw new Error("Alert rule not found");
    }
    await Promise.all([
      requireConservationAccess(ctx, rule.organizationId),
      requirePermission(
        ctx,
        rule.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.patch(args.ruleId, { isActive: false }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: rule.organizationId,
        userId,
        action: "deactivated",
        entityType: "conservationAlertRule",
        entityId: args.ruleId,
        changes: { name: rule.name },
      }),
    ] as const);

    return null;
  },
});

export const listAlertRules = query({
  args: {
    organizationId: v.id("organizations"),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAlertRules"),
      name: v.string(),
      description: v.optional(v.string()),
      triggerType: triggerTypeValidator,
      conditionThreshold: v.optional(v.string()),
      daysOverdue: v.optional(v.number()),
      assessmentIntervalDays: v.optional(v.number()),
      priority: priorityValidator,
      emailNotification: v.boolean(),
      inAppNotification: v.boolean(),
      isActive: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    return args.activeOnly
      ? ctx.db
          .query("conservationAlertRules")
          .withIndex("by_organization_and_active", (q) =>
            q.eq("organizationId", args.organizationId).eq("isActive", true),
          )
          .collect()
      : ctx.db
          .query("conservationAlertRules")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect();
  },
});

// ============================================
// ALERT FUNCTIONS (MUS-338)
// ============================================

const alertTypeValidator = v.union(
  v.literal("condition_degraded"),
  v.literal("treatment_overdue"),
  v.literal("assessment_due"),
  v.literal("urgent_treatment"),
  v.literal("environmental_alert"),
  v.literal("manual"),
);

const alertStatusValidator = v.union(
  v.literal("active"),
  v.literal("acknowledged"),
  v.literal("resolved"),
  v.literal("dismissed"),
);

export const createAlert = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    treatmentId: v.optional(v.id("conservationTreatments")),
    alertType: alertTypeValidator,
    title: v.string(),
    description: v.string(),
    priority: priorityValidator,
  },
  returns: v.id("conservationAlerts"),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.update"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const alertId = await ctx.db.insert("conservationAlerts", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      treatmentId: args.treatmentId,
      alertType: args.alertType,
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "conservationAlert",
      entityId: alertId,
      changes: { title: args.title, priority: args.priority },
    });

    return alertId;
  },
});

export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("conservationAlerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, alert] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.alertId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.status !== "active") {
      throw new Error("Alert is not active");
    }
    await Promise.all([
      requireConservationAccess(ctx, alert.organizationId),
      requirePermission(ctx, alert.organizationId, "collections.update"),
      ctx.db.patch(args.alertId, {
        status: "acknowledged",
        acknowledgedBy: userId,
        acknowledgedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: alert.organizationId,
        userId,
        action: "acknowledged",
        entityType: "conservationAlert",
        entityId: args.alertId,
        changes: { title: alert.title },
      }),
    ] as const);

    return null;
  },
});

export const resolveAlert = mutation({
  args: {
    alertId: v.id("conservationAlerts"),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, alert] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.alertId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.status === "resolved" || alert.status === "dismissed") {
      throw new Error("Alert is already closed");
    }
    await Promise.all([
      requireConservationAccess(ctx, alert.organizationId),
      requirePermission(ctx, alert.organizationId, "collections.update"),
      ctx.db.patch(args.alertId, {
        status: "resolved",
        resolvedBy: userId,
        resolvedAt: Date.now(),
        resolutionNotes: args.resolutionNotes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: alert.organizationId,
        userId,
        action: "resolved",
        entityType: "conservationAlert",
        entityId: args.alertId,
        changes: { title: alert.title, resolutionNotes: args.resolutionNotes },
      }),
    ] as const);

    return null;
  },
});

export const dismissAlert = mutation({
  args: {
    alertId: v.id("conservationAlerts"),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, alert] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.alertId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.status === "resolved" || alert.status === "dismissed") {
      throw new Error("Alert is already closed");
    }
    await Promise.all([
      requireConservationAccess(ctx, alert.organizationId),
      requirePermission(ctx, alert.organizationId, "collections.update"),
      ctx.db.patch(args.alertId, {
        status: "dismissed",
        resolvedBy: userId,
        resolvedAt: Date.now(),
        resolutionNotes: args.resolutionNotes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: alert.organizationId,
        userId,
        action: "dismissed",
        entityType: "conservationAlert",
        entityId: args.alertId,
        changes: { title: alert.title },
      }),
    ] as const);

    return null;
  },
});

export const listAlerts = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(alertStatusValidator),
    priority: v.optional(priorityValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAlerts"),
      collectionId: v.optional(v.id("collections")),
      collectionTitle: v.optional(v.string()),
      treatmentId: v.optional(v.id("conservationTreatments")),
      treatmentTitle: v.optional(v.string()),
      alertType: alertTypeValidator,
      title: v.string(),
      description: v.string(),
      priority: priorityValidator,
      status: alertStatusValidator,
      acknowledgedAt: v.optional(v.number()),
      resolvedAt: v.optional(v.number()),
      resolutionNotes: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    const limit = args.limit ?? 100;

    const baseQuery = args.status
      ? ctx.db
          .query("conservationAlerts")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("conservationAlerts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const filteredQuery = args.priority
      ? baseQuery.filter((q) => q.eq(q.field("priority"), args.priority!))
      : baseQuery;

    const alerts = await filteredQuery.order("desc").take(limit);

    return Promise.all(
      alerts.map(async (alert) => {
        const collection = alert.collectionId
          ? await ctx.db.get(alert.collectionId)
          : null;
        const treatment = alert.treatmentId
          ? await ctx.db.get(alert.treatmentId)
          : null;

        return {
          _id: alert._id,
          collectionId: alert.collectionId,
          collectionTitle: collection?.title,
          treatmentId: alert.treatmentId,
          treatmentTitle: treatment?.title,
          alertType: alert.alertType,
          title: alert.title,
          description: alert.description,
          priority: alert.priority,
          status: alert.status,
          acknowledgedAt: alert.acknowledgedAt,
          resolvedAt: alert.resolvedAt,
          resolutionNotes: alert.resolutionNotes,
          createdAt: alert.createdAt,
        };
      }),
    );
  },
});

export const getActiveAlerts = query({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    treatmentId: v.optional(v.id("conservationTreatments")),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAlerts"),
      alertType: alertTypeValidator,
      title: v.string(),
      priority: priorityValidator,
      status: alertStatusValidator,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    let alertsQuery = ctx.db
      .query("conservationAlerts")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      );

    if (args.collectionId) {
      alertsQuery = alertsQuery.filter((q) =>
        q.eq(q.field("collectionId"), args.collectionId!),
      );
    }

    if (args.treatmentId) {
      alertsQuery = alertsQuery.filter((q) =>
        q.eq(q.field("treatmentId"), args.treatmentId!),
      );
    }

    const alerts = await alertsQuery.collect();

    return alerts.map((alert) => ({
      _id: alert._id,
      alertType: alert.alertType,
      title: alert.title,
      priority: alert.priority,
      status: alert.status,
      createdAt: alert.createdAt,
    }));
  },
});

export const getAlertsByPriority = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    critical: v.number(),
    high: v.number(),
    medium: v.number(),
    low: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const activeAlerts = await ctx.db
      .query("conservationAlerts")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .collect();

    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: activeAlerts.length,
    };

    for (const alert of activeAlerts) {
      counts[alert.priority]++;
    }

    return counts;
  },
});

// ============================================
// INTERNAL CRON FUNCTIONS
// ============================================

export const checkOverdueTreatmentsInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const now = Date.now();

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const rules = await ctx.db
          .query("conservationAlertRules")
          .withIndex("by_organization_and_active", (q) =>
            q.eq("organizationId", org._id).eq("isActive", true),
          )
          .filter((q) => q.eq(q.field("triggerType"), "treatment_overdue"))
          .collect();

        await Promise.all(
          rules.map(async (rule) => {
            const daysOverdue = rule.daysOverdue ?? 7;
            const threshold = now - daysOverdue * 24 * 60 * 60 * 1000;

            const overdueTreatments = await ctx.db
              .query("conservationTreatments")
              .withIndex("by_organization_and_status", (q) =>
                q.eq("organizationId", org._id).eq("status", "approved"),
              )
              .filter((q) => q.lt(q.field("performedAt"), threshold))
              .collect();

            await Promise.all(
              overdueTreatments.map(async (treatment) => {
                const existingAlert = await ctx.db
                  .query("conservationAlerts")
                  .withIndex("by_treatment", (q) =>
                    q.eq("treatmentId", treatment._id),
                  )
                  .filter((q) =>
                    q.and(
                      q.eq(q.field("alertType"), "treatment_overdue"),
                      q.eq(q.field("status"), "active"),
                    ),
                  )
                  .first();

                if (existingAlert) {
                  return;
                }

                if (!rule.inAppNotification) {
                  await ctx.db.insert("conservationAlerts", {
                    organizationId: org._id,
                    ruleId: rule._id,
                    treatmentId: treatment._id,
                    collectionId: treatment.collectionId,
                    alertType: "treatment_overdue",
                    title: `Overdue Treatment: ${treatment.title}`,
                    description: `Treatment "${treatment.title}" has been approved but not started for over ${daysOverdue} days.`,
                    priority: rule.priority,
                    status: "active",
                    createdAt: now,
                  });
                  return;
                }

                const alertId = await ctx.db.insert("conservationAlerts", {
                  organizationId: org._id,
                  ruleId: rule._id,
                  treatmentId: treatment._id,
                  collectionId: treatment.collectionId,
                  alertType: "treatment_overdue",
                  title: `Overdue Treatment: ${treatment.title}`,
                  description: `Treatment "${treatment.title}" has been approved but not started for over ${daysOverdue} days.`,
                  priority: rule.priority,
                  status: "active",
                  createdAt: now,
                });

                const usersToNotify: Array<Id<"users">> = [];

                if (rule.notifyUsers?.length) {
                  usersToNotify.push(...rule.notifyUsers);
                }

                if (rule.notifyRoles?.length) {
                  const roleUserGroups = await Promise.all(
                    rule.notifyRoles.map((roleId) =>
                      ctx.db
                        .query("userOrganizations")
                        .withIndex("by_organization", (q) =>
                          q.eq("organizationId", org._id),
                        )
                        .filter((q) => q.eq(q.field("roleId"), roleId))
                        .collect(),
                    ),
                  );
                  for (const userOrgs of roleUserGroups) {
                    usersToNotify.push(...userOrgs.map((uo) => uo.userId));
                  }
                }

                await dispatchNotification(ctx, {
                  organizationId: org._id,
                  type: "conservation_alert",
                  recipients: usersToNotify,
                  title: "Overdue Treatment Alert",
                  message: `Treatment "${treatment.title}" is overdue and requires attention.`,
                  related: {
                    entityType: "conservationAlert",
                    entityId: alertId,
                  },
                });
              }),
            );
          }),
        );
      }),
    );

    return null;
  },
});

export const checkAssessmentsDueInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const now = Date.now();

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const rules = await ctx.db
          .query("conservationAlertRules")
          .withIndex("by_organization_and_active", (q) =>
            q.eq("organizationId", org._id).eq("isActive", true),
          )
          .filter((q) => q.eq(q.field("triggerType"), "assessment_due"))
          .collect();

        await Promise.all(
          rules.map(async (rule) => {
            const intervalDays = rule.assessmentIntervalDays ?? 365;
            const threshold = now - intervalDays * 24 * 60 * 60 * 1000;

            const collections = await ctx.db
              .query("collections")
              .withIndex("by_organization_and_status", (q) =>
                q.eq("organizationId", org._id).eq("status", "active"),
              )
              .collect();

            await Promise.all(
              collections.map(async (collection) => {
                const lastAssessment = await ctx.db
                  .query("conservationTreatments")
                  .withIndex("by_collection", (q) =>
                    q.eq("collectionId", collection._id),
                  )
                  .filter((q) => q.eq(q.field("treatmentType"), "assessment"))
                  .order("desc")
                  .first();

                const lastAssessmentTime = lastAssessment?.performedAt ?? 0;

                if (lastAssessmentTime >= threshold) {
                  return;
                }

                const existingAlert = await ctx.db
                  .query("conservationAlerts")
                  .withIndex("by_collection", (q) =>
                    q.eq("collectionId", collection._id),
                  )
                  .filter((q) =>
                    q.and(
                      q.eq(q.field("alertType"), "assessment_due"),
                      q.eq(q.field("status"), "active"),
                    ),
                  )
                  .first();

                if (existingAlert) {
                  return;
                }

                const daysSinceAssessment = Math.floor(
                  (now - lastAssessmentTime) / (24 * 60 * 60 * 1000),
                );
                const alertDescription = lastAssessment
                  ? `Last assessment was ${daysSinceAssessment} days ago. Periodic assessment recommended.`
                  : "No assessment record found. Initial assessment recommended.";

                if (!rule.inAppNotification) {
                  await ctx.db.insert("conservationAlerts", {
                    organizationId: org._id,
                    ruleId: rule._id,
                    collectionId: collection._id,
                    alertType: "assessment_due",
                    title: `Assessment Due: ${collection.title}`,
                    description: alertDescription,
                    priority: rule.priority,
                    status: "active",
                    createdAt: now,
                  });
                  return;
                }

                const alertId = await ctx.db.insert("conservationAlerts", {
                  organizationId: org._id,
                  ruleId: rule._id,
                  collectionId: collection._id,
                  alertType: "assessment_due",
                  title: `Assessment Due: ${collection.title}`,
                  description: alertDescription,
                  priority: rule.priority,
                  status: "active",
                  createdAt: now,
                });

                const usersToNotify: Array<Id<"users">> = [];

                if (rule.notifyUsers?.length) {
                  usersToNotify.push(...rule.notifyUsers);
                }

                if (rule.notifyRoles?.length) {
                  const roleUserGroups = await Promise.all(
                    rule.notifyRoles.map((roleId) =>
                      ctx.db
                        .query("userOrganizations")
                        .withIndex("by_organization", (q) =>
                          q.eq("organizationId", org._id),
                        )
                        .filter((q) => q.eq(q.field("roleId"), roleId))
                        .collect(),
                    ),
                  );
                  for (const userOrgs of roleUserGroups) {
                    usersToNotify.push(...userOrgs.map((uo) => uo.userId));
                  }
                }

                await dispatchNotification(ctx, {
                  organizationId: org._id,
                  type: "conservation_alert",
                  recipients: usersToNotify,
                  title: "Assessment Due Alert",
                  message: `Object "${collection.title}" requires a conservation assessment.`,
                  related: {
                    entityType: "conservationAlert",
                    entityId: alertId,
                  },
                });
              }),
            );
          }),
        );
      }),
    );

    return null;
  },
});

// ============================================
// COST TRACKING FUNCTIONS
// ============================================

export const updateTreatmentCosts = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    laborHours: v.optional(v.number()),
    laborRate: v.optional(v.number()),
    materialsCost: v.optional(v.number()),
    materials: v.optional(
      v.array(
        v.object({
          name: v.string(),
          quantity: v.optional(v.number()),
          unitCost: v.optional(v.number()),
          totalCost: v.number(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    externalServicesCost: v.optional(v.number()),
    currency: v.optional(v.string()),
    costNotes: v.optional(v.string()),
  },
  returns: v.object({
    totalCost: v.number(),
    laborCost: v.number(),
  }),
  handler: async (ctx, args) => {
    const [userId, treatment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.treatmentId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    // Calculate costs
    const laborCost =
      args.laborHours && args.laborRate
        ? args.laborHours * args.laborRate
        : (treatment.laborCost ?? 0);

    const materialsCost =
      args.materialsCost ??
      (args.materials
        ? args.materials.reduce((sum, m) => sum + m.totalCost, 0)
        : (treatment.materialsCost ?? 0));

    const externalServicesCost =
      args.externalServicesCost ?? treatment.externalServicesCost ?? 0;

    const totalCost = laborCost + materialsCost + externalServicesCost;

    const updates: Record<string, unknown> = {
      totalCost,
      laborCost,
    };

    if (args.laborHours !== undefined) updates.laborHours = args.laborHours;
    if (args.laborRate !== undefined) updates.laborRate = args.laborRate;
    if (args.materialsCost !== undefined)
      updates.materialsCost = args.materialsCost;
    if (args.materials !== undefined) updates.materials = args.materials;
    if (args.externalServicesCost !== undefined)
      updates.externalServicesCost = args.externalServicesCost;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.costNotes !== undefined) updates.costNotes = args.costNotes;

    await Promise.all([
      ctx.db.patch(args.treatmentId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: treatment.organizationId,
        userId,
        action: "costs_updated",
        entityType: "conservationTreatment",
        entityId: args.treatmentId,
        changes: { totalCost, laborCost, materialsCost },
      }),
    ]);

    return { totalCost, laborCost };
  },
});

export const getCostSummary = query({
  args: {
    organizationId: v.id("organizations"),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: v.object({
    totalCost: v.number(),
    laborCost: v.number(),
    materialsCost: v.number(),
    externalServicesCost: v.number(),
    treatmentCount: v.number(),
    averageCostPerTreatment: v.number(),
    byType: v.array(
      v.object({
        treatmentType: v.string(),
        count: v.number(),
        totalCost: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    let treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // Filter by date range
    if (args.dateFrom) {
      treatments = treatments.filter((t) => t.performedAt >= args.dateFrom!);
    }
    if (args.dateTo) {
      treatments = treatments.filter((t) => t.performedAt <= args.dateTo!);
    }

    // Calculate totals
    let totalCost = 0;
    let laborCost = 0;
    let materialsCost = 0;
    let externalServicesCost = 0;

    const byType: Record<string, { count: number; totalCost: number }> = {};

    for (const treatment of treatments) {
      totalCost += treatment.totalCost ?? 0;
      laborCost += treatment.laborCost ?? 0;
      materialsCost += treatment.materialsCost ?? 0;
      externalServicesCost += treatment.externalServicesCost ?? 0;

      if (!byType[treatment.treatmentType]) {
        byType[treatment.treatmentType] = { count: 0, totalCost: 0 };
      }
      byType[treatment.treatmentType]!.count++;
      byType[treatment.treatmentType]!.totalCost += treatment.totalCost ?? 0;
    }

    return {
      totalCost,
      laborCost,
      materialsCost,
      externalServicesCost,
      treatmentCount: treatments.length,
      averageCostPerTreatment:
        treatments.length > 0 ? totalCost / treatments.length : 0,
      byType: Object.entries(byType).map(([treatmentType, data]) => ({
        treatmentType,
        count: data.count,
        totalCost: data.totalCost,
      })),
    };
  },
});

// ============================================
// ASSESSMENT SCHEDULING FUNCTIONS
// ============================================

export const createAssessmentSchedule = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    name: v.string(),
    description: v.optional(v.string()),
    intervalDays: v.number(),
    assessmentType: v.union(
      v.literal("full"),
      v.literal("spot_check"),
      v.literal("environmental"),
      v.literal("condition"),
    ),
    assignedTo: v.optional(v.id("users")),
    assignedRoleId: v.optional(v.id("roles")),
    reminderDaysBefore: v.optional(v.number()),
  },
  returns: v.id("assessmentSchedules"),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.update"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const nextDueDate = Date.now() + args.intervalDays * 24 * 60 * 60 * 1000;

    const scheduleId = await ctx.db.insert("assessmentSchedules", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      name: args.name,
      description: args.description,
      intervalDays: args.intervalDays,
      assessmentType: args.assessmentType,
      nextDueDate,
      isActive: true,
      assignedTo: args.assignedTo,
      assignedRoleId: args.assignedRoleId,
      reminderDaysBefore: args.reminderDaysBefore,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "assessmentSchedule",
      entityId: scheduleId,
      changes: { name: args.name, intervalDays: args.intervalDays },
    });

    return scheduleId;
  },
});

export const updateAssessmentSchedule = mutation({
  args: {
    scheduleId: v.id("assessmentSchedules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    intervalDays: v.optional(v.number()),
    assessmentType: v.optional(
      v.union(
        v.literal("full"),
        v.literal("spot_check"),
        v.literal("environmental"),
        v.literal("condition"),
      ),
    ),
    assignedTo: v.optional(v.id("users")),
    assignedRoleId: v.optional(v.id("roles")),
    reminderDaysBefore: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, schedule] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.scheduleId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    await Promise.all([
      requireConservationAccess(ctx, schedule.organizationId),
      requirePermission(ctx, schedule.organizationId, "collections.update"),
    ]);

    const { scheduleId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await ctx.db.patch(args.scheduleId, filteredUpdates);

    return null;
  },
});

export const completeScheduledAssessment = mutation({
  args: {
    scheduleId: v.id("assessmentSchedules"),
    treatmentId: v.id("conservationTreatments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, schedule] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.scheduleId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    await Promise.all([
      requireConservationAccess(ctx, schedule.organizationId),
      requirePermission(ctx, schedule.organizationId, "collections.update"),
    ]);
    await requireInOrganization(
      ctx,
      args.treatmentId,
      schedule.organizationId,
      "Treatment",
    );

    // Calculate next due date
    const nextDueDate =
      Date.now() + schedule.intervalDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.scheduleId, {
      lastCompletedDate: Date.now(),
      lastCompletedBy: userId,
      lastTreatmentId: args.treatmentId,
      nextDueDate,
    });

    return null;
  },
});

export const listAssessmentSchedules = query({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    activeOnly: v.optional(v.boolean()),
    dueSoon: v.optional(v.boolean()), // Filter to show schedules due within 30 days
  },
  returns: v.array(
    v.object({
      _id: v.id("assessmentSchedules"),
      name: v.string(),
      description: v.optional(v.string()),
      collectionId: v.optional(v.id("collections")),
      collectionTitle: v.optional(v.string()),
      intervalDays: v.number(),
      assessmentType: v.string(),
      nextDueDate: v.optional(v.number()),
      lastCompletedDate: v.optional(v.number()),
      isActive: v.boolean(),
      daysUntilDue: v.optional(v.number()),
      isOverdue: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireConservationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    const collectionId = args.collectionId;
    if (collectionId) {
      await requireInOrganization(
        ctx,
        collectionId,
        args.organizationId,
        "Object",
      );
    }
    const schedules = collectionId
      ? await ctx.db
          .query("assessmentSchedules")
          .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
          .collect()
      : args.activeOnly
        ? await ctx.db
            .query("assessmentSchedules")
            .withIndex("by_organization_and_active", (q) =>
              q.eq("organizationId", args.organizationId).eq("isActive", true),
            )
            .collect()
        : await ctx.db
            .query("assessmentSchedules")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let enrichedSchedules = await Promise.all(
      schedules.map(async (schedule) => {
        const collection = schedule.collectionId
          ? await ctx.db.get(schedule.collectionId)
          : null;

        const daysUntilDue = schedule.nextDueDate
          ? Math.floor((schedule.nextDueDate - now) / (24 * 60 * 60 * 1000))
          : undefined;

        const isOverdue = schedule.nextDueDate
          ? schedule.nextDueDate < now
          : false;

        return {
          _id: schedule._id,
          name: schedule.name,
          description: schedule.description,
          collectionId: schedule.collectionId,
          collectionTitle: collection?.title,
          intervalDays: schedule.intervalDays,
          assessmentType: schedule.assessmentType,
          nextDueDate: schedule.nextDueDate,
          lastCompletedDate: schedule.lastCompletedDate,
          isActive: schedule.isActive,
          daysUntilDue,
          isOverdue,
        };
      }),
    );

    // Filter for due soon if requested
    if (args.dueSoon) {
      enrichedSchedules = enrichedSchedules.filter(
        (s) =>
          s.nextDueDate &&
          (s.nextDueDate < now || s.nextDueDate - now <= thirtyDaysMs),
      );
    }

    // Sort by due date
    return enrichedSchedules.sort((a, b) => {
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      return a.nextDueDate - b.nextDueDate;
    });
  },
});

// ============================================
// ENVIRONMENTAL MONITORING FUNCTIONS
// ============================================

/**
 * An audited staff spot check. It is applied to the location's alert episode
 * like a device reading (ADR 0013): outside the thresholds it opens or updates
 * the episode, and within them it ends the breach that staff readings showed.
 */
export const recordEnvironmentalReading = mutation({
  args: {
    locationId: v.id("locations"),
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    lightLevel: v.optional(v.number()),
    uvLevel: v.optional(v.number()),
    source: v.literal("manual"),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    readingId: v.id("environmentalReadings"),
    alertTriggered: v.boolean(),
    episodeId: v.optional(v.id("alertEpisodes")),
    violations: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    await requirePermission(ctx, location.organizationId, "collections.update");

    const recordedAt = Date.now();
    const { readingId, episodeId, breaches } = await acceptReading(ctx, {
      location,
      source: { kind: "staff", userId },
      observedAt: recordedAt,
      receivedAt: recordedAt,
      values: {
        temperature: args.temperature,
        humidity: args.humidity,
        lightLevel: args.lightLevel,
        uvLevel: args.uvLevel,
      },
      notes: args.notes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: location.organizationId,
      userId,
      action: "recorded_environmental_reading",
      entityType: "environmentalReading",
      entityId: readingId,
      changes: {
        locationId: args.locationId,
        source: "manual",
        temperature: args.temperature,
        humidity: args.humidity,
        lightLevel: args.lightLevel,
        uvLevel: args.uvLevel,
      },
    });

    return {
      readingId,
      alertTriggered: breaches.length > 0,
      episodeId,
      violations: breaches.map(describeBreach),
    };
  },
});

export const getEnvironmentalReadings = query({
  args: {
    locationId: v.id("locations"),
    limit: v.optional(v.number()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("environmentalReadings"),
      temperature: v.optional(v.number()),
      humidity: v.optional(v.number()),
      lightLevel: v.optional(v.number()),
      uvLevel: v.optional(v.number()),
      recordedAt: v.number(),
      observedAt: v.optional(v.number()),
      receivedAt: v.optional(v.number()),
      source: v.string(),
      sensorId: v.optional(v.string()),
      sensorDeviceId: v.optional(v.id("environmentalDevices")),
      sensorProbeId: v.optional(v.string()),
      externalReadingId: v.optional(v.string()),
      recordedBy: v.optional(v.id("users")),
      alertTriggered: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      return [];
    }

    await requirePermission(ctx, location.organizationId, "collections.read");

    let readings = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_location_and_time", (q) =>
        q.eq("locationId", args.locationId),
      )
      .order("desc")
      .collect();

    // Filter by date range
    if (args.dateFrom) {
      readings = readings.filter((r) => r.recordedAt >= args.dateFrom!);
    }
    if (args.dateTo) {
      readings = readings.filter((r) => r.recordedAt <= args.dateTo!);
    }

    // Apply limit
    if (args.limit) {
      readings = readings.slice(0, args.limit);
    }

    return readings.map((r) => ({
      _id: r._id,
      temperature: r.temperature,
      humidity: r.humidity,
      lightLevel: r.lightLevel,
      uvLevel: r.uvLevel,
      recordedAt: r.recordedAt,
      observedAt: r.observedAt,
      receivedAt: r.receivedAt,
      source: r.source,
      sensorId: r.sensorId,
      sensorDeviceId: r.sensorDeviceId,
      sensorProbeId: r.sensorProbeId,
      externalReadingId: r.externalReadingId,
      recordedBy: r.recordedBy,
      alertTriggered: r.alertTriggered,
    }));
  },
});

export const getEnvironmentalSummary = query({
  args: {
    locationId: v.id("locations"),
    periodDays: v.optional(v.number()), // Default 30 days
  },
  returns: v.object({
    temperature: v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      avg: v.optional(v.number()),
      current: v.optional(v.number()),
    }),
    humidity: v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      avg: v.optional(v.number()),
      current: v.optional(v.number()),
    }),
    lightLevel: v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      avg: v.optional(v.number()),
      current: v.optional(v.number()),
    }),
    readingCount: v.number(),
    alertCount: v.number(),
    thresholds: v.optional(
      v.object({
        temperatureMin: v.optional(v.number()),
        temperatureMax: v.optional(v.number()),
        humidityMin: v.optional(v.number()),
        humidityMax: v.optional(v.number()),
        lightLevelMax: v.optional(v.number()),
        uvLevelMax: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    await requirePermission(ctx, location.organizationId, "collections.read");

    const periodMs = (args.periodDays ?? 30) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - periodMs;

    const readings = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_location_and_time", (q) =>
        q.eq("locationId", args.locationId),
      )
      .filter((q) => q.gte(q.field("recordedAt"), cutoff))
      .collect();

    // Calculate stats
    const temps = readings.flatMap((reading) =>
      reading.temperature === undefined ? [] : [reading.temperature],
    );
    const humids = readings.flatMap((reading) =>
      reading.humidity === undefined ? [] : [reading.humidity],
    );
    const lights = readings.flatMap((reading) =>
      reading.lightLevel === undefined ? [] : [reading.lightLevel],
    );

    const calcStats = (values: number[]) => {
      if (values.length === 0)
        return { min: undefined, max: undefined, avg: undefined };
      return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      };
    };

    // Get most recent reading for current values
    const latest =
      readings.length > 0
        ? readings.reduce((newest, reading) =>
            reading.recordedAt > newest.recordedAt ? reading : newest,
          )
        : undefined;

    const alertCount = readings.filter((r) => r.alertTriggered).length;

    return {
      temperature: {
        ...calcStats(temps),
        current: latest?.temperature,
      },
      humidity: {
        ...calcStats(humids),
        current: latest?.humidity,
      },
      lightLevel: {
        ...calcStats(lights),
        current: latest?.lightLevel,
      },
      readingCount: readings.length,
      alertCount,
      thresholds: location.environmentalThresholds,
    };
  },
});
