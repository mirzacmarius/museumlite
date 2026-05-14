import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import {
  markCollectionActive,
  markCollectionDeaccessioned,
  markCollectionLoaned,
} from "./utils/collectionLifecycle";
import { hasFeatureAccess, requireFeatureAccess } from "./utils/featureGates";
import {
  dispatchLoanItems,
  restoreLoanCollections,
  returnLoanItems,
} from "./utils/loanMovement";
import {
  getOrganizationNotificationRecipients,
  getWorkflowCreatorRecipient,
} from "./utils/notificationRecipients";
import { generateNextLoanNumber } from "./utils/numberGenerator";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
  hasPermission,
  requirePermission,
} from "./utils/permissions";
import { getWorkflowConfig } from "./utils/workflowConfigs";
import {
  prepareWorkflowStepAdvance,
  recordWorkflowStepAdvance,
  recordWorkflowStepApproval,
} from "./utils/workflowExecution";
import { resolveWorkflowStepState } from "./utils/workflowSteps";

async function requireLoansAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireFeatureAccess(ctx, organizationId, "loans");
}

/**
 * Create loan record
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    loanNumber: v.optional(v.string()),
    type: v.union(v.literal("incoming"), v.literal("outgoing")),
    accountId: v.optional(v.id("accounts")),
    lenderBorrowerName: v.string(),
    lenderBorrowerContact: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    terms: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    notes: v.optional(v.string()),
    useDetailedConditionReports: v.optional(v.boolean()),
    collectionIds: v.optional(v.array(v.id("collections"))),
    conditionOut: v.optional(v.string()), // Deprecated: use itemsWithConditions instead
    itemsWithConditions: v.optional(
      v.array(
        v.object({
          collectionId: v.id("collections"),
          conditionOut: v.optional(v.string()),
        }),
      ),
    ),
  },
  returns: v.id("loans"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireLoansAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "loans.create");

    // Validate account if provided
    if (args.accountId) {
      const account = await ctx.db.get(args.accountId);
      if (!account) {
        throw new Error("Account not found");
      }
      if (account.organizationId !== args.organizationId) {
        throw new Error("Account does not belong to this organization");
      }
    }

    // Generate or use provided loan number
    let loanNumber: string;
    if (args.loanNumber) {
      loanNumber = args.loanNumber;
    } else {
      loanNumber = await generateNextLoanNumber(ctx, args.organizationId);
    }

    // Check for workflow config to set up workflow tracking
    const workflowConfig = await getWorkflowConfig(
      ctx,
      args.organizationId,
      "loan",
    );
    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      undefined,
    );

    if (workflowConfig && workflowState.firstStep === undefined) {
      throw new Error("Workflow has no approval steps configured");
    }

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

    const loanId = await ctx.db.insert("loans", {
      organizationId: args.organizationId,
      loanNumber,
      type: args.type,
      accountId: args.accountId,
      lenderBorrowerName: args.lenderBorrowerName,
      lenderBorrowerContact: args.lenderBorrowerContact,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      terms: args.terms,
      insuranceValue: args.insuranceValue,
      notes: args.notes,
      useDetailedConditionReports: args.useDetailedConditionReports ?? false,
      workflowStep: workflowConfig ? workflowState.firstStep ?? 1 : undefined,
      workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
    });

    // Add items if provided
    // Support both old format (collectionIds + conditionOut) and new format (itemsWithConditions)
    const itemsToAdd = args.itemsWithConditions
      ? args.itemsWithConditions
      : args.collectionIds
        ? args.collectionIds.map((id) => ({
            collectionId: id,
            conditionOut: args.conditionOut,
          }))
        : [];

    if (itemsToAdd.length > 0) {
      // Verify collections belong to organization and are active
      for (const item of itemsToAdd) {
        const collection = await ctx.db.get(item.collectionId);
        if (!collection) {
          throw new Error(`Collection ${item.collectionId} not found`);
        }

        if (collection.organizationId !== args.organizationId) {
          throw new Error(
            `Collection ${item.collectionId} does not belong to organization`,
          );
        }

        if (collection.status !== "active") {
          throw new Error(`Collection ${item.collectionId} is not active`);
        }

        // Check if already in a loan
        const existingLoanItem = await ctx.db
          .query("loanItems")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", item.collectionId),
          )
          .filter((q) => {
            return q.eq(q.field("collectionId"), item.collectionId);
          })
          .first();

        if (existingLoanItem) {
          const existingLoan = await ctx.db.get(existingLoanItem.loanId);
          if (
            existingLoan &&
            (existingLoan.status === "pending" ||
              existingLoan.status === "active")
          ) {
            throw new Error(
              `Collection ${item.collectionId} is already in an active loan`,
            );
          }
        }

        await ctx.db.insert("loanItems", {
          loanId,
          collectionId: item.collectionId,
          conditionOut: item.conditionOut,
        });

        await markCollectionLoaned(ctx, {
          collectionId: item.collectionId,
          changedBy: userId,
        });
      }
    }

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "loan",
      entityId: loanId,
      changes: { loanNumber, type: args.type, status: "pending" },
    });

    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "loan",
        workflowState.firstStep ?? 1,
      );

      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: args.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "New Loan Requires Approval",
            message: `Loan ${loanNumber} (${args.type}) is pending your approval at step ${workflowState.firstStep ?? 1}.`,
            relatedEntityType: "loan",
            relatedEntityId: loanId,
          });
        }
      }
    } else {
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        const role = await ctx.db.get(userOrg.roleId);
        if (!role) continue;

        const rolePermissions = await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", role._id))
          .collect();

        const permissions = await Promise.all(
          rolePermissions.map((rp) => ctx.db.get(rp.permissionId)),
        );

        const permissionNames = permissions.flatMap((permission) =>
          permission === null ? [] : [permission.name],
        );

        if (
          permissionNames.includes("loans.approve") &&
          userOrg.userId !== userId
        ) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: args.organizationId,
            userId: userOrg.userId,
            type: "workflow_pending",
            title: "New Loan Requires Approval",
            message: `Loan ${loanNumber} (${args.type}) is pending your approval.`,
            relatedEntityType: "loan",
            relatedEntityId: loanId,
          });
        }
      }
    }

    return loanId;
  },
});

/**
 * Add items to loan
 */
export const addItems = mutation({
  args: {
    loanId: v.id("loans"),
    collectionIds: v.array(v.id("collections")),
    conditionOut: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending" && loan.status !== "active") {
      throw new Error("Can only add items to pending or active loans");
    }

    // Verify collections belong to organization and are active
    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection) {
        throw new Error(`Collection ${collectionId} not found`);
      }

      if (collection.organizationId !== loan.organizationId) {
        throw new Error(
          `Collection ${collectionId} does not belong to organization`,
        );
      }

      if (collection.status !== "active") {
        throw new Error(`Collection ${collectionId} is not active`);
      }

      // Check if already in a loan
      const existingLoanItem = await ctx.db
        .query("loanItems")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .filter((q) => {
          // Check if collection is in an active loan
          const loanId = q.field("loanId");
          return loanId;
        })
        .first();

      if (existingLoanItem) {
        const existingLoan = await ctx.db.get(existingLoanItem.loanId);
        if (
          existingLoan &&
          (existingLoan.status === "pending" ||
            existingLoan.status === "active")
        ) {
          throw new Error(
            `Collection ${collectionId} is already in an active loan`,
          );
        }
      }

      // Create loan item
      await ctx.db.insert("loanItems", {
        loanId: args.loanId,
        collectionId,
        conditionOut: args.conditionOut,
      });

      await markCollectionLoaned(ctx, {
        collectionId,
        changedBy: userId,
      });
    }

    return null;
  },
});

/**
 * Remove items from loan
 */
export const removeItems = mutation({
  args: {
    loanId: v.id("loans"),
    loanItemIds: v.array(v.id("loanItems")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending") {
      throw new Error("Can only remove items from pending loans");
    }

    for (const loanItemId of args.loanItemIds) {
      const loanItem = await ctx.db.get(loanItemId);
      if (!loanItem || loanItem.loanId !== args.loanId) {
        throw new Error(`Loan item ${loanItemId} not found or invalid`);
      }

      // Update collection status back to active
      await markCollectionActive(ctx, {
        collectionId: loanItem.collectionId,
        changedBy: userId,
      });

      // Delete loan item
      await ctx.db.delete(loanItemId);
    }

    return null;
  },
});

/**
 * List loans with filters
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("dispatched"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
    ),
    type: v.optional(v.union(v.literal("incoming"), v.literal("outgoing"))),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("loans"),
        loanNumber: v.string(),
        type: v.union(v.literal("incoming"), v.literal("outgoing")),
        lenderBorrowerName: v.string(),
        startDate: v.number(),
        endDate: v.optional(v.number()),
        status: v.union(
          v.literal("pending"),
          v.literal("active"),
          v.literal("dispatched"),
          v.literal("returned"),
          v.literal("cancelled"),
        ),
        itemCount: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireLoansAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "loans.read");

    let query = ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.type) {
      query = query.filter((q) => q.eq(q.field("type"), args.type));
    }

    // Collect all results for search filtering
    let allResults = await query.collect();

    // Apply search filter if provided
    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      // Get collection titles for loans to include in search
      const loansWithCollectionInfo = await Promise.all(
        allResults.map(async (loan) => {
          const items = await ctx.db
            .query("loanItems")
            .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
            .take(1);

          let collectionTitle = "";
          if (items.length > 0 && items[0]) {
            const collection = await ctx.db.get(items[0].collectionId);
            collectionTitle = collection?.title || "";
          }

          return { ...loan, collectionTitle };
        }),
      );

      allResults = loansWithCollectionInfo.flatMap(
        ({ collectionTitle, ...loan }) =>
          loan.loanNumber?.toLowerCase().includes(searchLower) ||
          loan.lenderBorrowerName?.toLowerCase().includes(searchLower) ||
          loan.lenderBorrowerContact?.toLowerCase().includes(searchLower) ||
          loan.notes?.toLowerCase().includes(searchLower) ||
          loan.terms?.toLowerCase().includes(searchLower) ||
          collectionTitle?.toLowerCase().includes(searchLower)
            ? [loan]
            : [],
      );
    }

    // Sort by start date (newest first)
    allResults.sort((a, b) => b.startDate - a.startDate);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allResults.length,
    );
    const page = allResults.slice(startIndex, endIndex);

    // Get item counts for each loan
    const loansWithCounts = await Promise.all(
      page.map(async (loan) => {
        const items = await ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
          .collect();

        return {
          _id: loan._id,
          loanNumber: loan.loanNumber,
          type: loan.type,
          lenderBorrowerName: loan.lenderBorrowerName,
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
          itemCount: items.length,
        };
      }),
    );

    return {
      page: loansWithCounts,
      isDone: endIndex >= allResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

/**
 * Get loan with items
 */
export const get = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.union(
    v.object({
      _id: v.id("loans"),
      organizationId: v.id("organizations"),
      loanNumber: v.string(),
      type: v.union(v.literal("incoming"), v.literal("outgoing")),
      accountId: v.optional(v.id("accounts")),
      account: v.optional(
        v.object({
          _id: v.id("accounts"),
          accountNumber: v.string(),
          businessName: v.optional(v.string()),
          phone: v.optional(v.string()),
          email: v.optional(v.string()),
          address: v.optional(v.string()),
          address2: v.optional(v.string()),
          zipCode: v.optional(v.string()),
          city: v.optional(v.string()),
          country: v.optional(v.string()),
          contactPerson: v.optional(v.string()),
          contactPhone: v.optional(v.string()),
          contactEmail: v.optional(v.string()),
        }),
      ),
      lenderBorrowerName: v.string(),
      lenderBorrowerContact: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("dispatched"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
      terms: v.optional(v.string()),
      insuranceValue: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      useDetailedConditionReports: v.optional(v.boolean()),
      workflowStep: v.optional(v.number()),
      workflowHistory: v.array(
        v.object({
          step: v.number(),
          approvedBy: v.id("users"),
          approvedByName: v.optional(v.string()),
          approvedAt: v.number(),
          comment: v.optional(v.string()),
        }),
      ),
      items: v.array(
        v.object({
          _id: v.id("loanItems"),
          collectionId: v.id("collections"),
          accessionNumber: v.string(),
          title: v.string(),
          conditionOut: v.optional(v.string()),
          conditionIn: v.optional(v.string()),
          notes: v.optional(v.string()),
          conditionReportId: v.optional(v.id("conditionReports")),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return null;
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.read");

    let account:
      | {
          _id: Id<"accounts">;
          accountNumber: string;
          businessName: string | undefined;
          phone: string | undefined;
          email: string | undefined;
          address: string | undefined;
          address2: string | undefined;
          zipCode: string | undefined;
          city: string | undefined;
          country: string | undefined;
          contactPerson: string | undefined;
          contactPhone: string | undefined;
          contactEmail: string | undefined;
        }
      | undefined = undefined;

    if (loan.accountId) {
      const accountData = await ctx.db.get(loan.accountId);
      if (accountData) {
        account = {
          _id: accountData._id,
          accountNumber: accountData.accountNumber,
          businessName: accountData.businessName,
          phone: accountData.phone,
          email: accountData.email,
          address: accountData.address,
          address2: accountData.address2,
          zipCode: accountData.zipCode,
          city: accountData.city,
          country: accountData.country,
          contactPerson: accountData.contactPerson,
          contactPhone: accountData.contactPhone,
          contactEmail: accountData.contactEmail,
        };
      }
    }

    // Get loan items
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    // Enrich with collection details
    const items = await Promise.all(
      loanItems.map(async (item) => {
        const collection = await ctx.db.get(item.collectionId);
        return {
          _id: item._id,
          collectionId: item.collectionId,
          accessionNumber: collection?.accessionNumber ?? "",
          title: collection?.title ?? "",
          conditionOut: item.conditionOut,
          conditionIn: item.conditionIn,
          notes: item.notes,
          conditionReportId: item.conditionReportId,
        };
      }),
    );

    const rawHistory = loan.workflowHistory ?? [];
    const workflowHistoryWithNames = await Promise.all(
      rawHistory.map(async (entry) => {
        const user = await ctx.db.get(entry.approvedBy);
        return {
          step: entry.step,
          approvedBy: entry.approvedBy,
          approvedByName: user?.name || user?.username || undefined,
          approvedAt: entry.approvedAt,
          comment: entry.comment,
        };
      }),
    );

    return {
      _id: loan._id,
      organizationId: loan.organizationId,
      loanNumber: loan.loanNumber,
      type: loan.type,
      accountId: loan.accountId,
      account,
      lenderBorrowerName: loan.lenderBorrowerName,
      lenderBorrowerContact: loan.lenderBorrowerContact,
      startDate: loan.startDate,
      endDate: loan.endDate,
      status: loan.status,
      terms: loan.terms,
      insuranceValue: loan.insuranceValue,
      approvedBy: loan.approvedBy,
      approvedAt: loan.approvedAt,
      notes: loan.notes,
      useDetailedConditionReports: loan.useDetailedConditionReports,
      workflowStep: loan.workflowStep,
      workflowHistory: workflowHistoryWithNames,
      items,
    };
  },
});

/**
 * Update loan details
 */
export const update = mutation({
  args: {
    loanId: v.id("loans"),
    lenderBorrowerName: v.optional(v.string()),
    lenderBorrowerContact: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    terms: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending") {
      throw new Error("Can only update pending loans");
    }

    const updates: {
      lenderBorrowerName?: string;
      lenderBorrowerContact?: string;
      startDate?: number;
      endDate?: number;
      terms?: string;
      insuranceValue?: number;
      notes?: string;
    } = {};

    if (args.lenderBorrowerName !== undefined)
      updates.lenderBorrowerName = args.lenderBorrowerName;
    if (args.lenderBorrowerContact !== undefined)
      updates.lenderBorrowerContact = args.lenderBorrowerContact;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.terms !== undefined) updates.terms = args.terms;
    if (args.insuranceValue !== undefined)
      updates.insuranceValue = args.insuranceValue;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.loanId, updates);

    return null;
  },
});

export const approve = mutation({
  args: {
    loanId: v.id("loans"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.approve");

    if (loan.status !== "pending") {
      throw new Error("Loan is not pending");
    }

    const workflowConfig = await getWorkflowConfig(
      ctx,
      loan.organizationId,
      "loan",
    );

    if (workflowConfig) {
      const workflowState = resolveWorkflowStepState(
        workflowConfig.steps,
        loan.workflowStep,
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
        loan.organizationId,
        "loan",
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

      const { approvalDecision, approvalMode } =
        await recordWorkflowStepApproval(ctx, {
          organizationId: loan.organizationId,
          workflowType: "loan",
          entityId: args.loanId,
          stepNumber: currentStep,
          step: currentStepConfig,
          performedBy: userId,
          comment: args.comment,
          isPastLastStep: workflowState.isPastLastStep,
        });

      if (!approvalDecision.shouldAdvance) {
        return null;
      }

      const history = loan.workflowHistory ?? [];
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
        await ctx.db.patch(args.loanId, {
          status: "active",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: loan.organizationId,
          userId,
          action: "approved",
          entityType: "loan",
          entityId: args.loanId,
          changes: { status: "active", step: currentStep },
        });

        // Get loan items to include in email
        const loanItems = await ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
          .collect();

        // Get item names from collections
        let itemName = "Loan items";
        if (loanItems.length > 0) {
          const firstItem = loanItems[0];
          const collection = firstItem
            ? await ctx.db.get(firstItem.collectionId)
            : null;
          if (collection?.title) {
            itemName = collection.title;
            if (loanItems.length > 1) {
              itemName += ` and ${loanItems.length - 1} other item${loanItems.length > 2 ? "s" : ""}`;
            }
          }
        }

        // Format dates for email
        const startDate = loan.startDate
          ? new Date(loan.startDate).toLocaleDateString()
          : "TBD";
        const endDate = loan.endDate
          ? new Date(loan.endDate).toLocaleDateString()
          : "TBD";

        // Build loan URL
        const siteUrl = process.env.SITE_URL;
        const loanUrl = siteUrl ? `${siteUrl}/loans/${args.loanId}` : undefined;

        const creatorId = getWorkflowCreatorRecipient(history, userId);
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.notifications.sendNotification, {
            organizationId: loan.organizationId,
            userId: creatorId,
            type: "loan_approved",
            title: "Loan Approved",
            message: `Loan ${loan.loanNumber} has been fully approved and is now active.`,
            relatedEntityType: "loan",
            relatedEntityId: args.loanId,
            emailData: {
              loanId: args.loanId,
              itemName,
              borrowerName: loan.lenderBorrowerName,
              startDate,
              endDate,
              loanUrl,
            },
          });
        }
      } else {
        const nextStep = await prepareWorkflowStepAdvance(ctx, {
          organizationId: loan.organizationId,
          workflowType: "loan",
          fromStep: currentStep,
          toStep: workflowState.nextStep,
        });

        await ctx.db.patch(args.loanId, {
          workflowStep: nextStep,
          workflowHistory: history,
        });

        if (approvalMode !== "single") {
          await ctx.runMutation(internal.workflows.clearStepApprovals, {
            workflowType: "loan",
            entityId: args.loanId,
            stepNumber: currentStep,
          });
        }

        await recordWorkflowStepAdvance(ctx, {
          organizationId: loan.organizationId,
          workflowType: "loan",
          entityId: args.loanId,
          fromStep: currentStep,
          toStep: nextStep,
          performedBy: userId,
          notification: {
            title: "Loan Requires Your Approval",
            message: `Loan ${loan.loanNumber} is pending your approval at step ${nextStep}.`,
          },
        });
      }
    } else {
      await ctx.db.patch(args.loanId, {
        status: "active",
        approvedBy: userId,
        approvedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "approved",
        entityType: "loan",
        entityId: args.loanId,
        changes: { status: "active" },
      });

      const recipients = await getOrganizationNotificationRecipients(
        ctx,
        loan.organizationId,
        userId,
      );

      // Get loan items to include in email
      const loanItems = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
        .collect();

      // Get item names from collections
      let itemName = "Loan items";
      if (loanItems.length > 0) {
        const firstItem = loanItems[0];
        const collection = firstItem
          ? await ctx.db.get(firstItem.collectionId)
          : null;
        if (collection?.title) {
          itemName = collection.title;
          if (loanItems.length > 1) {
            itemName += ` and ${loanItems.length - 1} other item${loanItems.length > 2 ? "s" : ""}`;
          }
        }
      }

      // Format dates for email
      const startDate = loan.startDate
        ? new Date(loan.startDate).toLocaleDateString()
        : "TBD";
      const endDate = loan.endDate
        ? new Date(loan.endDate).toLocaleDateString()
        : "TBD";

      // Build loan URL (this will be used in the email deep link)
      const siteUrl = process.env.SITE_URL;
      const loanUrl = siteUrl ? `${siteUrl}/loans/${args.loanId}` : undefined;

      for (const recipientId of recipients) {
        await ctx.runMutation(internal.notifications.sendNotification, {
          organizationId: loan.organizationId,
          userId: recipientId,
          type: "loan_approved",
          title: "Loan Approved",
          message: `Loan ${loan.loanNumber} has been approved and is now active.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
          emailData: {
            loanId: args.loanId,
            itemName,
            borrowerName: loan.lenderBorrowerName,
            startDate,
            endDate,
            loanUrl,
          },
        });
      }
    }

    return null;
  },
});

export const reject = mutation({
  args: {
    loanId: v.id("loans"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);

    if (loan.status !== "pending") {
      throw new Error("Loan is not pending approval");
    }

    const workflowConfig = await getWorkflowConfig(
      ctx,
      loan.organizationId,
      "loan",
    );
    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      loan.workflowStep,
    );
    const currentStep = workflowState.currentStep ?? loan.workflowStep ?? 1;
    const canApprove = await canApproveAtStep(
      ctx,
      loan.organizationId,
      "loan",
      currentStep,
    );

    if (!canApprove) {
      await requirePermission(ctx, loan.organizationId, "loans.approve");
    }

    const history = loan.workflowHistory ?? [];
    history.push({
      step: currentStep,
      approvedBy: userId,
      approvedAt: Date.now(),
      comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
    });

    await ctx.db.patch(args.loanId, {
      status: "cancelled",
      workflowHistory: history,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "rejected",
      entityType: "loan",
      entityId: args.loanId,
      changes: { status: "cancelled", comment: args.comment },
    });

    // Get loan items to include in email
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    // Get item names from collections
    let itemName = "Loan items";
    if (loanItems.length > 0) {
      const firstItem = loanItems[0];
      const collection = firstItem
        ? await ctx.db.get(firstItem.collectionId)
        : null;
      if (collection?.title) {
        itemName = collection.title;
        if (loanItems.length > 1) {
          itemName += ` and ${loanItems.length - 1} other item${loanItems.length > 2 ? "s" : ""}`;
        }
      }
    }

    // Format dates for email
    const startDate = loan.startDate
      ? new Date(loan.startDate).toLocaleDateString()
      : "TBD";
    const endDate = loan.endDate
      ? new Date(loan.endDate).toLocaleDateString()
      : "TBD";

    // Build loan URL
    const siteUrl = process.env.SITE_URL;
    const loanUrl = siteUrl ? `${siteUrl}/loans/${args.loanId}` : undefined;

    const creatorId = getWorkflowCreatorRecipient(history, userId);
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.notifications.sendNotification, {
        organizationId: loan.organizationId,
        userId: creatorId,
        type: "loan_rejected",
        title: "Loan Rejected",
        message: `Loan ${loan.loanNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
        emailData: {
          loanId: args.loanId,
          itemName,
          borrowerName: loan.lenderBorrowerName,
          startDate,
          endDate,
          loanUrl,
        },
      });
    }

    return null;
  },
});

export const returnLoan = mutation({
  args: {
    loanId: v.id("loans"),
    conditionIn: v.optional(v.string()),
    loanItemIds: v.optional(v.array(v.id("loanItems"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "active" && loan.status !== "dispatched") {
      throw new Error("Loan must be active or dispatched to return");
    }

    const movement = await returnLoanItems(ctx, {
      loanId: args.loanId,
      organizationId: loan.organizationId,
      changedBy: userId,
      conditionIn: args.conditionIn,
      selectedLoanItemIds: args.loanItemIds,
    });

    // Update loan status only if all items are now returned (either in this operation or after it)
    if (movement.allItemsNowReturned) {
      await ctx.db.patch(args.loanId, {
        status: "returned",
      });

      // Log audit action for full return
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "returned",
        entityType: "loan",
        entityId: args.loanId,
        changes: {
          status: "returned",
          itemsReturned: movement.returnedItemCount,
          returnedItemIds: movement.returnedItemIds,
        },
      });

      // Notify all users about full loan return
      const recipients = await getOrganizationNotificationRecipients(
        ctx,
        loan.organizationId,
        userId,
      );

      for (const recipientId of recipients) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: loan.organizationId,
          userId: recipientId,
          type: "loan_returned",
          title: "Loan Returned",
          message: `Loan ${loan.loanNumber} has been returned.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
        });
      }
    } else {
      // Partial return - log action but don't change loan status
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "items_returned",
        entityType: "loan",
        entityId: args.loanId,
        changes: {
          itemsReturned: movement.returnedItemCount,
          totalItems: movement.totalItemCount,
          returnedItemIds: movement.returnedItemIds,
        },
      });

      // Notify about partial return
      const recipients = await getOrganizationNotificationRecipients(
        ctx,
        loan.organizationId,
        userId,
      );

      for (const recipientId of recipients) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: loan.organizationId,
          userId: recipientId,
          type: "loan_partial_return",
          title: "Loan Items Returned",
          message: `${movement.returnedItemCount} of ${movement.totalItemCount} items from loan ${loan.loanNumber} have been returned.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
        });
      }
    }

    return null;
  },
});

/**
 * Dispatch loan (mark items as shipped)
 */
export const dispatch = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "active") {
      throw new Error("Loan must be active to dispatch");
    }

    await dispatchLoanItems(ctx, {
      loanId: args.loanId,
      changedBy: userId,
    });

    await ctx.db.patch(args.loanId, {
      status: "dispatched",
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "dispatched",
      entityType: "loan",
      entityId: args.loanId,
      changes: { status: "dispatched" },
    });

    // Notify all users in organization about loan dispatch (except the dispatcher)
    const recipients = await getOrganizationNotificationRecipients(
      ctx,
      loan.organizationId,
      userId,
    );

    for (const recipientId of recipients) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: loan.organizationId,
        userId: recipientId,
        type: "loan_dispatched",
        title: "Loan Dispatched",
        message: `Loan ${loan.loanNumber} has been dispatched.`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
      });
    }

    return null;
  },
});

/**
 * Cancel loan
 */
export const cancel = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (
      loan.status !== "pending" &&
      loan.status !== "active" &&
      loan.status !== "dispatched"
    ) {
      throw new Error("Can only cancel pending, active, or dispatched loans");
    }

    // Update loan status
    await ctx.db.patch(args.loanId, {
      status: "cancelled",
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "cancelled",
      entityType: "loan",
      entityId: args.loanId,
      changes: { status: "cancelled" },
    });

    await restoreLoanCollections(ctx, {
      loanId: args.loanId,
      changedBy: userId,
    });

    // Notify all users in organization about loan cancellation (except the user who cancelled it)
    const recipients = await getOrganizationNotificationRecipients(
      ctx,
      loan.organizationId,
      userId,
    );

    for (const recipientId of recipients) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: loan.organizationId,
        userId: recipientId,
        type: "loan_cancelled",
        title: "Loan Cancelled",
        message: `Loan ${loan.loanNumber} has been cancelled.`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
      });
    }

    return null;
  },
});

/**
 * Return single item from loan
 */
export const returnItem = mutation({
  args: {
    loanId: v.id("loans"),
    collectionId: v.id("collections"),
    conditionIn: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);

    if (loan.status !== "active") {
      throw new Error("Loan is not active");
    }

    await requirePermission(ctx, loan.organizationId, "loans.update");

    // Find loan item
    const loanItem = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .filter((q) => q.eq(q.field("loanId"), args.loanId))
      .first();

    if (!loanItem) {
      throw new Error("Item not found in this loan");
    }

    // Update loan item with return info
    await ctx.db.patch(loanItem._id, {
      conditionIn: args.conditionIn,
      notes: args.notes
        ? loanItem.notes
          ? `${loanItem.notes}\n${args.notes}`
          : args.notes
        : loanItem.notes,
    });

    // If it's an INCOMING loan, returning it means we send it back to owner.
    // The user requested: "objects shuld be removed from collection when return (moved it to Deaccessions)"
    if (loan.type === "incoming") {
      // Create deaccession record
      const collection = await ctx.db.get(args.collectionId);
      if (collection) {
        // Check if already deaccessioned
        if (collection.status !== "deaccessioned") {
          // Create Deaccession record
          await ctx.db.insert("deaccessions", {
            organizationId: loan.organizationId,
            collectionId: args.collectionId,
            deaccessionNumber: `RET-${collection.accessionNumber}`, // Auto-generated suffix
            dateDeaccessioned: Date.now(),
            reason: "Returned to lender",
            method: "transfer",
            disposition: `Returned to ${loan.lenderBorrowerName}`,
            status: "approved",
            approvedBy: userId,
            approvedAt: Date.now(),
            workflowStep: 0,
          });

          // Update collection status
          await markCollectionDeaccessioned(ctx, {
            collectionId: args.collectionId,
            changedBy: userId,
          });
        }
      }
    } else {
      // Outgoing loan being returned TO US.
      // Status should go back to "active".
      await markCollectionActive(ctx, {
        collectionId: args.collectionId,
        changedBy: userId,
      });
    }

    return null;
  },
});

/**
 * Create detailed condition report for loan item
 */
export const createConditionReport = mutation({
  args: {
    loanItemId: v.id("loanItems"),
    reportType: v.union(v.literal("out"), v.literal("in")),
    conditionDescription: v.string(),
    damages: v.optional(
      v.array(
        v.object({
          type: v.string(),
          location: v.string(),
          severity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    photos: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("conditionReports"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loanItem = await ctx.db.get(args.loanItemId);
    if (!loanItem) {
      throw new Error("Loan item not found");
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);

    if (!loan.useDetailedConditionReports) {
      throw new Error("Loan does not use detailed condition reports");
    }

    await requirePermission(ctx, loan.organizationId, "loans.update");

    const reportId = await ctx.db.insert("conditionReports", {
      loanItemId: args.loanItemId,
      reportType: args.reportType,
      conditionDescription: args.conditionDescription,
      damages: args.damages,
      photos: args.photos,
      assessedBy: userId,
      assessedAt: Date.now(),
    });

    // Link report to loan item
    await ctx.db.patch(args.loanItemId, {
      conditionReportId: reportId,
    });

    return reportId;
  },
});

/**
 * Update condition report
 */
export const updateConditionReport = mutation({
  args: {
    reportId: v.id("conditionReports"),
    conditionDescription: v.optional(v.string()),
    damages: v.optional(
      v.array(
        v.object({
          type: v.string(),
          location: v.string(),
          severity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    photos: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Condition report not found");
    }

    const loanItem = await ctx.db.get(report.loanItemId);
    if (!loanItem) {
      throw new Error("Loan item not found");
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    const updates: {
      conditionDescription?: string;
      damages?: Array<{
        type: string;
        location: string;
        severity: string;
        notes?: string;
      }>;
      photos?: Array<Id<"_storage">>;
    } = {};

    if (args.conditionDescription !== undefined)
      updates.conditionDescription = args.conditionDescription;
    if (args.damages !== undefined) updates.damages = args.damages;
    if (args.photos !== undefined) updates.photos = args.photos;

    await ctx.db.patch(args.reportId, updates);

    return null;
  },
});

/**
 * Get condition report
 */
export const getConditionReport = query({
  args: {
    reportId: v.id("conditionReports"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conditionReports"),
      loanItemId: v.id("loanItems"),
      reportType: v.union(v.literal("out"), v.literal("in")),
      conditionDescription: v.string(),
      damages: v.optional(
        v.array(
          v.object({
            type: v.string(),
            location: v.string(),
            severity: v.string(),
            notes: v.optional(v.string()),
          }),
        ),
      ),
      photos: v.optional(v.array(v.id("_storage"))),
      photoUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      assessedBy: v.id("users"),
      assessedAt: v.number(),
      assessorName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    const loanItem = await ctx.db.get(report.loanItemId);
    if (!loanItem) {
      return null;
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      return null;
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.read");

    const photoUrls = report.photos
      ? await Promise.all(
          report.photos.map(async (photoId) => ctx.storage.getUrl(photoId)),
        )
      : undefined;

    const assessor = await ctx.db.get(report.assessedBy);

    return {
      _id: report._id,
      loanItemId: report.loanItemId,
      reportType: report.reportType,
      conditionDescription: report.conditionDescription,
      damages: report.damages,
      photos: report.photos,
      photoUrls,
      assessedBy: report.assessedBy,
      assessedAt: report.assessedAt,
      assessorName: assessor?.name || assessor?.username || undefined,
    };
  },
});

export const uploadLoanDocument = mutation({
  args: {
    loanId: v.id("loans"),
    storageId: v.id("_storage"),
    documentType: v.union(
      v.literal("agreement"),
      v.literal("insurance"),
      v.literal("other"),
    ),
    fileName: v.string(),
  },
  returns: v.id("loanDocuments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.update");

    const documentId = await ctx.db.insert("loanDocuments", {
      loanId: args.loanId,
      storageId: args.storageId,
      documentType: args.documentType,
      fileName: args.fileName,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });

    return documentId;
  },
});

export const listLoanDocuments = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.array(
    v.object({
      _id: v.id("loanDocuments"),
      storageId: v.id("_storage"),
      documentType: v.union(
        v.literal("agreement"),
        v.literal("insurance"),
        v.literal("other"),
      ),
      fileName: v.string(),
      url: v.union(v.string(), v.null()),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
      uploaderName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requireLoansAccess(ctx, loan.organizationId);
    await requirePermission(ctx, loan.organizationId, "loans.read");

    const documents = await ctx.db
      .query("loanDocuments")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        const uploader = await ctx.db.get(doc.uploadedBy);

        return {
          _id: doc._id,
          storageId: doc.storageId,
          documentType: doc.documentType,
          fileName: doc.fileName,
          url,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
          uploaderName: uploader?.name || uploader?.username || undefined,
        };
      }),
    );

    return documentsWithUrls;
  },
});

/**
 * Delete loan document
 */
export const deleteLoanDocument = mutation({
  args: {
    documentId: v.id("loanDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const loan = await ctx.db.get(document.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    // Delete from storage
    await ctx.storage.delete(document.storageId);

    // Delete record
    await ctx.db.delete(args.documentId);

    return null;
  },
});

/**
 * TEST UTILITY: Delete all loans and loan items for an organization
 * WARNING: This is a destructive operation for testing purposes only
 */
export const deleteAllLoans = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    deletedLoans: v.number(),
    deletedLoanItems: v.number(),
    updatedCollections: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "loans.update");

    // Get all loans for the organization
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    let deletedLoanItems = 0;
    let updatedCollections = 0;

    // For each loan, delete loan items and update collection statuses
    for (const loan of loans) {
      const loanItems = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
        .collect();

      for (const item of loanItems) {
        // Update collection status back to active
        await markCollectionActive(ctx, {
          collectionId: item.collectionId,
          changedBy: userId,
        });
        updatedCollections++;

        // Delete loan item
        await ctx.db.delete(item._id);
        deletedLoanItems++;
      }

      // Delete the loan
      await ctx.db.delete(loan._id);
    }

    return {
      deletedLoans: loans.length,
      deletedLoanItems,
      updatedCollections,
    };
  },
});

/**
 * Check which collections are already in active or pending loans
 */
export const checkCollectionsInActiveLoans = query({
  args: {
    collectionIds: v.array(v.id("collections")),
  },
  returns: v.array(
    v.object({
      collectionId: v.id("collections"),
      loanId: v.id("loans"),
      loanNumber: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("dispatched"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.collectionIds.length === 0) {
      return [];
    }

    // Get the organization from the first collection
    const firstCollectionId = args.collectionIds[0];
    if (!firstCollectionId) {
      return [];
    }

    const firstCollection = await ctx.db.get(firstCollectionId);
    if (!firstCollection) {
      return [];
    }

    await requirePermission(ctx, firstCollection.organizationId, "loans.read");

    const results: Array<{
      collectionId: Id<"collections">;
      loanId: Id<"loans">;
      loanNumber: string;
      status: "pending" | "active" | "dispatched" | "returned" | "cancelled";
    }> = [];

    // Check each collection for active loans
    for (const collectionId of args.collectionIds) {
      const loanItems = await ctx.db
        .query("loanItems")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect();

      for (const loanItem of loanItems) {
        const loan = await ctx.db.get(loanItem.loanId);
        if (
          loan &&
          (loan.status === "pending" ||
            loan.status === "active" ||
            loan.status === "dispatched")
        ) {
          results.push({
            collectionId,
            loanId: loan._id,
            loanNumber: loan.loanNumber,
            status: loan.status,
          });
          break; // Only need one active loan per collection
        }
      }
    }

    return results;
  },
});

/**
 * Get loans for a specific collection object
 */
export const getLoansForCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("loans"),
      loanNumber: v.string(),
      type: v.union(v.literal("incoming"), v.literal("outgoing")),
      lenderBorrowerName: v.string(),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("dispatched"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    const hasLoansFeature = await hasFeatureAccess(
      ctx,
      collection.organizationId,
      "loans",
    );
    if (!hasLoansFeature) {
      return [];
    }

    const canReadLoans = await hasPermission(
      ctx,
      collection.organizationId,
      "loans.read",
    );
    if (!canReadLoans) {
      return [];
    }

    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    const loanIds = [...new Set(loanItems.map((item) => item.loanId))];

    const loans = await Promise.all(
      loanIds.map(async (loanId) => {
        const loan = await ctx.db.get(loanId);
        if (!loan) return null;
        return {
          _id: loan._id,
          loanNumber: loan.loanNumber,
          type: loan.type,
          lenderBorrowerName: loan.lenderBorrowerName,
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
        };
      }),
    );

    return loans.filter(
      (loan): loan is NonNullable<typeof loan> => loan !== null,
    );
  },
});

export const getWorkflowHistory = query({
  args: {
    loanId: v.id("loans"),
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
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requirePermission(ctx, loan.organizationId, "loans.read");

    const history = loan.workflowHistory ?? [];

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
 * Bulk approve multiple pending loans
 */
export const bulkApprove = mutation({
  args: {
    loanIds: v.array(v.id("loans")),
  },
  returns: v.object({
    approved: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.loanIds.length === 0) {
      return { approved: 0, skipped: 0, errors: [] };
    }

    let approved = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const loanId of args.loanIds) {
      const loan = await ctx.db.get(loanId);
      if (!loan) {
        errors.push(`Loan ${loanId} not found`);
        skipped++;
        continue;
      }

      // Check permission for each loan's organization
      try {
        await requirePermission(ctx, loan.organizationId, "loans.approve");
      } catch {
        errors.push(`No permission to approve loan ${loan.loanNumber}`);
        skipped++;
        continue;
      }

      // Only approve pending loans
      if (loan.status !== "pending") {
        errors.push(
          `Loan ${loan.loanNumber} is not pending (status: ${loan.status})`,
        );
        skipped++;
        continue;
      }

      // Check workflow config
      const workflowConfig = await getWorkflowConfig(
        ctx,
        loan.organizationId,
        "loan",
      );

      if (workflowConfig) {
        const workflowState = resolveWorkflowStepState(
          workflowConfig.steps,
          loan.workflowStep,
        );
        const currentStep = workflowState.currentStep;

        if (currentStep === undefined) {
          errors.push(
            `Loan ${loan.loanNumber} workflow has no approval steps configured`,
          );
          skipped++;
          continue;
        }
        if (!workflowState.hasCurrentStep && !workflowState.isPastLastStep) {
          errors.push(
            `Loan ${loan.loanNumber} current workflow step is not configured`,
          );
          skipped++;
          continue;
        }

        const canApprove = await canApproveAtStep(
          ctx,
          loan.organizationId,
          "loan",
          currentStep,
        );

        if (!canApprove) {
          errors.push(
            `Cannot approve loan ${loan.loanNumber} at current workflow step`,
          );
          skipped++;
          continue;
        }

        const currentStepConfig = workflowConfig.steps.find(
          (step) => step.stepNumber === currentStep,
        );
        if (!currentStepConfig) {
          errors.push(
            `Loan ${loan.loanNumber} current workflow step is not configured`,
          );
          skipped++;
          continue;
        }

        const { approvalDecision, approvalMode } =
          await recordWorkflowStepApproval(ctx, {
            organizationId: loan.organizationId,
            workflowType: "loan",
            entityId: loanId,
            stepNumber: currentStep,
            step: currentStepConfig,
            performedBy: userId,
            comment: "Bulk approved",
            isPastLastStep: workflowState.isPastLastStep,
          });

        if (!approvalDecision.shouldAdvance) {
          approved++;
          continue;
        }

        const history = loan.workflowHistory ?? [];
        if (!workflowState.isPastLastStep) {
          history.push({
            step: currentStep,
            approvedBy: userId,
            approvedAt: Date.now(),
            comment: "Bulk approved",
          });
        }

        const isLastStep =
          workflowState.isPastLastStep || workflowState.isLastStep;

        if (isLastStep) {
          await ctx.db.patch(loanId, {
            status: "active",
            approvedBy: userId,
            approvedAt: Date.now(),
            workflowHistory: history,
          });
        } else {
          const nextStep = workflowState.nextStep;
          if (nextStep === undefined) {
            errors.push(
              `Loan ${loan.loanNumber} next workflow step is not configured`,
            );
            skipped++;
            continue;
          }

          await ctx.db.patch(loanId, {
            workflowStep: nextStep,
            workflowHistory: history,
          });

          if (approvalMode !== "single") {
            await ctx.runMutation(internal.workflows.clearStepApprovals, {
              workflowType: "loan",
              entityId: loanId,
              stepNumber: currentStep,
            });
          }
        }
      } else {
        // No workflow, direct approval
        await ctx.db.patch(loanId, {
          status: "active",
          approvedBy: userId,
          approvedAt: Date.now(),
        });
      }

      // Log audit action
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "approved",
        entityType: "loan",
        entityId: loanId,
        changes: { status: "active", bulkAction: true },
      });

      approved++;
    }

    return { approved, skipped, errors };
  },
});

/**
 * Bulk cancel multiple loans
 */
export const bulkCancel = mutation({
  args: {
    loanIds: v.array(v.id("loans")),
  },
  returns: v.object({
    cancelled: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.loanIds.length === 0) {
      return { cancelled: 0, skipped: 0, errors: [] };
    }

    let cancelled = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const loanId of args.loanIds) {
      const loan = await ctx.db.get(loanId);
      if (!loan) {
        errors.push(`Loan ${loanId} not found`);
        skipped++;
        continue;
      }

      // Check permission
      try {
        await requirePermission(ctx, loan.organizationId, "loans.update");
      } catch {
        errors.push(`No permission to cancel loan ${loan.loanNumber}`);
        skipped++;
        continue;
      }

      // Only cancel pending, active, or dispatched loans
      if (
        loan.status !== "pending" &&
        loan.status !== "active" &&
        loan.status !== "dispatched"
      ) {
        errors.push(
          `Loan ${loan.loanNumber} cannot be cancelled (status: ${loan.status})`,
        );
        skipped++;
        continue;
      }

      // Update loan status
      await ctx.db.patch(loanId, {
        status: "cancelled",
      });

      // Update collection statuses back to active
      const loanItems = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect();

      for (const item of loanItems) {
        await markCollectionActive(ctx, {
          collectionId: item.collectionId,
          changedBy: userId,
        });
      }

      // Log audit action
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "cancelled",
        entityType: "loan",
        entityId: loanId,
        changes: { status: "cancelled", bulkAction: true },
      });

      cancelled++;
    }

    return { cancelled, skipped, errors };
  },
});

// =============================================================================
// LOAN EXTENSION REQUESTS
// =============================================================================

/**
 * Request an extension for a loan
 */
export const requestExtension = mutation({
  args: {
    loanId: v.id("loans"),
    newEndDate: v.number(),
    reason: v.optional(v.string()),
  },
  returns: v.id("loanExtensionRequests"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Verify permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    // Can only extend active or dispatched loans
    if (loan.status !== "active" && loan.status !== "dispatched") {
      throw new Error(
        "Can only request extension for active or dispatched loans",
      );
    }

    // New end date must be after current end date
    if (loan.endDate && args.newEndDate <= loan.endDate) {
      throw new Error("New end date must be after current end date");
    }

    // Check for existing pending request
    const existingRequest = await ctx.db
      .query("loanExtensionRequests")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("An extension request is already pending for this loan");
    }

    const requestId = await ctx.db.insert("loanExtensionRequests", {
      loanId: args.loanId,
      organizationId: loan.organizationId,
      requestedBy: userId,
      requestedAt: Date.now(),
      originalEndDate: loan.endDate ?? Date.now(),
      newRequestedEndDate: args.newEndDate,
      reason: args.reason,
      status: "pending",
    });

    // Create notification for approvers
    const approvers = await getUsersToNotifyForWorkflowStep(
      ctx,
      loan.organizationId,
      "loan",
      1,
    );

    for (const approverId of approvers) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: loan.organizationId,
        userId: approverId,
        type: "loan_extension_requested",
        title: "Loan Extension Requested",
        message: `Extension requested for loan ${loan.loanNumber}`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
      });
    }

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "extension_requested",
      entityType: "loan",
      entityId: args.loanId,
      changes: {
        originalEndDate: loan.endDate,
        newRequestedEndDate: args.newEndDate,
        reason: args.reason,
      },
    });

    return requestId;
  },
});

/**
 * Approve a loan extension request
 */
export const approveExtension = mutation({
  args: {
    requestId: v.id("loanExtensionRequests"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Extension request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Extension request is not pending");
    }

    // Verify permission
    await requirePermission(ctx, request.organizationId, "loans.approve");

    const loan = await ctx.db.get(request.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Update the request
    await ctx.db.patch(args.requestId, {
      status: "approved",
      approvedBy: userId,
      approvedAt: Date.now(),
      approvalComment: args.comment,
    });

    // Update the loan end date
    await ctx.db.patch(request.loanId, {
      endDate: request.newRequestedEndDate,
    });

    // Notify the requester
    await ctx.runMutation(internal.audit.createNotificationInternal, {
      organizationId: request.organizationId,
      userId: request.requestedBy,
      type: "loan_extension_approved",
      title: "Loan Extension Approved",
      message: `Extension approved for loan ${loan.loanNumber}`,
      relatedEntityType: "loan",
      relatedEntityId: request.loanId,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "extension_approved",
      entityType: "loan",
      entityId: request.loanId,
      changes: {
        previousEndDate: request.originalEndDate,
        newEndDate: request.newRequestedEndDate,
      },
    });

    return null;
  },
});

/**
 * Reject a loan extension request
 */
export const rejectExtension = mutation({
  args: {
    requestId: v.id("loanExtensionRequests"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Extension request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Extension request is not pending");
    }

    // Verify permission
    await requirePermission(ctx, request.organizationId, "loans.approve");

    const loan = await ctx.db.get(request.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Update the request
    await ctx.db.patch(args.requestId, {
      status: "rejected",
      rejectionReason: args.reason,
    });

    // Notify the requester
    await ctx.runMutation(internal.audit.createNotificationInternal, {
      organizationId: request.organizationId,
      userId: request.requestedBy,
      type: "loan_extension_rejected",
      title: "Loan Extension Rejected",
      message: `Extension rejected for loan ${loan.loanNumber}: ${args.reason}`,
      relatedEntityType: "loan",
      relatedEntityId: request.loanId,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "extension_rejected",
      entityType: "loan",
      entityId: request.loanId,
      changes: { rejectionReason: args.reason },
    });

    return null;
  },
});

/**
 * List extension requests for a loan
 */
export const listExtensionRequests = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.array(
    v.object({
      _id: v.id("loanExtensionRequests"),
      _creationTime: v.number(),
      loanId: v.id("loans"),
      organizationId: v.id("organizations"),
      requestedBy: v.id("users"),
      requestedByName: v.optional(v.string()),
      requestedAt: v.number(),
      originalEndDate: v.number(),
      newRequestedEndDate: v.number(),
      reason: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      approvedBy: v.optional(v.id("users")),
      approvedByName: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      approvalComment: v.optional(v.string()),
      rejectionReason: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return [];
    }

    await requirePermission(ctx, loan.organizationId, "loans.read");

    const requests = await ctx.db
      .query("loanExtensionRequests")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();

    // Enrich with user names
    return await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requestedBy);
        const approver = request.approvedBy
          ? await ctx.db.get(request.approvedBy)
          : null;

        return {
          ...request,
          requestedByName: requester?.name ?? requester?.email,
          approvedByName: approver?.name ?? approver?.email,
        };
      }),
    );
  },
});

// =============================================================================
// LOAN RETURN REMINDERS (Internal functions for cron)
// =============================================================================

/**
 * Check for loans due soon or overdue and send reminders
 * Called by cron job
 */
export const checkLoanRemindersInternal = internalMutation({
  args: {},
  returns: v.object({
    remindersCreated: v.number(),
    loansChecked: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Thresholds for reminders (in days before due date)
    const thresholds = [
      { days: 30, type: "due_soon_30" as const },
      { days: 14, type: "due_soon_14" as const },
      { days: 7, type: "due_soon_7" as const },
      { days: 1, type: "due_soon_1" as const },
      { days: 0, type: "overdue" as const },
    ];

    let remindersCreated = 0;
    let loansChecked = 0;

    // Get all active/dispatched loans with end dates
    const activeLoans = await ctx.db
      .query("loans")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "dispatched"),
          ),
          q.neq(q.field("endDate"), undefined),
        ),
      )
      .collect();

    for (const loan of activeLoans) {
      if (!loan.endDate) continue;
      loansChecked++;

      const daysUntilDue = Math.floor((loan.endDate - now) / oneDay);

      for (const threshold of thresholds) {
        // Check if we should send this type of reminder
        const shouldSend =
          threshold.type === "overdue"
            ? daysUntilDue < 0
            : daysUntilDue <= threshold.days &&
              daysUntilDue >
                (thresholds[thresholds.indexOf(threshold) + 1]?.days ?? -1);

        if (!shouldSend) continue;

        // Check if reminder already sent
        const existingReminder = await ctx.db
          .query("loanReminders")
          .withIndex("by_loan_and_type", (q) =>
            q.eq("loanId", loan._id).eq("reminderType", threshold.type),
          )
          .first();

        if (existingReminder) continue;

        // Create reminder record
        await ctx.db.insert("loanReminders", {
          loanId: loan._id,
          organizationId: loan.organizationId,
          reminderType: threshold.type,
          sentAt: now,
          dueDate: loan.endDate,
        });

        // Get users to notify (loan creator and org admins)
        const orgMembers = await ctx.db
          .query("userOrganizations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", loan.organizationId),
          )
          .collect();

        const notificationTitle =
          threshold.type === "overdue"
            ? "Loan Overdue"
            : `Loan Due in ${threshold.days} ${threshold.days === 1 ? "Day" : "Days"}`;

        const notificationMessage =
          threshold.type === "overdue"
            ? `Loan ${loan.loanNumber} is overdue for return`
            : `Loan ${loan.loanNumber} is due in ${threshold.days} ${threshold.days === 1 ? "day" : "days"}`;

        for (const member of orgMembers) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: loan.organizationId,
            userId: member.userId,
            type:
              threshold.type === "overdue"
                ? "loan_overdue"
                : "loan_return_due_soon",
            title: notificationTitle,
            message: notificationMessage,
            relatedEntityType: "loan",
            relatedEntityId: loan._id,
          });
        }

        remindersCreated++;
        break; // Only send one reminder type per loan per cron run
      }
    }

    return { remindersCreated, loansChecked };
  },
});

// ============================================
// Condition Dispute Workflow
// ============================================

const conditionDisputeStatusValidator = v.union(
  v.literal("reported"),
  v.literal("investigating"),
  v.literal("resolved_in_favor_lender"),
  v.literal("resolved_in_favor_borrower"),
  v.literal("resolved_compromise"),
  v.literal("withdrawn"),
);

export const createConditionDispute = mutation({
  args: {
    loanId: v.id("loans"),
    collectionId: v.id("collections"),
    conditionBefore: v.string(),
    conditionBeforeNotes: v.optional(v.string()),
    conditionBeforePhotos: v.optional(v.array(v.id("_storage"))),
    conditionAfter: v.string(),
    conditionAfterNotes: v.optional(v.string()),
    conditionAfterPhotos: v.optional(v.array(v.id("_storage"))),
    disputeDescription: v.string(),
    claimAmount: v.optional(v.number()),
  },
  returns: v.id("conditionDisputes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requirePermission(ctx, loan.organizationId, "loans.update");

    // Verify the collection item is part of this loan
    const loanItem = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
      .first();

    if (!loanItem) {
      throw new Error("Item is not part of this loan");
    }

    const disputeId = await ctx.db.insert("conditionDisputes", {
      loanId: args.loanId,
      organizationId: loan.organizationId,
      collectionId: args.collectionId,
      conditionBefore: args.conditionBefore,
      conditionBeforeNotes: args.conditionBeforeNotes,
      conditionBeforePhotos: args.conditionBeforePhotos,
      conditionAfter: args.conditionAfter,
      conditionAfterNotes: args.conditionAfterNotes,
      conditionAfterPhotos: args.conditionAfterPhotos,
      disputeDescription: args.disputeDescription,
      reportedBy: userId,
      reportedAt: Date.now(),
      status: "reported",
      claimAmount: args.claimAmount,
    });

    // Log the action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "created",
      entityType: "conditionDispute",
      entityId: disputeId,
      changes: { loanId: args.loanId, collectionId: args.collectionId },
    });

    // Notify relevant users
    const orgMembers = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", loan.organizationId),
      )
      .collect();

    for (const member of orgMembers) {
      if (member.userId !== userId) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: loan.organizationId,
          userId: member.userId,
          type: "condition_dispute_created",
          title: "Condition Dispute Reported",
          message: `A condition dispute has been reported for loan ${loan.loanNumber}`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
        });
      }
    }

    return disputeId;
  },
});

export const startDisputeInvestigation = mutation({
  args: {
    disputeId: v.id("conditionDisputes"),
    investigationNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

    if (dispute.status !== "reported") {
      throw new Error("Dispute is not in reported status");
    }

    await ctx.db.patch(args.disputeId, {
      status: "investigating",
      investigatorId: userId,
      investigationStartedAt: Date.now(),
      investigationNotes: args.investigationNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: dispute.organizationId,
      userId,
      action: "updated",
      entityType: "conditionDispute",
      entityId: args.disputeId,
      changes: { status: "investigating" },
    });

    // Notify the reporter
    if (dispute.reportedBy !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: dispute.organizationId,
        userId: dispute.reportedBy,
        type: "condition_dispute_investigating",
        title: "Dispute Under Investigation",
        message: "Your condition dispute is now under investigation",
        relatedEntityType: "loan",
        relatedEntityId: dispute.loanId,
      });
    }

    return null;
  },
});

export const updateDisputeInvestigation = mutation({
  args: {
    disputeId: v.id("conditionDisputes"),
    investigationNotes: v.optional(v.string()),
    investigationPhotos: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

    if (dispute.status !== "investigating") {
      throw new Error("Dispute is not under investigation");
    }

    const updates: Record<string, unknown> = {};
    if (args.investigationNotes !== undefined) {
      updates.investigationNotes = args.investigationNotes;
    }
    if (args.investigationPhotos !== undefined) {
      updates.investigationPhotos = args.investigationPhotos;
    }

    await ctx.db.patch(args.disputeId, updates);

    return null;
  },
});

export const resolveConditionDispute = mutation({
  args: {
    disputeId: v.id("conditionDisputes"),
    resolution: v.union(
      v.literal("resolved_in_favor_lender"),
      v.literal("resolved_in_favor_borrower"),
      v.literal("resolved_compromise"),
    ),
    resolutionNotes: v.string(),
    settlementAmount: v.optional(v.number()),
    createInsuranceClaim: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

    if (dispute.status !== "reported" && dispute.status !== "investigating") {
      throw new Error("Dispute cannot be resolved in current status");
    }

    const updates: Record<string, unknown> = {
      status: args.resolution,
      resolvedBy: userId,
      resolvedAt: Date.now(),
      resolutionNotes: args.resolutionNotes,
    };

    if (args.settlementAmount !== undefined) {
      updates.settlementAmount = args.settlementAmount;
    }

    // Create insurance claim if requested and damage was confirmed
    if (
      args.createInsuranceClaim &&
      args.resolution === "resolved_in_favor_borrower"
    ) {
      const loan = await ctx.db.get(dispute.loanId);
      if (loan) {
        // Find active coverage for this collection to get the policy
        const coverage = await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", dispute.collectionId),
          )
          .filter((q) => q.eq(q.field("status"), "active"))
          .first();

        if (coverage) {
          const claimId = await ctx.db.insert("insuranceClaims", {
            organizationId: dispute.organizationId,
            collectionIds: [dispute.collectionId],
            policyId: coverage.policyId,
            loanId: dispute.loanId,
            claimNumber: `CLM-${Date.now()}`,
            incidentDate: dispute.reportedAt,
            incidentType: "damage",
            incidentDescription: `Damage during loan ${loan.loanNumber}: ${dispute.disputeDescription}`,
            claimedAmount: dispute.claimAmount ?? coverage.coveredValue,
            status: "draft",
            reportedDate: Date.now(),
            createdAt: Date.now(),
            createdBy: userId,
          });
          updates.insuranceClaimId = claimId;
        }
      }
    }

    await ctx.db.patch(args.disputeId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: dispute.organizationId,
      userId,
      action: "resolved",
      entityType: "conditionDispute",
      entityId: args.disputeId,
      changes: {
        status: args.resolution,
        resolutionNotes: args.resolutionNotes,
      },
    });

    // Notify the reporter
    if (dispute.reportedBy !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: dispute.organizationId,
        userId: dispute.reportedBy,
        type: "condition_dispute_resolved",
        title: "Dispute Resolved",
        message: "Your condition dispute has been resolved",
        relatedEntityType: "loan",
        relatedEntityId: dispute.loanId,
      });
    }

    return null;
  },
});

export const withdrawConditionDispute = mutation({
  args: {
    disputeId: v.id("conditionDisputes"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

    // Only the reporter or admins can withdraw
    if (dispute.reportedBy !== userId) {
      await requirePermission(ctx, dispute.organizationId, "loans.approve");
    }

    if (
      dispute.status === "resolved_in_favor_lender" ||
      dispute.status === "resolved_in_favor_borrower" ||
      dispute.status === "resolved_compromise" ||
      dispute.status === "withdrawn"
    ) {
      throw new Error("Dispute is already resolved or withdrawn");
    }

    await ctx.db.patch(args.disputeId, {
      status: "withdrawn",
      resolvedBy: userId,
      resolvedAt: Date.now(),
      resolutionNotes: args.reason ?? "Dispute withdrawn",
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: dispute.organizationId,
      userId,
      action: "withdrawn",
      entityType: "conditionDispute",
      entityId: args.disputeId,
      changes: { reason: args.reason },
    });

    return null;
  },
});

export const listConditionDisputes = query({
  args: {
    loanId: v.optional(v.id("loans")),
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(conditionDisputeStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("conditionDisputes"),
        _creationTime: v.number(),
        loanId: v.id("loans"),
        organizationId: v.id("organizations"),
        collectionId: v.id("collections"),
        conditionBefore: v.string(),
        conditionAfter: v.string(),
        disputeDescription: v.string(),
        reportedBy: v.id("users"),
        reportedAt: v.number(),
        status: conditionDisputeStatusValidator,
        investigatorId: v.optional(v.id("users")),
        resolvedAt: v.optional(v.number()),
        claimAmount: v.optional(v.number()),
        settlementAmount: v.optional(v.number()),
        loan: v.optional(
          v.object({
            loanNumber: v.string(),
            type: v.union(v.literal("incoming"), v.literal("outgoing")),
          }),
        ),
        collection: v.optional(
          v.object({
            title: v.string(),
            accessionNumber: v.optional(v.string()),
          }),
        ),
        reporter: v.optional(
          v.object({
            name: v.optional(v.string()),
            email: v.optional(v.string()),
          }),
        ),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const query = await (async () => {
      if (args.loanId) {
        const loanId = args.loanId;
        const loan = await ctx.db.get(loanId);
        if (!loan) {
          throw new Error("Loan not found");
        }
        await requirePermission(ctx, loan.organizationId, "loans.read");
        return ctx.db
          .query("conditionDisputes")
          .withIndex("by_loan", (q) => q.eq("loanId", loanId));
      }

      if (!args.organizationId) {
        throw new Error("Either loanId or organizationId is required");
      }

      const organizationId = args.organizationId;
      await requirePermission(ctx, organizationId, "loans.read");
      if (args.status) {
        const status = args.status;
        return ctx.db
          .query("conditionDisputes")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", organizationId).eq("status", status),
          );
      }

      return ctx.db
        .query("conditionDisputes")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        );
    })();

    const result = await query.paginate(args.paginationOpts);

    const enrichedDisputes = await Promise.all(
      result.page.map(async (dispute) => {
        const loan = await ctx.db.get(dispute.loanId);
        const collection = await ctx.db.get(dispute.collectionId);
        const reporter = await ctx.db.get(dispute.reportedBy);

        return {
          _id: dispute._id,
          _creationTime: dispute._creationTime,
          loanId: dispute.loanId,
          organizationId: dispute.organizationId,
          collectionId: dispute.collectionId,
          conditionBefore: dispute.conditionBefore,
          conditionAfter: dispute.conditionAfter,
          disputeDescription: dispute.disputeDescription,
          reportedBy: dispute.reportedBy,
          reportedAt: dispute.reportedAt,
          status: dispute.status,
          investigatorId: dispute.investigatorId,
          resolvedAt: dispute.resolvedAt,
          claimAmount: dispute.claimAmount,
          settlementAmount: dispute.settlementAmount,
          loan: loan
            ? { loanNumber: loan.loanNumber, type: loan.type }
            : undefined,
          collection: collection
            ? {
                title: collection.title,
                accessionNumber: collection.accessionNumber,
              }
            : undefined,
          reporter: reporter
            ? { name: reporter.name, email: reporter.email }
            : undefined,
        };
      }),
    );

    return {
      page: enrichedDisputes,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getConditionDispute = query({
  args: {
    disputeId: v.id("conditionDisputes"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conditionDisputes"),
      _creationTime: v.number(),
      loanId: v.id("loans"),
      organizationId: v.id("organizations"),
      collectionId: v.id("collections"),
      conditionBefore: v.string(),
      conditionBeforeNotes: v.optional(v.string()),
      conditionBeforePhotos: v.optional(v.array(v.id("_storage"))),
      conditionAfter: v.string(),
      conditionAfterNotes: v.optional(v.string()),
      conditionAfterPhotos: v.optional(v.array(v.id("_storage"))),
      disputeDescription: v.string(),
      reportedBy: v.id("users"),
      reportedAt: v.number(),
      status: conditionDisputeStatusValidator,
      investigatorId: v.optional(v.id("users")),
      investigationStartedAt: v.optional(v.number()),
      investigationNotes: v.optional(v.string()),
      investigationPhotos: v.optional(v.array(v.id("_storage"))),
      resolvedBy: v.optional(v.id("users")),
      resolvedAt: v.optional(v.number()),
      resolutionNotes: v.optional(v.string()),
      claimAmount: v.optional(v.number()),
      settlementAmount: v.optional(v.number()),
      insuranceClaimId: v.optional(v.id("insuranceClaims")),
      loan: v.optional(
        v.object({
          loanNumber: v.string(),
          type: v.union(v.literal("incoming"), v.literal("outgoing")),
          lenderBorrowerName: v.optional(v.string()),
        }),
      ),
      collection: v.optional(
        v.object({
          title: v.string(),
          accessionNumber: v.optional(v.string()),
          primaryImageUrl: v.optional(v.string()),
        }),
      ),
      reporter: v.optional(
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
      ),
      investigator: v.optional(
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
      ),
      resolver: v.optional(
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) {
      return null;
    }

    await requirePermission(ctx, dispute.organizationId, "loans.read");

    const loan = await ctx.db.get(dispute.loanId);
    const collection = await ctx.db.get(dispute.collectionId);
    const reporter = await ctx.db.get(dispute.reportedBy);
    const investigator = dispute.investigatorId
      ? await ctx.db.get(dispute.investigatorId)
      : null;
    const resolver = dispute.resolvedBy
      ? await ctx.db.get(dispute.resolvedBy)
      : null;

    // Get primary image URL for the collection item
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
      _id: dispute._id,
      _creationTime: dispute._creationTime,
      loanId: dispute.loanId,
      organizationId: dispute.organizationId,
      collectionId: dispute.collectionId,
      conditionBefore: dispute.conditionBefore,
      conditionBeforeNotes: dispute.conditionBeforeNotes,
      conditionBeforePhotos: dispute.conditionBeforePhotos,
      conditionAfter: dispute.conditionAfter,
      conditionAfterNotes: dispute.conditionAfterNotes,
      conditionAfterPhotos: dispute.conditionAfterPhotos,
      disputeDescription: dispute.disputeDescription,
      reportedBy: dispute.reportedBy,
      reportedAt: dispute.reportedAt,
      status: dispute.status,
      investigatorId: dispute.investigatorId,
      investigationStartedAt: dispute.investigationStartedAt,
      investigationNotes: dispute.investigationNotes,
      investigationPhotos: dispute.investigationPhotos,
      resolvedBy: dispute.resolvedBy,
      resolvedAt: dispute.resolvedAt,
      resolutionNotes: dispute.resolutionNotes,
      claimAmount: dispute.claimAmount,
      settlementAmount: dispute.settlementAmount,
      insuranceClaimId: dispute.insuranceClaimId,
      loan: loan
        ? {
            loanNumber: loan.loanNumber,
            type: loan.type,
            lenderBorrowerName: loan.lenderBorrowerName,
          }
        : undefined,
      collection: collection
        ? {
            title: collection.title,
            accessionNumber: collection.accessionNumber,
            primaryImageUrl,
          }
        : undefined,
      reporter: reporter
        ? { name: reporter.name, email: reporter.email }
        : undefined,
      investigator: investigator
        ? { name: investigator.name, email: investigator.email }
        : undefined,
      resolver: resolver
        ? { name: resolver.name, email: resolver.email }
        : undefined,
    };
  },
});

// ============================================
// BULK EXPORT
// ============================================

/**
 * Bulk export loans data for CSV/Excel export
 */
export const bulkExport = query({
  args: {
    loanIds: v.array(v.id("loans")),
  },
  returns: v.array(
    v.object({
      _id: v.id("loans"),
      loanNumber: v.string(),
      type: v.string(),
      status: v.string(),
      lenderBorrowerName: v.string(),
      lenderBorrowerContact: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      insuranceValue: v.optional(v.number()),
      terms: v.optional(v.string()),
      notes: v.optional(v.string()),
      itemCount: v.number(),
      itemAccessionNumbers: v.string(),
      approvedByName: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      accountName: v.optional(v.string()),
      workflowStep: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results: Array<{
      _id: Id<"loans">;
      loanNumber: string;
      type: string;
      status: string;
      lenderBorrowerName: string;
      lenderBorrowerContact?: string;
      startDate: number;
      endDate?: number;
      insuranceValue?: number;
      terms?: string;
      notes?: string;
      itemCount: number;
      itemAccessionNumbers: string;
      approvedByName?: string;
      approvedAt?: number;
      accountName?: string;
      workflowStep?: number;
    }> = [];

    for (const loanId of args.loanIds) {
      const loan = await ctx.db.get(loanId);
      if (!loan) continue;

      await requirePermission(ctx, loan.organizationId, "loans.read");

      // Get loan items
      const loanItems = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect();

      // Get accession numbers for items
      const accessionNumbers: string[] = [];
      for (const item of loanItems) {
        const collection = await ctx.db.get(item.collectionId);
        if (collection) {
          accessionNumbers.push(collection.accessionNumber);
        }
      }

      // Get approver name
      let approvedByName: string | undefined;
      if (loan.approvedBy) {
        const approver = await ctx.db.get(loan.approvedBy);
        approvedByName = approver?.name ?? approver?.username;
      }

      // Get account name
      let accountName: string | undefined;
      if (loan.accountId) {
        const account = await ctx.db.get(loan.accountId);
        if (account) {
          accountName =
            account.businessName ??
            [account.firstName, account.lastName].filter(Boolean).join(" ") ??
            undefined;
        }
      }

      results.push({
        _id: loan._id,
        loanNumber: loan.loanNumber,
        type: loan.type,
        status: loan.status,
        lenderBorrowerName: loan.lenderBorrowerName,
        lenderBorrowerContact: loan.lenderBorrowerContact,
        startDate: loan.startDate,
        endDate: loan.endDate,
        insuranceValue: loan.insuranceValue,
        terms: loan.terms,
        notes: loan.notes,
        itemCount: loanItems.length,
        itemAccessionNumbers: accessionNumbers.join(", "),
        approvedByName,
        approvedAt: loan.approvedAt,
        accountName,
        workflowStep: loan.workflowStep,
      });
    }

    return results;
  },
});

export const getStatusDistribution = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      status: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireLoansAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "loans.read");

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const statusCounts: Record<string, number> = {};
    for (const loan of loans) {
      statusCounts[loan.status] = (statusCounts[loan.status] || 0) + 1;
    }

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
  },
});
