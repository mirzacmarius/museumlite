import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { env } from "./env";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requirePermission } from "./utils/permissions";

const workflowTypeValidator = v.union(
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("loan"),
  v.literal("acquisition"),
  v.literal("exhibition"),
  v.literal("conservation"),
);

const approvalModeValidator = v.union(
  v.literal("single"),
  v.literal("multi"),
  v.literal("unanimous"),
);

const stepValidator = v.object({
  stepNumber: v.number(),
  roleId: v.id("roles"),
  name: v.string(),
  approvalMode: v.optional(approvalModeValidator),
  requiredApprovals: v.optional(v.number()),
  allowedNextSteps: v.optional(v.array(v.number())),
  canSkip: v.optional(v.boolean()),
  requiredDocuments: v.optional(v.array(v.string())),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowConfigs"),
      _creationTime: v.number(),
      workflowType: workflowTypeValidator,
      steps: v.array(stepValidator),
      canInitiateRoles: v.array(v.id("roles")),
      templateId: v.optional(v.id("workflowTemplates")),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "settings.read");

    const configs = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return configs.map((config) => ({
      _id: config._id,
      _creationTime: config._creationTime,
      workflowType: config.workflowType,
      steps: config.steps.map((step) => ({
        stepNumber: step.stepNumber,
        roleId: step.roleId,
        name: step.name,
        approvalMode: step.approvalMode,
        requiredApprovals: step.requiredApprovals,
        allowedNextSteps: step.allowedNextSteps,
        canSkip: step.canSkip,
        requiredDocuments: step.requiredDocuments,
      })),
      canInitiateRoles: config.canInitiateRoles,
      templateId: config.templateId,
    }));
  },
});

export const get = query({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
  },
  returns: v.union(
    v.object({
      _id: v.id("workflowConfigs"),
      _creationTime: v.number(),
      workflowType: workflowTypeValidator,
      steps: v.array(stepValidator),
      canInitiateRoles: v.array(v.id("roles")),
      templateId: v.optional(v.id("workflowTemplates")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "settings.read");

    const config = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .unique();

    if (!config) {
      return null;
    }

    return {
      _id: config._id,
      _creationTime: config._creationTime,
      workflowType: config.workflowType,
      steps: config.steps.map((step) => ({
        stepNumber: step.stepNumber,
        roleId: step.roleId,
        name: step.name,
        approvalMode: step.approvalMode,
        requiredApprovals: step.requiredApprovals,
        allowedNextSteps: step.allowedNextSteps,
        canSkip: step.canSkip,
        requiredDocuments: step.requiredDocuments,
      })),
      canInitiateRoles: config.canInitiateRoles,
      templateId: config.templateId,
    };
  },
});

export const upsert = mutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    steps: v.array(stepValidator),
    canInitiateRoles: v.array(v.id("roles")),
  },
  returns: v.id("workflowConfigs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "settings.update");

    const existing = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: args.steps,
        canInitiateRoles: args.canInitiateRoles,
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "updated_workflow_config",
        entityType: "workflowConfig",
        entityId: existing._id,
        changes: {
          workflowType: args.workflowType,
          stepsCount: args.steps.length,
          canInitiateRolesCount: args.canInitiateRoles.length,
        },
      });

      return existing._id;
    }

    const configId = await ctx.db.insert("workflowConfigs", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      steps: args.steps,
      canInitiateRoles: args.canInitiateRoles,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_workflow_config",
      entityType: "workflowConfig",
      entityId: configId,
      changes: {
        workflowType: args.workflowType,
        stepsCount: args.steps.length,
        canInitiateRolesCount: args.canInitiateRoles.length,
      },
    });

    return configId;
  },
});

export const remove = mutation({
  args: {
    id: v.id("workflowConfigs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const config = await ctx.db.get(args.id);
    if (!config) {
      throw new Error("Workflow config not found");
    }

    await requirePermission(ctx, config.organizationId, "settings.update");

    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: config.organizationId,
      userId,
      action: "deleted_workflow_config",
      entityType: "workflowConfig",
      entityId: args.id,
      changes: {
        workflowType: config.workflowType,
      },
    });

    return null;
  },
});

// ============================================
// Epic 24: State Transition Validation
// ============================================

export const validateTransition = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    fromStep: v.number(),
    toStep: v.number(),
  },
  returns: v.object({
    valid: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .first();

    if (!config) {
      return {
        valid: true,
        reason: "No workflow config - all transitions allowed",
      };
    }

    const fromStepConfig = config.steps.find(
      (s) => s.stepNumber === args.fromStep,
    );

    if (!fromStepConfig) {
      if (args.fromStep === 0 && args.toStep === 1) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Step ${args.fromStep} not found in workflow config`,
      };
    }

    const allowedNextSteps = fromStepConfig.allowedNextSteps;
    if (allowedNextSteps && allowedNextSteps.length > 0) {
      if (!allowedNextSteps.includes(args.toStep)) {
        return {
          valid: false,
          reason: `Transition from step ${args.fromStep} to ${args.toStep} not allowed. Allowed: ${allowedNextSteps.join(", ")}`,
        };
      }
    } else {
      if (args.toStep !== args.fromStep + 1 && args.toStep !== -1) {
        return {
          valid: false,
          reason: `Only sequential transitions allowed. Expected ${args.fromStep + 1} or -1 (complete)`,
        };
      }
    }

    return { valid: true };
  },
});

export const recordWorkflowHistory = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    entityId: v.string(),
    fromStep: v.number(),
    toStep: v.number(),
    action: v.union(
      v.literal("created"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("reassigned"),
      v.literal("returned"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    performedBy: v.id("users"),
    comment: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    previousAssignee: v.optional(v.id("users")),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.id("workflowHistory"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("workflowHistory", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      entityId: args.entityId,
      fromStep: args.fromStep,
      toStep: args.toStep,
      action: args.action,
      performedBy: args.performedBy,
      performedAt: Date.now(),
      comment: args.comment,
      assignedTo: args.assignedTo,
      previousAssignee: args.previousAssignee,
      metadata: args.metadata,
    });
  },
});

export const getWorkflowHistoryForEntity = query({
  args: {
    workflowType: workflowTypeValidator,
    entityId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowHistory"),
      fromStep: v.number(),
      toStep: v.number(),
      action: v.string(),
      performedBy: v.id("users"),
      performedByName: v.optional(v.string()),
      performedAt: v.number(),
      comment: v.optional(v.string()),
      assignedTo: v.optional(v.id("users")),
      assignedToName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("workflowHistory")
      .withIndex("by_entity", (q) =>
        q.eq("workflowType", args.workflowType).eq("entityId", args.entityId),
      )
      .collect();

    return await Promise.all(
      history.map(async (h) => {
        const performer = await ctx.db.get(h.performedBy);
        const assignee = h.assignedTo ? await ctx.db.get(h.assignedTo) : null;

        return {
          _id: h._id,
          fromStep: h.fromStep,
          toStep: h.toStep,
          action: h.action,
          performedBy: h.performedBy,
          performedByName: performer?.name ?? performer?.email ?? undefined,
          performedAt: h.performedAt,
          comment: h.comment,
          assignedTo: h.assignedTo,
          assignedToName: assignee?.name ?? assignee?.email ?? undefined,
        };
      }),
    );
  },
});

export const getWorkflowHistoryByUser = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    workflowType: v.optional(workflowTypeValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowHistory"),
      workflowType: workflowTypeValidator,
      entityId: v.string(),
      fromStep: v.number(),
      toStep: v.number(),
      action: v.string(),
      performedAt: v.number(),
      comment: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.read");

    const targetUserId = args.userId ?? currentUserId;
    const limit = args.limit ?? 50;

    const historyQuery = ctx.db
      .query("workflowHistory")
      .withIndex("by_user", (q) => q.eq("performedBy", targetUserId));

    const allHistory = await historyQuery.collect();

    let filtered = allHistory.filter(
      (h) => h.organizationId === args.organizationId,
    );

    if (args.workflowType) {
      filtered = filtered.filter((h) => h.workflowType === args.workflowType);
    }

    filtered.sort((a, b) => b.performedAt - a.performedAt);

    return filtered.slice(0, limit).map((h) => ({
      _id: h._id,
      workflowType: h.workflowType,
      entityId: h.entityId,
      fromStep: h.fromStep,
      toStep: h.toStep,
      action: h.action,
      performedAt: h.performedAt,
      comment: h.comment,
    }));
  },
});

export const getRecentWorkflowActivity = query({
  args: {
    organizationId: v.id("organizations"),
    workflowType: v.optional(workflowTypeValidator),
    limit: v.optional(v.number()),
    sinceTimestamp: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowHistory"),
      workflowType: workflowTypeValidator,
      entityId: v.string(),
      fromStep: v.number(),
      toStep: v.number(),
      action: v.string(),
      performedBy: v.id("users"),
      performedByName: v.optional(v.string()),
      performedAt: v.number(),
      comment: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = args.limit ?? 50;
    const sinceTimestamp = args.sinceTimestamp ?? 0;

    let query;
    if (args.workflowType) {
      query = ctx.db
        .query("workflowHistory")
        .withIndex("by_organization_and_type", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("workflowType", args.workflowType!),
        );
    } else {
      query = ctx.db
        .query("workflowHistory")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        );
    }

    const history = await query.collect();

    const filtered = history
      .filter((h) => h.performedAt > sinceTimestamp)
      .sort((a, b) => b.performedAt - a.performedAt)
      .slice(0, limit);

    return await Promise.all(
      filtered.map(async (h) => {
        const performer = await ctx.db.get(h.performedBy);
        return {
          _id: h._id,
          workflowType: h.workflowType,
          entityId: h.entityId,
          fromStep: h.fromStep,
          toStep: h.toStep,
          action: h.action,
          performedBy: h.performedBy,
          performedByName: performer?.name ?? performer?.email ?? undefined,
          performedAt: h.performedAt,
          comment: h.comment,
        };
      }),
    );
  },
});

// ============================================
// Epic 24: Multi-Approver Support
// ============================================

export const recordStepApproval = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    entityId: v.string(),
    stepNumber: v.number(),
    approvedBy: v.id("users"),
    comment: v.optional(v.string()),
  },
  returns: v.id("workflowStepApprovals"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workflowStepApprovals")
      .withIndex("by_entity_and_step", (q) =>
        q
          .eq("workflowType", args.workflowType)
          .eq("entityId", args.entityId)
          .eq("stepNumber", args.stepNumber),
      )
      .filter((q) => q.eq(q.field("approvedBy"), args.approvedBy))
      .first();

    if (existing) {
      throw new Error("User has already approved this step");
    }

    return await ctx.db.insert("workflowStepApprovals", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      entityId: args.entityId,
      stepNumber: args.stepNumber,
      approvedBy: args.approvedBy,
      approvedAt: Date.now(),
      comment: args.comment,
    });
  },
});

export const getStepApprovalCount = internalQuery({
  args: {
    workflowType: workflowTypeValidator,
    entityId: v.string(),
    stepNumber: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const approvals = await ctx.db
      .query("workflowStepApprovals")
      .withIndex("by_entity_and_step", (q) =>
        q
          .eq("workflowType", args.workflowType)
          .eq("entityId", args.entityId)
          .eq("stepNumber", args.stepNumber),
      )
      .collect();

    return approvals.length;
  },
});

export const hasUserApprovedStep = internalQuery({
  args: {
    workflowType: workflowTypeValidator,
    entityId: v.string(),
    stepNumber: v.number(),
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const approval = await ctx.db
      .query("workflowStepApprovals")
      .withIndex("by_entity_and_step", (q) =>
        q
          .eq("workflowType", args.workflowType)
          .eq("entityId", args.entityId)
          .eq("stepNumber", args.stepNumber),
      )
      .filter((q) => q.eq(q.field("approvedBy"), args.userId))
      .first();

    return approval !== null;
  },
});

export const clearStepApprovals = internalMutation({
  args: {
    workflowType: workflowTypeValidator,
    entityId: v.string(),
    stepNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const approvals = await ctx.db
      .query("workflowStepApprovals")
      .withIndex("by_entity_and_step", (q) =>
        q
          .eq("workflowType", args.workflowType)
          .eq("entityId", args.entityId)
          .eq("stepNumber", args.stepNumber),
      )
      .collect();

    for (const approval of approvals) {
      await ctx.db.delete(approval._id);
    }

    return null;
  },
});

// ============================================
// Epic 24: Generic Workflow Assignments
// ============================================

export const assignDeaccession = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    const previousAssignee = deaccession.assignedTo;

    await ctx.db.patch(args.deaccessionId, {
      assignedTo: args.userId,
    });

    await ctx.runMutation(internal.workflows.recordWorkflowHistory, {
      organizationId: deaccession.organizationId,
      workflowType: "deaccession",
      entityId: args.deaccessionId,
      fromStep: deaccession.workflowStep ?? 0,
      toStep: deaccession.workflowStep ?? 0,
      action: "reassigned",
      performedBy: currentUserId,
      assignedTo: args.userId,
      previousAssignee,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId: currentUserId,
      action: "assigned_deaccession",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: { assignedTo: args.userId },
    });

    if (args.userId !== currentUserId) {
      // Get user who is assigning
      const assigningUser = await ctx.db.get(currentUserId);
      const assignedByName = assigningUser?.name ?? assigningUser?.email ?? "A team member";

      // Get organization for building deep link
      const org = await ctx.db.get(deaccession.organizationId);
      const taskUrl = org ? `${env.SITE_URL}/${org.slug}/deaccessions/${args.deaccessionId}` : undefined;

      await ctx.runMutation(internal.notifications.sendNotification, {
        organizationId: deaccession.organizationId,
        userId: args.userId,
        type: "task_assigned",
        title: "Deaccession Assigned to You",
        message: `Deaccession ${deaccession.deaccessionNumber} has been assigned to you.`,
        relatedEntityType: "deaccession",
        relatedEntityId: args.deaccessionId,
        emailData: {
          taskTitle: `Deaccession ${deaccession.deaccessionNumber}`,
          assignedBy: assignedByName,
          taskUrl,
        },
      });
    }

    return null;
  },
});

export const unassignDeaccession = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    const previousAssignee = deaccession.assignedTo;

    await ctx.db.patch(args.deaccessionId, {
      assignedTo: undefined,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId: currentUserId,
      action: "unassigned_deaccession",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: { previousAssignee },
    });

    return null;
  },
});

export const assignLoan = mutation({
  args: {
    loanId: v.id("loans"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requirePermission(ctx, loan.organizationId, "loans.update");

    const previousAssignee = loan.assignedTo;

    await ctx.db.patch(args.loanId, {
      assignedTo: args.userId,
    });

    await ctx.runMutation(internal.workflows.recordWorkflowHistory, {
      organizationId: loan.organizationId,
      workflowType: "loan",
      entityId: args.loanId,
      fromStep: loan.workflowStep ?? 0,
      toStep: loan.workflowStep ?? 0,
      action: "reassigned",
      performedBy: currentUserId,
      assignedTo: args.userId,
      previousAssignee,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId: currentUserId,
      action: "assigned_loan",
      entityType: "loan",
      entityId: args.loanId,
      changes: { assignedTo: args.userId },
    });

    if (args.userId !== currentUserId) {
      // Get user who is assigning
      const assigningUser = await ctx.db.get(currentUserId);
      const assignedByName = assigningUser?.name ?? assigningUser?.email ?? "A team member";

      // Get organization for building deep link
      const org = await ctx.db.get(loan.organizationId);
      const taskUrl = org ? `${env.SITE_URL}/${org.slug}/loans/${args.loanId}` : undefined;

      await ctx.runMutation(internal.notifications.sendNotification, {
        organizationId: loan.organizationId,
        userId: args.userId,
        type: "task_assigned",
        title: "Loan Assigned to You",
        message: `Loan ${loan.loanNumber} has been assigned to you.`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
        emailData: {
          taskTitle: `Loan ${loan.loanNumber}`,
          assignedBy: assignedByName,
          taskUrl,
        },
      });
    }

    return null;
  },
});

export const unassignLoan = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requirePermission(ctx, loan.organizationId, "loans.update");

    const previousAssignee = loan.assignedTo;

    await ctx.db.patch(args.loanId, {
      assignedTo: undefined,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId: currentUserId,
      action: "unassigned_loan",
      entityType: "loan",
      entityId: args.loanId,
      changes: { previousAssignee },
    });

    return null;
  },
});

// ============================================
// Epic 24: Workflow Templates
// ============================================

const templateStepValidator = v.object({
  stepNumber: v.number(),
  name: v.string(),
  roleName: v.string(),
  approvalMode: v.optional(
    v.union(v.literal("single"), v.literal("multi"), v.literal("unanimous")),
  ),
  requiredApprovals: v.optional(v.number()),
  allowedNextSteps: v.optional(v.array(v.number())),
  canSkip: v.optional(v.boolean()),
  requiredDocuments: v.optional(v.array(v.string())),
});

export const listTemplates = query({
  args: {
    workflowType: v.optional(workflowTypeValidator),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowTemplates"),
      name: v.string(),
      description: v.optional(v.string()),
      workflowType: workflowTypeValidator,
      isSystem: v.boolean(),
      steps: v.array(templateStepValidator),
    }),
  ),
  handler: async (ctx, args) => {
    let templates;
    if (args.workflowType) {
      templates = await ctx.db
        .query("workflowTemplates")
        .withIndex("by_workflowType", (q) =>
          q.eq("workflowType", args.workflowType!),
        )
        .collect();
    } else {
      templates = await ctx.db.query("workflowTemplates").collect();
    }

    return templates.map((t) => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      workflowType: t.workflowType,
      isSystem: t.isSystem,
      steps: t.steps,
    }));
  },
});

export const getTemplate = query({
  args: {
    templateId: v.id("workflowTemplates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("workflowTemplates"),
      name: v.string(),
      description: v.optional(v.string()),
      workflowType: workflowTypeValidator,
      isSystem: v.boolean(),
      steps: v.array(templateStepValidator),
      requiredDocuments: v.optional(
        v.array(
          v.object({
            documentType: v.string(),
            description: v.optional(v.string()),
            requiredAtStep: v.optional(v.number()),
          }),
        ),
      ),
      requireSourceVerification: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    return {
      _id: template._id,
      name: template.name,
      description: template.description,
      workflowType: template.workflowType,
      isSystem: template.isSystem,
      steps: template.steps,
      requiredDocuments: template.requiredDocuments,
      requireSourceVerification: template.requireSourceVerification,
    };
  },
});

export const createTemplateFromConfig = mutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("workflowTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "settings.read");

    const config = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .first();

    if (!config) {
      throw new Error("No workflow config found for this type");
    }

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const roleIdToName = new Map(roles.map((r) => [r._id, r.name]));

    const templateSteps = config.steps.map((step) => ({
      stepNumber: step.stepNumber,
      name: step.name,
      roleName: roleIdToName.get(step.roleId) ?? "Unknown Role",
      approvalMode: step.approvalMode,
      requiredApprovals: step.requiredApprovals,
      allowedNextSteps: step.allowedNextSteps,
      canSkip: step.canSkip,
      requiredDocuments: step.requiredDocuments,
    }));

    const templateId = await ctx.db.insert("workflowTemplates", {
      name: args.name,
      description: args.description,
      workflowType: args.workflowType,
      isSystem: false,
      steps: templateSteps,
      requiredDocuments: config.requiredDocuments,
      requireSourceVerification: config.requireSourceVerification,
      createdAt: Date.now(),
      createdBy: userId,
    });

    return templateId;
  },
});

export const applyTemplateToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    templateId: v.id("workflowTemplates"),
  },
  returns: v.id("workflowConfigs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "settings.update");

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const roleNameToId = new Map(roles.map((r) => [r.name, r._id]));

    const configSteps: Array<{
      stepNumber: number;
      roleId: Id<"roles">;
      name: string;
      approvalMode?: "single" | "multi" | "unanimous";
      requiredApprovals?: number;
      allowedNextSteps?: number[];
      canSkip?: boolean;
      requiredDocuments?: string[];
    }> = [];

    for (const step of template.steps) {
      const roleId = roleNameToId.get(step.roleName);
      if (!roleId) {
        throw new Error(
          `Role "${step.roleName}" not found in organization. Create the role first.`,
        );
      }

      configSteps.push({
        stepNumber: step.stepNumber,
        roleId,
        name: step.name,
        approvalMode: step.approvalMode,
        requiredApprovals: step.requiredApprovals,
        allowedNextSteps: step.allowedNextSteps,
        canSkip: step.canSkip,
        requiredDocuments: step.requiredDocuments,
      });
    }

    const existing = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), template.workflowType))
      .first();

    const adminRole = roles.find((r) => r.name.toLowerCase() === "admin");
    const canInitiateRoles = adminRole ? [adminRole._id] : [];

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: configSteps,
        canInitiateRoles,
        requiredDocuments: template.requiredDocuments,
        requireSourceVerification: template.requireSourceVerification,
        templateId: args.templateId,
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "applied_workflow_template",
        entityType: "workflowConfig",
        entityId: existing._id,
        changes: {
          templateId: args.templateId,
          templateName: template.name,
        },
      });

      return existing._id;
    }

    const configId = await ctx.db.insert("workflowConfigs", {
      organizationId: args.organizationId,
      workflowType: template.workflowType,
      steps: configSteps,
      canInitiateRoles,
      requiredDocuments: template.requiredDocuments,
      requireSourceVerification: template.requireSourceVerification,
      templateId: args.templateId,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "applied_workflow_template",
      entityType: "workflowConfig",
      entityId: configId,
      changes: {
        templateId: args.templateId,
        templateName: template.name,
      },
    });

    return configId;
  },
});

export const seedSystemTemplates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existingTemplates = await ctx.db
      .query("workflowTemplates")
      .withIndex("by_isSystem", (q) => q.eq("isSystem", true))
      .collect();

    if (existingTemplates.length > 0) {
      return null;
    }

    const systemTemplates = [
      {
        name: "Basic Approval",
        description: "Simple single-step approval workflow",
        workflowType: "accession" as const,
        steps: [
          {
            stepNumber: 1,
            name: "Review & Approve",
            roleName: "Admin",
            approvalMode: "single" as const,
          },
        ],
      },
      {
        name: "Two-Step Review",
        description: "Curator review followed by director approval",
        workflowType: "accession" as const,
        steps: [
          {
            stepNumber: 1,
            name: "Curator Review",
            roleName: "Curator",
            approvalMode: "single" as const,
          },
          {
            stepNumber: 2,
            name: "Director Approval",
            roleName: "Admin",
            approvalMode: "single" as const,
          },
        ],
      },
      {
        name: "Committee Approval",
        description: "Requires multiple approvers from committee",
        workflowType: "deaccession" as const,
        steps: [
          {
            stepNumber: 1,
            name: "Staff Review",
            roleName: "Registrar",
            approvalMode: "single" as const,
          },
          {
            stepNumber: 2,
            name: "Committee Vote",
            roleName: "Admin",
            approvalMode: "multi" as const,
            requiredApprovals: 3,
          },
        ],
        requireSourceVerification: true,
      },
      {
        name: "Loan Approval",
        description: "Standard loan approval with insurance verification",
        workflowType: "loan" as const,
        steps: [
          {
            stepNumber: 1,
            name: "Registrar Review",
            roleName: "Registrar",
            approvalMode: "single" as const,
            requiredDocuments: ["insurance_certificate"],
          },
          {
            stepNumber: 2,
            name: "Director Approval",
            roleName: "Admin",
            approvalMode: "single" as const,
          },
        ],
      },
    ];

    for (const template of systemTemplates) {
      await ctx.db.insert("workflowTemplates", {
        ...template,
        isSystem: true,
        createdAt: Date.now(),
      });
    }

    return null;
  },
});

export const checkStepApprovalStatus = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    entityId: v.string(),
    stepNumber: v.number(),
    userId: v.id("users"),
  },
  returns: v.object({
    approvalMode: v.union(
      v.literal("single"),
      v.literal("multi"),
      v.literal("unanimous"),
    ),
    currentApprovals: v.number(),
    requiredApprovals: v.number(),
    userHasApproved: v.boolean(),
    isFullyApproved: v.boolean(),
    approvers: v.array(
      v.object({
        userId: v.id("users"),
        approvedAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .first();

    const stepConfig = config?.steps.find(
      (s) => s.stepNumber === args.stepNumber,
    );
    const approvalMode = stepConfig?.approvalMode ?? "single";
    const requiredApprovals = stepConfig?.requiredApprovals ?? 1;

    const approvals = await ctx.db
      .query("workflowStepApprovals")
      .withIndex("by_entity_and_step", (q) =>
        q
          .eq("workflowType", args.workflowType)
          .eq("entityId", args.entityId)
          .eq("stepNumber", args.stepNumber),
      )
      .collect();

    const currentApprovals = approvals.length;
    const userHasApproved = approvals.some((a) => a.approvedBy === args.userId);

    let isFullyApproved = false;
    let effectiveRequired = 1;

    if (approvalMode === "single") {
      effectiveRequired = 1;
      isFullyApproved = currentApprovals >= 1;
    } else if (approvalMode === "multi") {
      effectiveRequired = requiredApprovals;
      isFullyApproved = currentApprovals >= requiredApprovals;
    } else if (approvalMode === "unanimous" && stepConfig?.roleId) {
      const usersWithRole = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("roleId"), stepConfig.roleId))
        .collect();

      effectiveRequired = usersWithRole.length;
      isFullyApproved = currentApprovals >= usersWithRole.length;
    }

    return {
      approvalMode,
      currentApprovals,
      requiredApprovals: effectiveRequired,
      userHasApproved,
      isFullyApproved,
      approvers: approvals.map((a) => ({
        userId: a.approvedBy,
        approvedAt: a.approvedAt,
      })),
    };
  },
});
