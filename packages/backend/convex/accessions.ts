import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  requirePermission,
  canInitiateWorkflow,
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
} from "./utils/permissions";
import { accessionParser } from "./utils/accessionNumberParser";
import { getNextCounterValue } from "./utils/accessionCounter";

/**
 * Generate accession number based on organization format template
 */
async function generateAccessionNumber(
  ctx: any,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const template = org.settings?.accessionNumberFormat;
  const autoGenerate = org.settings?.autoGenerateAccessionNumbers ?? false;

  if (!autoGenerate || !template) {
    throw new Error("Accession number generation not configured");
  }

  const now = new Date();

  // Determine counter scope from settings or template
  const counterScope =
    org.settings?.accessionCounterScope ||
    accessionParser.getCounterScopeFromTemplate(template);

  // Get scope key for counter tracking
  const scopeKey = accessionParser.getScopeKey(counterScope, now);

  // Get next counter value (atomic operation)
  const counterValue = await getNextCounterValue(
    ctx,
    organizationId,
    counterScope,
    scopeKey,
  );

  // Parse template and generate accession number
  const accessionNumber = accessionParser.parse(template, {
    organizationSlug: org.slug,
    currentDate: now,
    counterValue,
    counterScope,
  });

  return accessionNumber;
}

/**
 * Create accession record
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.optional(v.string()),
    dateReceived: v.number(),
    source: v.string(),
    donorAccountId: v.optional(v.id("accounts")),
    documents: v.optional(v.array(v.id("_storage"))),
    method: v.union(
      v.literal("purchase"),
      v.literal("gift"),
      v.literal("loan"),
      v.literal("transfer"),
      v.literal("donation"),
      v.literal("other"),
      v.literal("bequest"),
    ),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("accessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user can initiate workflow
    const canInitiate = await canInitiateWorkflow(
      ctx,
      args.organizationId,
      "accession",
    );

    if (!canInitiate) {
      throw new Error("Permission denied: cannot initiate accession workflow");
    }

    // Generate or use provided accession number
    let accessionNumber: string;
    if (args.accessionNumber) {
      accessionNumber = args.accessionNumber;
    } else {
      accessionNumber = await generateAccessionNumber(ctx, args.organizationId);
    }

    // Get workflow config
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
      .first();

    // Store creator in workflow history for notification purposes
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

    const accessionId = await ctx.db.insert("accessions", {
      organizationId: args.organizationId,
      accessionNumber,
      dateReceived: args.dateReceived,
      source: args.source,
      donorAccountId: args.donorAccountId,
      documents: args.documents,
      method: args.method,
      cost: args.cost,
      notes: args.notes,
      status: workflowConfig ? "pending" : "approved", // Auto-approve if no workflow
      workflowStep: workflowConfig ? 0 : undefined, // Start at Draft/Intake (step 0)
      workflowHistory,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "accession",
      entityId: accessionId,
      changes: {
        accessionNumber,
        status: workflowConfig ? "pending" : "approved",
      },
    });

    // If workflow exists, notify users who can approve step 1
    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "accession",
        1,
      );

      // Create notifications for approvers
      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          // Don't notify the creator
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: args.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "New Accession Requires Approval",
            message: `Accession ${accessionNumber} is pending your approval at step 1.`,
            relatedEntityType: "accession",
            relatedEntityId: accessionId,
          });
        }
      }
    }

    // If no workflow config, auto-create collection object
    if (!workflowConfig) {
      await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
        accessionId,
      });
    }

    return accessionId;
  },
});

/**
 * List accessions with filters
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
        _id: v.id("accessions"),
        accessionNumber: v.string(),
        dateReceived: v.number(),
        source: v.string(),
        method: v.union(
          v.literal("purchase"),
          v.literal("gift"),
          v.literal("loan"),
          v.literal("transfer"),
          v.literal("donation"),
          v.literal("other"),
          v.literal("bequest"),
        ),
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
        workflowStep: v.optional(v.number()),
        assignedTo: v.optional(v.id("users")),
        assigneeName: v.optional(v.string()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    let query = ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    // Collect all results for search filtering
    let allResults = await query.collect();

    // Apply search filter if provided
    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      // Get collection titles for accessions to include in search
      const accessionsWithCollectionInfo = await Promise.all(
        allResults.map(async (accession) => {
          let collectionTitle = "";
          if (accession.collectionId) {
            const collection = await ctx.db.get(accession.collectionId);
            collectionTitle = collection?.title || "";
          }

          return { ...accession, collectionTitle };
        }),
      );

      allResults = accessionsWithCollectionInfo
        .filter((accession) => {
          return (
            accession.accessionNumber?.toLowerCase().includes(searchLower) ||
            accession.source?.toLowerCase().includes(searchLower) ||
            accession.notes?.toLowerCase().includes(searchLower) ||
            accession.collectionTitle?.toLowerCase().includes(searchLower) ||
            accession.method?.toLowerCase().includes(searchLower) ||
            false
          );
        })
        .map(({ collectionTitle, ...accession }) => accession); // Remove temporary field
    }

    // Sort by date received (newest first)
    allResults.sort((a, b) => b.dateReceived - a.dateReceived);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allResults.length,
    );
    const page = allResults.slice(startIndex, endIndex);

    const pageWithAssignees = await Promise.all(
      page.map(async (item) => {
        let assigneeName: string | undefined;
        if (item.assignedTo) {
          const user = await ctx.db.get(item.assignedTo);
          assigneeName = user?.name || user?.email || undefined;
        }
        return {
          _id: item._id,
          accessionNumber: item.accessionNumber,
          dateReceived: item.dateReceived,
          source: item.source,
          method: item.method,
          status: item.status,
          workflowStep: item.workflowStep,
          assignedTo: item.assignedTo,
          assigneeName,
        };
      }),
    );

    return {
      page: pageWithAssignees,
      isDone: endIndex >= allResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

/**
 * Get accession details
 */
export const get = query({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("accessions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      collectionId: v.optional(v.id("collections")),
      accessionNumber: v.string(),
      dateReceived: v.number(),
      source: v.string(),
      method: v.union(
        v.literal("purchase"),
        v.literal("gift"),
        v.literal("loan"),
        v.literal("transfer"),
        v.literal("donation"),
        v.literal("other"),
        v.literal("bequest"),
      ),
      cost: v.optional(v.number()),
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      return null;
    }

    await requirePermission(ctx, accession.organizationId, "collections.read");

    // Ensure workflowHistory is always an array (even if empty)
    return {
      ...accession,
      workflowHistory: accession.workflowHistory ?? [],
    };
  },
});

/**
 * Update accession (before approval)
 */
export const update = mutation({
  args: {
    accessionId: v.id("accessions"),
    source: v.optional(v.string()),
    donorAccountId: v.optional(v.id("accounts")),
    documents: v.optional(v.array(v.id("_storage"))),
    method: v.optional(
      v.union(
        v.literal("purchase"),
        v.literal("gift"),
        v.literal("loan"),
        v.literal("transfer"),
        v.literal("donation"),
        v.literal("other"),
        v.literal("bequest"),
      ),
    ),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Can only update if pending
    if (accession.status !== "pending") {
      throw new Error("Can only update pending accessions");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    const updates: {
      source?: string;
      donorAccountId?: Id<"accounts">;
      documents?: Id<"_storage">[];
      method?:
        | "purchase"
        | "gift"
        | "loan"
        | "transfer"
        | "donation"
        | "other"
        | "bequest";
      cost?: number;
      notes?: string;
    } = {};

    if (args.source !== undefined) updates.source = args.source;
    if (args.donorAccountId !== undefined)
      updates.donorAccountId = args.donorAccountId;
    if (args.documents !== undefined) updates.documents = args.documents;
    if (args.method !== undefined) updates.method = args.method;
    if (args.cost !== undefined) updates.cost = args.cost;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.accessionId, updates);

    return null;
  },
});

/**
 * Update workflow step (for Kanban drag-and-drop)
 */
export const updateWorkflowStep = mutation({
  args: {
    accessionId: v.id("accessions"),
    workflowStep: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    if (accession.status !== "pending") {
      throw new Error("Can only update workflow step for pending accessions");
    }

    if (args.workflowStep < 0 || args.workflowStep > 2) {
      throw new Error("Invalid workflow step");
    }

    await ctx.db.patch(args.accessionId, {
      workflowStep: args.workflowStep,
    });

    return null;
  },
});

/**
 * Submit for approval
 */
export const submitForApproval = mutation({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    // Reset workflow step if needed
    await ctx.db.patch(args.accessionId, {
      workflowStep: 1,
    });

    return null;
  },
});

/**
 * Approve accession at current step
 */
export const approve = mutation({
  args: {
    accessionId: v.id("accessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.approve_accession",
    );

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    // Get workflow config
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", accession.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
      .first();

    if (workflowConfig) {
      // Multi-step workflow
      const currentStep = accession.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        accession.organizationId,
        "accession",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      // Check source verification requirement
      if (workflowConfig.requireSourceVerification && !accession.sourceVerified) {
        throw new Error("Source verification is required before approval");
      }

      // Check required documents for this step
      const currentStepConfig = workflowConfig.steps.find(
        (s) => s.stepNumber === currentStep,
      );
      if (currentStepConfig?.requiredDocuments?.length) {
        const checklist = accession.documentChecklist ?? [];
        for (const requiredDoc of currentStepConfig.requiredDocuments) {
          const doc = checklist.find((d) => d.documentType === requiredDoc);
          if (!doc?.uploaded) {
            throw new Error(`Required document "${requiredDoc}" must be uploaded before approval`);
          }
        }
      }

      // Check global required documents for this step
      if (workflowConfig.requiredDocuments?.length) {
        const checklist = accession.documentChecklist ?? [];
        for (const reqDoc of workflowConfig.requiredDocuments) {
          if (reqDoc.requiredAtStep !== undefined && reqDoc.requiredAtStep <= currentStep) {
            const doc = checklist.find((d) => d.documentType === reqDoc.documentType);
            if (!doc?.uploaded) {
              throw new Error(`Required document "${reqDoc.documentType}" must be uploaded before step ${currentStep} approval`);
            }
          }
        }
      }

      // Add to workflow history
      const history = accession.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });

      // Check if this is the last step
      const isLastStep = currentStep >= workflowConfig.steps.length;

      if (isLastStep) {
        // Approve and create collection
        await ctx.db.patch(args.accessionId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        });

        // Log audit action
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: accession.organizationId,
          userId,
          action: "approved",
          entityType: "accession",
          entityId: args.accessionId,
          changes: { status: "approved", step: currentStep },
        });

        // Notify users who were involved in the workflow (from history)
        // The creator is in history[0] (step 0) if it exists
        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: accession.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Accession Approved",
            message: `Accession ${accession.accessionNumber} has been fully approved and added to the collection.`,
            relatedEntityType: "accession",
            relatedEntityId: args.accessionId,
          });
        }

        // Create collection object
        await ctx.runMutation(
          internal.accessions.createCollectionFromAccession,
          {
            accessionId: args.accessionId,
          },
        );
      } else {
        // Move to next step
        await ctx.db.patch(args.accessionId, {
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        // Log audit action
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: accession.organizationId,
          userId,
          action: "step_approved",
          entityType: "accession",
          entityId: args.accessionId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        // Notify users who can approve the next step
        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          accession.organizationId,
          "accession",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: accession.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Accession Requires Your Approval",
              message: `Accession ${accession.accessionNumber} is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "accession",
              relatedEntityId: args.accessionId,
            });
          }
        }
      }
    } else {
      // Single-step approval
      await ctx.db.patch(args.accessionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      });

      // Log audit action
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId,
        action: "approved",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { status: "approved" },
      });

      // Notify all users with read access (optional - can be removed if too noisy)
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", accession.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        if (userOrg.userId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: accession.organizationId,
            userId: userOrg.userId,
            type: "workflow_approved",
            title: "Accession Approved",
            message: `Accession ${accession.accessionNumber} has been approved and added to the collection.`,
            relatedEntityType: "accession",
            relatedEntityId: args.accessionId,
          });
        }
      }

      // Create collection object
      await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
        accessionId: args.accessionId,
      });
    }

    return null;
  },
});

/**
 * Reject accession
 */
export const reject = mutation({
  args: {
    accessionId: v.id("accessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.approve_accession",
    );

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    await ctx.db.patch(args.accessionId, {
      status: "rejected",
      approvedBy: userId,
      approvedAt: Date.now(),
      notes: args.comment
        ? `${accession.notes || ""}\nRejected: ${args.comment}`.trim()
        : accession.notes,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId,
      action: "rejected",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { status: "rejected", comment: args.comment },
    });

    // Notify users who were involved in the workflow (from history)
    const history = accession.workflowHistory ?? [];
    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: accession.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Accession Rejected",
        message: `Accession ${accession.accessionNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "accession",
        relatedEntityId: args.accessionId,
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
    accessionId: v.id("accessions"),
  },
  returns: v.array(
    v.object({
      step: v.number(),
      approvedBy: v.id("users"),
      approvedAt: v.number(),
      comment: v.optional(v.string()),
      approverName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(ctx, accession.organizationId, "collections.read");

    const history = accession.workflowHistory ?? [];

    // Enrich with approver names
    const enrichedHistory = await Promise.all(
      history.map(async (item) => {
        const approver = await ctx.db.get(item.approvedBy);
        return {
          ...item,
          approverName: approver?.name || approver?.username || undefined,
        };
      }),
    );

    return enrichedHistory;
  },
});

/**
 * Internal: Create collection object from approved accession
 */
export const createCollectionFromAccession = internalMutation({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "approved") {
      throw new Error("Accession must be approved");
    }

    if (accession.collectionId) {
      // Collection already created
      return accession.collectionId;
    }

    // Get first user as fallback for catalogedBy
    const firstUser = await ctx.db.query("users").first();

    // Create collection object
    const collectionId = await ctx.db.insert("collections", {
      organizationId: accession.organizationId,
      accessionNumber: accession.accessionNumber,
      title: `Accession ${accession.accessionNumber}`, // Default title
      status: "active",
      catalogedBy: accession.approvedBy ?? firstUser?._id!,
      catalogedAt: accession.approvedAt ?? Date.now(),
    });

    // Link accession to collection
    await ctx.db.patch(args.accessionId, {
      collectionId,
    });

    return collectionId;
  },
});

/**
 * Get workflow steps for accessions kanban
 */
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

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
      .first();

    if (!workflowConfig) {
      return {
        hasWorkflow: false,
        steps: [
          { stepNumber: 0, name: "Draft" },
          { stepNumber: -1, name: "Approved" },
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

    return {
      hasWorkflow: true,
      steps: [
        { stepNumber: 0, name: "Draft" },
        ...stepsWithRoles,
        { stepNumber: -1, name: "Approved" },
      ],
    };
  },
});

/**
 * Assign accession to a user
 */
export const assign = mutation({
  args: {
    accessionId: v.id("accessions"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.accessionId, {
      assignedTo: args.userId,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId: currentUserId,
      action: "updated",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { assignedTo: args.userId },
    });

    return null;
  },
});

/**
 * Unassign accession
 */
export const unassign = mutation({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.accessionId, {
      assignedTo: undefined,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId: currentUserId,
      action: "updated",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { assignedTo: null },
    });

    return null;
  },
});

/**
 * Get accessions assigned to current user
 */
export const listMyAssigned = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accessions"),
      accessionNumber: v.string(),
      source: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      workflowStep: v.optional(v.number()),
      dateReceived: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const accessions = await ctx.db
      .query("accessions")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", userId))
      .collect();

    return accessions
      .filter((a) => a.organizationId === args.organizationId)
      .map((a) => ({
        _id: a._id,
        accessionNumber: a.accessionNumber,
        source: a.source,
        status: a.status,
        workflowStep: a.workflowStep,
        dateReceived: a.dateReceived,
      }));
  },
});

// ============================================
// Source Verification
// ============================================

/**
 * Verify the source/donor of an accession
 */
export const verifySource = mutation({
  args: {
    accessionId: v.id("accessions"),
    verificationNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.accessionId, {
      sourceVerified: true,
      sourceVerifiedBy: userId,
      sourceVerifiedAt: Date.now(),
      sourceVerificationNotes: args.verificationNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId,
      action: "source_verified",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { sourceVerified: true },
    });

    return null;
  },
});

/**
 * Unverify the source (e.g., if new information comes to light)
 */
export const unverifySource = mutation({
  args: {
    accessionId: v.id("accessions"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.accessionId, {
      sourceVerified: false,
      sourceVerificationNotes: `Unverified: ${args.reason}`,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId,
      action: "source_unverified",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { reason: args.reason },
    });

    return null;
  },
});

// ============================================
// Document Checklist
// ============================================

/**
 * Initialize document checklist from workflow config
 */
export const initializeDocumentChecklist = mutation({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    // Get workflow config to determine required documents
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", accession.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
      .first();

    if (!workflowConfig?.requiredDocuments) {
      return null;
    }

    const checklist = workflowConfig.requiredDocuments.map((doc) => ({
      documentType: doc.documentType,
      required: true,
      uploaded: false,
    }));

    await ctx.db.patch(args.accessionId, {
      documentChecklist: checklist,
    });

    return null;
  },
});

/**
 * Upload document to checklist
 */
export const uploadChecklistDocument = mutation({
  args: {
    accessionId: v.id("accessions"),
    documentType: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    const checklist = accession.documentChecklist ?? [];
    const updatedChecklist = checklist.map((item) => {
      if (item.documentType === args.documentType) {
        return {
          ...item,
          uploaded: true,
          storageId: args.storageId,
          uploadedAt: Date.now(),
          uploadedBy: userId,
        };
      }
      return item;
    });

    // If document type wasn't in checklist, add it
    const found = checklist.some(
      (item) => item.documentType === args.documentType,
    );
    if (!found) {
      updatedChecklist.push({
        documentType: args.documentType,
        required: false,
        uploaded: true,
        storageId: args.storageId,
        uploadedAt: Date.now(),
        uploadedBy: userId,
      });
    }

    // Also add to the main documents array
    const documents = accession.documents ?? [];
    if (!documents.includes(args.storageId)) {
      documents.push(args.storageId);
    }

    await ctx.db.patch(args.accessionId, {
      documentChecklist: updatedChecklist,
      documents,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId,
      action: "document_uploaded",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { documentType: args.documentType },
    });

    return null;
  },
});

/**
 * Remove document from checklist
 */
export const removeChecklistDocument = mutation({
  args: {
    accessionId: v.id("accessions"),
    documentType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    const checklist = accession.documentChecklist ?? [];
    const item = checklist.find((i) => i.documentType === args.documentType);

    const updatedChecklist = checklist.map((i) => {
      if (i.documentType === args.documentType) {
        return {
          ...i,
          uploaded: false,
          storageId: undefined,
          uploadedAt: undefined,
          uploadedBy: undefined,
        };
      }
      return i;
    });

    // Remove from main documents array
    const documents = accession.documents ?? [];
    const filteredDocs = item?.storageId
      ? documents.filter((d) => d !== item.storageId)
      : documents;

    await ctx.db.patch(args.accessionId, {
      documentChecklist: updatedChecklist,
      documents: filteredDocs,
    });

    return null;
  },
});

/**
 * Get document checklist status
 */
export const getDocumentChecklist = query({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.object({
    checklist: v.array(
      v.object({
        documentType: v.string(),
        required: v.boolean(),
        uploaded: v.boolean(),
        storageId: v.optional(v.id("_storage")),
        uploadedAt: v.optional(v.number()),
        uploadedBy: v.optional(v.id("users")),
        uploaderName: v.optional(v.string()),
        url: v.optional(v.string()),
      }),
    ),
    allRequiredUploaded: v.boolean(),
    totalRequired: v.number(),
    totalUploaded: v.number(),
  }),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(ctx, accession.organizationId, "collections.read");

    const checklist = accession.documentChecklist ?? [];

    // Enrich with uploader names and URLs
    const enrichedChecklist = await Promise.all(
      checklist.map(async (item) => {
        let uploaderName: string | undefined;
        let url: string | undefined;

        if (item.uploadedBy) {
          const user = await ctx.db.get(item.uploadedBy);
          uploaderName = user?.name || user?.email || undefined;
        }

        if (item.storageId) {
          url = await ctx.storage.getUrl(item.storageId) ?? undefined;
        }

        return {
          ...item,
          uploaderName,
          url,
        };
      }),
    );

    const required = checklist.filter((i) => i.required);
    const uploaded = checklist.filter((i) => i.uploaded);
    const requiredUploaded = required.filter((i) => i.uploaded);

    return {
      checklist: enrichedChecklist,
      allRequiredUploaded: requiredUploaded.length === required.length,
      totalRequired: required.length,
      totalUploaded: uploaded.length,
    };
  },
});

// ============================================
// Bulk Import
// ============================================

/**
 * Validate bulk import data before processing
 */
export const validateBulkImport = mutation({
  args: {
    organizationId: v.id("organizations"),
    items: v.array(
      v.object({
        accessionNumber: v.optional(v.string()),
        dateReceived: v.string(), // ISO date string
        source: v.string(),
        method: v.string(),
        cost: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    valid: v.boolean(),
    validCount: v.number(),
    errorCount: v.number(),
    errors: v.array(
      v.object({
        row: v.number(),
        field: v.string(),
        message: v.string(),
      }),
    ),
    preview: v.array(
      v.object({
        row: v.number(),
        accessionNumber: v.string(),
        dateReceived: v.number(),
        source: v.string(),
        method: v.string(),
        cost: v.optional(v.number()),
        notes: v.optional(v.string()),
        isValid: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const validMethods = [
      "purchase",
      "gift",
      "loan",
      "transfer",
      "donation",
      "other",
      "bequest",
    ];

    const errors: { row: number; field: string; message: string }[] = [];
    const preview: {
      row: number;
      accessionNumber: string;
      dateReceived: number;
      source: string;
      method: string;
      cost?: number;
      notes?: string;
      isValid: boolean;
    }[] = [];

    // Check for auto-generate setting
    const org = await ctx.db.get(args.organizationId);
    const autoGenerate = org?.settings?.autoGenerateAccessionNumbers ?? false;

    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      if (!item) continue;

      const rowNumber = i + 1;
      let isValid = true;

      // Validate accession number (required if not auto-generating)
      let accessionNumber = item.accessionNumber?.trim() || "";
      if (!autoGenerate && !accessionNumber) {
        errors.push({
          row: rowNumber,
          field: "accessionNumber",
          message: "Accession number is required",
        });
        isValid = false;
        accessionNumber = `INVALID-${rowNumber}`;
      }

      // Validate date
      let dateReceived = 0;
      try {
        dateReceived = new Date(item.dateReceived).getTime();
        if (Number.isNaN(dateReceived)) {
          throw new Error("Invalid date");
        }
      } catch {
        errors.push({
          row: rowNumber,
          field: "dateReceived",
          message: "Invalid date format",
        });
        isValid = false;
        dateReceived = Date.now();
      }

      // Validate source
      if (!item.source?.trim()) {
        errors.push({
          row: rowNumber,
          field: "source",
          message: "Source is required",
        });
        isValid = false;
      }

      // Validate method
      const method = item.method?.toLowerCase().trim();
      if (!validMethods.includes(method)) {
        errors.push({
          row: rowNumber,
          field: "method",
          message: `Invalid method. Must be one of: ${validMethods.join(", ")}`,
        });
        isValid = false;
      }

      // Validate cost (optional)
      let cost: number | undefined;
      if (item.cost) {
        cost = Number.parseFloat(item.cost);
        if (Number.isNaN(cost)) {
          errors.push({
            row: rowNumber,
            field: "cost",
            message: "Invalid cost value",
          });
          isValid = false;
        }
      }

      preview.push({
        row: rowNumber,
        accessionNumber: accessionNumber || `[Auto-generated]`,
        dateReceived,
        source: item.source,
        method: validMethods.includes(method) ? method : "other",
        cost,
        notes: item.notes,
        isValid,
      });
    }

    const validCount = preview.filter((p) => p.isValid).length;
    const errorCount = preview.filter((p) => !p.isValid).length;

    return {
      valid: errors.length === 0,
      validCount,
      errorCount,
      errors,
      preview,
    };
  },
});

/**
 * Process bulk import
 */
export const processBulkImport = mutation({
  args: {
    organizationId: v.id("organizations"),
    items: v.array(
      v.object({
        accessionNumber: v.optional(v.string()),
        dateReceived: v.number(),
        source: v.string(),
        method: v.union(
          v.literal("purchase"),
          v.literal("gift"),
          v.literal("loan"),
          v.literal("transfer"),
          v.literal("donation"),
          v.literal("other"),
          v.literal("bequest"),
        ),
        cost: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
    ),
    skipValidationErrors: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    imported: v.number(),
    failed: v.number(),
    accessionIds: v.array(v.id("accessions")),
    errors: v.array(
      v.object({
        row: v.number(),
        message: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    // Get workflow config
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
      .first();

    const accessionIds: Id<"accessions">[] = [];
    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      if (!item) continue;

      try {
        // Generate accession number if not provided
        let accessionNumber = item.accessionNumber?.trim();
        if (!accessionNumber) {
          accessionNumber = await generateAccessionNumber(
            ctx,
            args.organizationId,
          );
        }

        // Check for duplicate accession number
        const existing = await ctx.db
          .query("accessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .filter((q) => q.eq(q.field("accessionNumber"), accessionNumber))
          .first();

        if (existing) {
          throw new Error(`Duplicate accession number: ${accessionNumber}`);
        }

        // Create workflow history
        const workflowHistory = workflowConfig
          ? [
              {
                step: 0,
                approvedBy: userId,
                approvedAt: Date.now(),
                comment: "Bulk import",
              },
            ]
          : [];

        const accessionId = await ctx.db.insert("accessions", {
          organizationId: args.organizationId,
          accessionNumber,
          dateReceived: item.dateReceived,
          source: item.source,
          method: item.method,
          cost: item.cost,
          notes: item.notes,
          status: workflowConfig ? "pending" : "approved",
          workflowStep: workflowConfig ? 0 : undefined,
          workflowHistory,
        });

        accessionIds.push(accessionId);
        imported++;

        // If no workflow, auto-create collection
        if (!workflowConfig) {
          await ctx.runMutation(
            internal.accessions.createCollectionFromAccession,
            { accessionId },
          );
        }
      } catch (error) {
        if (!args.skipValidationErrors) {
          throw error;
        }
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        failed++;
      }
    }

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "bulk_import",
      entityType: "accession",
      entityId: accessionIds[0] || ("bulk" as Id<"accessions">),
      changes: { imported, failed, total: args.items.length },
    });

    return {
      success: failed === 0,
      imported,
      failed,
      accessionIds,
      errors,
    };
  },
});

/**
 * Get CSV template for bulk import
 */
export const getBulkImportTemplate = query({
  args: {},
  returns: v.string(),
  handler: async () => {
    const headers = [
      "accessionNumber",
      "dateReceived",
      "source",
      "method",
      "cost",
      "notes",
    ];

    const exampleRow = [
      "2024.001",
      "2024-01-15",
      "John Smith Estate",
      "bequest",
      "5000",
      "Part of the Smith Collection",
    ];

    return `${headers.join(",")}\n${exampleRow.join(",")}`;
  },
});

// ============================================
// BULK EXPORT
// ============================================

/**
 * Bulk export accessions data for CSV/Excel export
 */
export const bulkExport = query({
  args: {
    accessionIds: v.array(v.id("accessions")),
  },
  returns: v.array(
    v.object({
      _id: v.id("accessions"),
      accessionNumber: v.string(),
      dateReceived: v.number(),
      source: v.string(),
      method: v.string(),
      status: v.string(),
      cost: v.optional(v.number()),
      notes: v.optional(v.string()),
      collectionTitle: v.optional(v.string()),
      collectionAccessionNumber: v.optional(v.string()),
      donorName: v.optional(v.string()),
      assignedToName: v.optional(v.string()),
      approvedByName: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      workflowStep: v.optional(v.number()),
      sourceVerified: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results: Array<{
      _id: Id<"accessions">;
      accessionNumber: string;
      dateReceived: number;
      source: string;
      method: string;
      status: string;
      cost?: number;
      notes?: string;
      collectionTitle?: string;
      collectionAccessionNumber?: string;
      donorName?: string;
      assignedToName?: string;
      approvedByName?: string;
      approvedAt?: number;
      workflowStep?: number;
      sourceVerified?: boolean;
    }> = [];

    for (const accessionId of args.accessionIds) {
      const accession = await ctx.db.get(accessionId);
      if (!accession) continue;

      await requirePermission(ctx, accession.organizationId, "accessions.read");

      // Get collection info
      let collectionTitle: string | undefined;
      let collectionAccessionNumber: string | undefined;
      if (accession.collectionId) {
        const collection = await ctx.db.get(accession.collectionId);
        if (collection) {
          collectionTitle = collection.title;
          collectionAccessionNumber = collection.accessionNumber;
        }
      }

      // Get donor account name
      let donorName: string | undefined;
      if (accession.donorAccountId) {
        const donor = await ctx.db.get(accession.donorAccountId);
        if (donor) {
          donorName =
            donor.businessName ??
            [donor.firstName, donor.lastName].filter(Boolean).join(" ") ??
            undefined;
        }
      }

      // Get assigned user name
      let assignedToName: string | undefined;
      if (accession.assignedTo) {
        const assignee = await ctx.db.get(accession.assignedTo);
        assignedToName = assignee?.name ?? assignee?.username;
      }

      // Get approver name
      let approvedByName: string | undefined;
      if (accession.approvedBy) {
        const approver = await ctx.db.get(accession.approvedBy);
        approvedByName = approver?.name ?? approver?.username;
      }

      results.push({
        _id: accession._id,
        accessionNumber: accession.accessionNumber,
        dateReceived: accession.dateReceived,
        source: accession.source,
        method: accession.method,
        status: accession.status,
        cost: accession.cost,
        notes: accession.notes,
        collectionTitle,
        collectionAccessionNumber,
        donorName,
        assignedToName,
        approvedByName,
        approvedAt: accession.approvedAt,
        workflowStep: accession.workflowStep,
        sourceVerified: accession.sourceVerified,
      });
    }

    return results;
  },
});
