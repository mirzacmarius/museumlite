import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import {
  requirePermission,
  canInitiateWorkflow,
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
} from "./utils/permissions";

/**
 * Generate loan number
 * Format: L{YEAR}.{MONTH}.{SEQUENCE} e.g. L2025.01.0001
 */
async function generateLoanNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const counter = await ctx.db
    .query("loanCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();

  let nextValue: number;

  if (counter) {
    nextValue = counter.currentValue + 1;
    await ctx.db.patch(counter._id, {
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });
  } else {
    nextValue = 1;
    await ctx.db.insert("loanCounters", {
      organizationId,
      year,
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });
  }

  return `L${year}.${month}.${String(nextValue).padStart(4, "0")}`;
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

    // Check permission
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
      loanNumber = await generateLoanNumber(ctx, args.organizationId);
    }

    // Check for workflow config to set up workflow tracking
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "loan"))
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
      workflowStep: workflowConfig ? 1 : undefined,
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

        // Create loan item with per-item condition
        await ctx.db.insert("loanItems", {
          loanId,
          collectionId: item.collectionId,
          conditionOut: item.conditionOut,
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
        1,
      );

      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: args.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "New Loan Requires Approval",
            message: `Loan ${loanNumber} (${args.type}) is pending your approval at step 1.`,
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

        const permissionNames = permissions
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => p.name);

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

    // Check permission
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

      // Update collection status to loaned
      await ctx.db.patch(collectionId, {
        status: "loaned",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
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

    // Check permission
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
      await ctx.db.patch(loanItem.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
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

      allResults = loansWithCollectionInfo
        .filter((loan) => {
          return (
            loan.loanNumber?.toLowerCase().includes(searchLower) ||
            loan.lenderBorrowerName?.toLowerCase().includes(searchLower) ||
            loan.lenderBorrowerContact?.toLowerCase().includes(searchLower) ||
            loan.notes?.toLowerCase().includes(searchLower) ||
            loan.terms?.toLowerCase().includes(searchLower) ||
            loan.collectionTitle?.toLowerCase().includes(searchLower) ||
            false
          );
        })
        .map(({ collectionTitle, ...loan }) => loan); // Remove temporary field
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

    // Check permission
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

    await requirePermission(ctx, loan.organizationId, "loans.approve");

    if (loan.status !== "pending") {
      throw new Error("Loan is not pending");
    }

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", loan.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "loan"))
      .first();

    if (workflowConfig) {
      const currentStep = loan.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        loan.organizationId,
        "loan",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      const history = loan.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });

      const isLastStep = currentStep >= workflowConfig.steps.length;

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

        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: loan.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Loan Approved",
            message: `Loan ${loan.loanNumber} has been fully approved and is now active.`,
            relatedEntityType: "loan",
            relatedEntityId: args.loanId,
          });
        }
      } else {
        await ctx.db.patch(args.loanId, {
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: loan.organizationId,
          userId,
          action: "step_approved",
          entityType: "loan",
          entityId: args.loanId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          loan.organizationId,
          "loan",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: loan.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Loan Requires Your Approval",
              message: `Loan ${loan.loanNumber} is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "loan",
              relatedEntityId: args.loanId,
            });
          }
        }
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

      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", loan.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        if (userOrg.userId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: loan.organizationId,
            userId: userOrg.userId,
            type: "loan_approved",
            title: "Loan Approved",
            message: `Loan ${loan.loanNumber} has been approved and is now active.`,
            relatedEntityType: "loan",
            relatedEntityId: args.loanId,
          });
        }
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

    if (loan.status !== "pending") {
      throw new Error("Loan is not pending approval");
    }

    const currentStep = loan.workflowStep ?? 1;
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

    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: loan.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Loan Rejected",
        message: `Loan ${loan.loanNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
      });
    }

    return null;
  },
});

export const returnLoan = mutation({
  args: {
    loanId: v.id("loans"),
    conditionIn: v.optional(v.string()),
    loanItemIds: v.optional(v.array(v.id("loanItems"))), // Optional: return specific items (partial return)
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

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "active" && loan.status !== "dispatched") {
      throw new Error("Loan must be active or dispatched to return");
    }

    // Get all loan items
    const allLoanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    // Determine which items to return
    const itemsToReturn = args.loanItemIds
      ? allLoanItems.filter((item) => args.loanItemIds!.includes(item._id))
      : allLoanItems; // If no specific items, return all

    if (itemsToReturn.length === 0) {
      throw new Error("No items selected to return");
    }

    // Return each selected item
    const returnedItemIds: Id<"loanItems">[] = [];
    for (const item of itemsToReturn) {
      await ctx.db.patch(item.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });

      // Update condition in - always set it to mark item as returned
      // Use provided value, existing value, or default to "Returned"
      const conditionInValue =
        args.conditionIn || item.conditionIn || "Returned";
      await ctx.db.patch(item._id, {
        conditionIn: conditionInValue,
      });

      returnedItemIds.push(item._id);

      // Log activity for each returned item
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "item_returned",
        entityType: "loanItem",
        entityId: item._id,
        changes: {
          loanId: args.loanId,
          collectionId: item.collectionId,
          conditionIn: args.conditionIn || item.conditionIn || "Returned",
        },
      });
    }

    // After returning items, check if ALL items in the loan are now returned
    // This handles the case where a partial return results in all items being returned
    const updatedLoanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    // Check if all items now have conditionIn set (meaning all are returned)
    const allItemsNowReturned = updatedLoanItems.every(
      (item) =>
        item.conditionIn != null && String(item.conditionIn).trim().length > 0,
    );

    // Update loan status only if all items are now returned (either in this operation or after it)
    if (allItemsNowReturned) {
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
          itemsReturned: returnedItemIds.length,
          returnedItemIds: returnedItemIds,
        },
      });

      // Notify all users about full loan return
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", loan.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        if (userOrg.userId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: loan.organizationId,
            userId: userOrg.userId,
            type: "loan_returned",
            title: "Loan Returned",
            message: `Loan ${loan.loanNumber} has been returned.`,
            relatedEntityType: "loan",
            relatedEntityId: args.loanId,
          });
        }
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
          itemsReturned: itemsToReturn.length,
          totalItems: allLoanItems.length,
          returnedItemIds: returnedItemIds,
        },
      });

      // Notify about partial return
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", loan.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        if (userOrg.userId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: loan.organizationId,
            userId: userOrg.userId,
            type: "loan_partial_return",
            title: "Loan Items Returned",
            message: `${itemsToReturn.length} of ${allLoanItems.length} items from loan ${loan.loanNumber} have been returned.`,
            relatedEntityType: "loan",
            relatedEntityId: args.loanId,
          });
        }
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

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "active") {
      throw new Error("Loan must be active to dispatch");
    }

    // Update loan status
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
    const userOrgs = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", loan.organizationId),
      )
      .collect();

    for (const userOrg of userOrgs) {
      if (userOrg.userId !== userId) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: loan.organizationId,
          userId: userOrg.userId,
          type: "loan_dispatched",
          title: "Loan Dispatched",
          message: `Loan ${loan.loanNumber} has been dispatched.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
        });
      }
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

    // Check permission
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

    // Update collection statuses back to active
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    for (const item of loanItems) {
      await ctx.db.patch(item.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    }

    // Notify all users in organization about loan cancellation (except the user who cancelled it)
    const userOrgs = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", loan.organizationId),
      )
      .collect();

    for (const userOrg of userOrgs) {
      if (userOrg.userId !== userId) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: loan.organizationId,
          userId: userOrg.userId,
          type: "loan_cancelled",
          title: "Loan Cancelled",
          message: `Loan ${loan.loanNumber} has been cancelled.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
        });
      }
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

    if (loan.status !== "active") {
      throw new Error("Loan is not active");
    }

    // Check permission
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
          await ctx.db.patch(args.collectionId, {
            status: "deaccessioned",
            lastModifiedBy: userId,
            lastModifiedAt: Date.now(),
          });
        }
      }
    } else {
      // Outgoing loan being returned TO US.
      // Status should go back to "active".
      await ctx.db.patch(args.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
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

    // Check if loan uses detailed condition reports
    if (!loan.useDetailedConditionReports) {
      throw new Error("Loan does not use detailed condition reports");
    }

    // Check permission
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

    // Check permission
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

    await requirePermission(ctx, loan.organizationId, "loans.read");

    // Get photo URLs
    const photoUrls = report.photos
      ? await Promise.all(
          report.photos.map(async (photoId) => ctx.storage.getUrl(photoId)),
        )
      : undefined;

    // Get assessor name
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

/**
 * Upload loan document
 */
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

    // Check permission
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

/**
 * List loan documents
 */
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
        await ctx.db.patch(item.collectionId, {
          status: "active",
          lastModifiedBy: userId,
          lastModifiedAt: Date.now(),
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
      throw new Error("Collection not found");
    }

    await requirePermission(ctx, collection.organizationId, "loans.read");

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
