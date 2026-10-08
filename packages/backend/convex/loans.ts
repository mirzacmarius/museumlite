import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { workflowHistoryPageValidator } from "./auditLog";
import { getAuthorizedCollectionBatch } from "./utils/authorizedCollectionBatch";
import { batchGetByIds } from "./utils/batchLookup";
import { recentCaseHistory } from "./utils/caseHistory";
import {
  markCollectionActive,
  markCollectionLoaned,
} from "./utils/collectionLifecycle";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { hasFeatureAccess } from "./utils/featureGates";
import { requireLoansAccess } from "./utils/loanAccess";
import {
  deleteLoanDocumentHandler,
  listLoanDocumentsHandler,
  uploadLoanDocumentHandler,
} from "./utils/loanDocuments";
import {
  approveLoanExtensionHandler,
  listLoanExtensionRequestsHandler,
  rejectLoanExtensionHandler,
  requestLoanExtensionHandler,
} from "./utils/loanExtensions";
import {
  cancelLoanHandler,
  dispatchLoanHandler,
  returnLoanHandler,
  returnLoanItemHandler,
} from "./utils/loanLifecycle";
import { assertCollectionNotOnLoan } from "./utils/loanOccupancy";
import {
  approveLoanHandler,
  bulkApproveLoansHandler,
  bulkCancelLoansHandler,
  getLoanWorkflowHistoryHandler,
  rejectLoanHandler,
} from "./utils/loanWorkflow";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { generateNextLoanNumber } from "./utils/numberGenerator";
import { requireLinkableParty } from "./utils/parties";
import { recordPartyLink } from "./utils/partyLinks";
import {
  getUsersToNotifyForWorkflowStep,
  hasPermission,
  requirePermission,
} from "./utils/permissions";
import { claimStorageOwnership } from "./utils/uploadOwnership";
import { emitWebhookEvent } from "./utils/webhookEvents";
import { getWorkflowConfig } from "./utils/workflowConfigs";
import { resolveWorkflowStepState } from "./utils/workflowSteps";

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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireLoansAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "loans.create"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const party = args.accountId
      ? await requireLinkableParty(ctx, args.organizationId, args.accountId)
      : null;

    // Validate date ordering
    if (args.endDate !== undefined && args.endDate < args.startDate) {
      throw new Error("Loan end date cannot be before start date");
    }

    // Generate or use provided loan number
    let loanNumber: string;
    if (args.loanNumber) {
      loanNumber = args.loanNumber;
      // Enforce manual loan-number uniqueness within the org (application-level;
      // Convex has no DB-level unique constraints — see maintenance notes).
      const existingLoans = await ctx.db
        .query("loans")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
      const duplicate = existingLoans.some((l) => l.loanNumber === loanNumber);
      if (duplicate) {
        throw new Error("Loan number already in use");
      }
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
      workflowStep: workflowConfig ? (workflowState.firstStep ?? 1) : undefined,
      workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
    });
    if (party) {
      const role = args.type === "incoming" ? "lender" : "borrower";
      await recordPartyLink(ctx, {
        organizationId: args.organizationId,
        target: { type: "loan", id: loanId },
        account: party,
        role,
        allowedRoles: [role],
        effectiveFrom: args.startDate,
        effectiveTo: args.endDate,
        assertedName: args.lenderBorrowerName,
        userId,
        origin: "staff",
      });
    }

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
      // Dedup by collectionId — duplicate entries in the same request are an error
      const seenCollectionIds = new Map<
        string,
        { collectionId: Id<"collections">; conditionOut?: string }
      >();
      for (const item of itemsToAdd) {
        if (seenCollectionIds.has(item.collectionId)) {
          throw new Error(
            `Duplicate collection in loan items: ${item.collectionId}`,
          );
        }
        seenCollectionIds.set(item.collectionId, item);
      }
      const dedupedItems = Array.from(seenCollectionIds.values());

      // Verify collections belong to organization, are active, and not on another active loan
      await Promise.all(
        dedupedItems.map(async (item) => {
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

          await assertCollectionNotOnLoan(
            ctx,
            item.collectionId,
            `Collection ${item.collectionId} is already in an active loan`,
          );

          await ctx.db.insert("loanItems", {
            loanId,
            collectionId: item.collectionId,
            conditionOut: item.conditionOut,
          });

          await markCollectionLoaned(ctx, {
            collectionId: item.collectionId,
            changedBy: userId,
          });
        }),
      );
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

      await Promise.all(
        Array.from(usersToNotify).map(async (approverId) => {
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
        }),
      );
    } else {
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      await Promise.all(
        Array.from(userOrgs).map(async (userOrg) => {
          const role = await ctx.db.get(userOrg.roleId);
          if (!role) return;

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
        }),
      );
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
    const [userId, loan] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.loanId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!loan) {
      throw new Error("Loan not found");
    }

    if (loan.status !== "pending" && loan.status !== "active") {
      throw new Error("Can only add items to pending or active loans");
    }

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.update"),
    ]);

    // Dedup by collectionId — duplicate entries in the same request are an error
    const uniqueCollectionIds = Array.from(new Set(args.collectionIds));
    if (uniqueCollectionIds.length !== args.collectionIds.length) {
      throw new Error("Duplicate collection in loan items");
    }

    // Verify collections belong to organization, are active, and not on another active loan
    await Promise.all(
      uniqueCollectionIds.map(async (collectionId) => {
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

        await assertCollectionNotOnLoan(
          ctx,
          collectionId,
          `Collection ${collectionId} is already in an active loan`,
        );

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
      }),
    );

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
    const [userId, loan] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.loanId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!loan) {
      throw new Error("Loan not found");
    }

    if (loan.status !== "pending") {
      throw new Error("Can only remove items from pending loans");
    }

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.update"),
    ]);

    await Promise.all(
      Array.from(args.loanItemIds).map(async (loanItemId) => {
        const loanItem = await ctx.db.get(loanItemId);
        if (!loanItem || loanItem.loanId !== args.loanId) {
          throw new Error(`Loan item ${loanItemId} not found or invalid`);
        }

        const report = await ctx.db
          .query("conditionReports")
          .withIndex("by_loanItem", (q) => q.eq("loanItemId", loanItemId))
          .first();
        if (
          report ||
          loanItem.conditionReportId ||
          loanItem.conditionOut !== undefined ||
          loanItem.conditionIn !== undefined
        ) {
          rejectPermanentEvidenceDeletion();
        }

        // Update collection status back to active
        await markCollectionActive(ctx, {
          collectionId: loanItem.collectionId,
          changedBy: userId,
        });

        // Delete loan item
        await ctx.db.delete(loanItemId);
      }),
    );

    return null;
  },
});

/**
 * List loans with filters
 */
const BOUNDED_LOAN_SEARCH_SCAN_LIMIT = 500;

function paginateBoundedLoanResults(
  items: Doc<"loans">[],
  paginationOpts: { numItems: number; cursor: string | null },
) {
  const cursor = paginationOpts.cursor
    ? Number.parseInt(paginationOpts.cursor, 10)
    : 0;
  const startIndex = Number.isNaN(cursor) ? 0 : cursor;
  const endIndex = Math.min(startIndex + paginationOpts.numItems, items.length);

  return {
    page: items.slice(startIndex, endIndex),
    isDone: endIndex >= items.length,
    continueCursor: endIndex.toString(),
  };
}

async function enrichLoanListPage(ctx: QueryCtx, loans: Doc<"loans">[]) {
  return await Promise.all(
    loans.map(async (loan) => {
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
}

async function filterLoansBySearch(
  ctx: QueryCtx,
  loans: Doc<"loans">[],
  searchLower: string,
) {
  const loansWithCollectionInfo = await Promise.all(
    loans.map(async (loan) => {
      const items = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
        .take(1);

      let collectionTitle = "";
      if (items.length > 0 && items[0]) {
        const collection = await ctx.db.get(items[0].collectionId);
        collectionTitle = collection?.title ?? "";
      }

      return { loan, collectionTitle };
    }),
  );

  return loansWithCollectionInfo.flatMap(({ loan, collectionTitle }) =>
    loan.loanNumber.toLowerCase().includes(searchLower) ||
    loan.lenderBorrowerName.toLowerCase().includes(searchLower) ||
    loan.lenderBorrowerContact?.toLowerCase().includes(searchLower) ||
    loan.notes?.toLowerCase().includes(searchLower) ||
    loan.terms?.toLowerCase().includes(searchLower) ||
    collectionTitle.toLowerCase().includes(searchLower)
      ? [loan]
      : [],
  );
}

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
    await Promise.all([
      requireLoansAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "loans.read"),
    ]);

    const search = args.search?.trim();

    if (search && search.length > 0) {
      const searchLower = search.toLowerCase();
      let candidateLoans = await ctx.db
        .query("loans")
        .withSearchIndex("search_loans", (q) => {
          let filter = q
            .search("lenderBorrowerName", search)
            .eq("organizationId", args.organizationId);

          if (args.status) {
            filter = filter.eq("status", args.status);
          }
          if (args.type) {
            filter = filter.eq("type", args.type);
          }

          return filter;
        })
        .take(BOUNDED_LOAN_SEARCH_SCAN_LIMIT);

      if (candidateLoans.length < BOUNDED_LOAN_SEARCH_SCAN_LIMIT) {
        let indexedQuery = ctx.db
          .query("loans")
          .withIndex("by_organization_and_startDate", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .order("desc");

        if (args.status) {
          indexedQuery = indexedQuery.filter((q) =>
            q.eq(q.field("status"), args.status),
          );
        }
        if (args.type) {
          indexedQuery = indexedQuery.filter((q) =>
            q.eq(q.field("type"), args.type),
          );
        }

        const recentLoans = await indexedQuery.take(
          BOUNDED_LOAN_SEARCH_SCAN_LIMIT,
        );
        const seenIds = new Set(candidateLoans.map((loan) => loan._id));
        candidateLoans = [
          ...candidateLoans,
          ...recentLoans.filter((loan) => !seenIds.has(loan._id)),
        ];
      }

      const filteredLoans = await filterLoansBySearch(
        ctx,
        candidateLoans,
        searchLower,
      );
      filteredLoans.sort((a, b) => b.startDate - a.startDate);

      const paginated = paginateBoundedLoanResults(
        filteredLoans,
        args.paginationOpts,
      );

      return {
        page: await enrichLoanListPage(ctx, paginated.page),
        isDone: paginated.isDone,
        continueCursor: paginated.continueCursor,
      };
    }

    const paginationResult =
      args.status && args.type
        ? await ctx.db
            .query("loans")
            .withIndex("by_organization_and_status", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("status", args.status!),
            )
            .filter((q) => q.eq(q.field("type"), args.type))
            .order("desc")
            .paginate(args.paginationOpts)
        : args.status
          ? await ctx.db
              .query("loans")
              .withIndex("by_organization_and_status", (q) =>
                q
                  .eq("organizationId", args.organizationId)
                  .eq("status", args.status!),
              )
              .order("desc")
              .paginate(args.paginationOpts)
          : args.type
            ? await ctx.db
                .query("loans")
                .withIndex("by_organization_and_type", (q) =>
                  q
                    .eq("organizationId", args.organizationId)
                    .eq("type", args.type!),
                )
                .order("desc")
                .paginate(args.paginationOpts)
            : await ctx.db
                .query("loans")
                .withIndex("by_organization_and_startDate", (q) =>
                  q.eq("organizationId", args.organizationId),
                )
                .order("desc")
                .paginate(args.paginationOpts);

    return {
      page: await enrichLoanListPage(ctx, paginationResult.page),
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.continueCursor,
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
      workflowHistoryIsPreview: v.literal(true),
      workflowHistoryHasMore: v.boolean(),
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
          custodyStatus: v.optional(
            v.union(
              v.literal("pending"),
              v.literal("dispatched"),
              v.literal("returned"),
            ),
          ),
          dispatchOriginLocationId: v.optional(v.id("locations")),
          dispatchOriginUnknown: v.optional(v.boolean()),
          returnDestinationLocationId: v.optional(v.id("locations")),
          outgoingConditionAssessmentId: v.optional(
            v.id("conditionAssessments"),
          ),
          incomingConditionAssessmentId: v.optional(
            v.id("conditionAssessments"),
          ),
          lenderExitId: v.optional(v.id("loanCustodyExits")),
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

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.read"),
    ]);

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
      | undefined;

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
          custodyStatus: item.custodyStatus,
          dispatchOriginLocationId: item.dispatchOriginLocationId,
          dispatchOriginUnknown: item.dispatchOriginUnknown,
          returnDestinationLocationId: item.returnDestinationLocationId,
          outgoingConditionAssessmentId: item.outgoingConditionAssessmentId,
          incomingConditionAssessmentId: item.incomingConditionAssessmentId,
          lenderExitId: item.lenderExitId,
        };
      }),
    );

    const historyPreview = await recentCaseHistory(ctx, loan, "loan");
    const rawHistory = historyPreview.entries;
    const workflowHistoryWithNames = await Promise.all(
      rawHistory.map(async (entry) => {
        return {
          step: entry.step,
          approvedBy: entry.approvedBy,
          approvedByName: entry.approverName,
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
      workflowHistoryIsPreview: true as const,
      workflowHistoryHasMore: historyPreview.hasMore,
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
    const [userId, loan] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.loanId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!loan) {
      throw new Error("Loan not found");
    }

    if (loan.status !== "pending") {
      throw new Error("Can only update pending loans");
    }

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.update"),
    ]);

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

    // Validate date ordering using effective (post-update) values
    const effectiveStartDate = updates.startDate ?? loan.startDate;
    const effectiveEndDate =
      "endDate" in updates ? updates.endDate : loan.endDate;
    if (
      effectiveEndDate !== undefined &&
      effectiveEndDate < effectiveStartDate
    ) {
      throw new Error("Loan end date cannot be before start date");
    }

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
    const loanBefore = await ctx.db.get(args.loanId);
    await approveLoanHandler(ctx, args);
    if (loanBefore) {
      const loanAfter = await ctx.db.get(args.loanId);
      if (
        loanAfter &&
        loanAfter.status === "active" &&
        loanBefore.status !== "active"
      ) {
        await emitWebhookEvent(ctx, loanAfter.organizationId, "loan.approved", {
          loanId: args.loanId,
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
  handler: async (ctx, args) => rejectLoanHandler(ctx, args),
});

const receiveLoanItemArgsValidator = v.object({
  loanItemId: v.id("loanItems"),
  destinationLocationId: v.optional(v.id("locations")),
  confirmReturnToOrigin: v.optional(v.boolean()),
  incomingConditionAssessmentId: v.optional(v.id("conditionAssessments")),
  conditionIn: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const returnLoan = mutation({
  args: {
    loanId: v.id("loans"),
    conditionIn: v.optional(v.string()),
    loanItemIds: v.optional(v.array(v.id("loanItems"))),
    receipts: v.optional(v.array(receiveLoanItemArgsValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => returnLoanHandler(ctx, args),
});

export const dispatch = mutation({
  args: {
    loanId: v.id("loans"),
    loanItemIds: v.optional(v.array(v.id("loanItems"))),
    itemAssessments: v.optional(
      v.array(
        v.object({
          loanItemId: v.id("loanItems"),
          outgoingConditionAssessmentId: v.id("conditionAssessments"),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const itemAssessments = args.itemAssessments
      ? Object.fromEntries(
          args.itemAssessments.map((entry) => [
            entry.loanItemId,
            entry.outgoingConditionAssessmentId,
          ]),
        )
      : undefined;
    await dispatchLoanHandler(ctx, {
      loanId: args.loanId,
      loanItemIds: args.loanItemIds,
      itemAssessments,
    });
    return null;
  },
});

export const cancel = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => cancelLoanHandler(ctx, args),
});

export const returnItem = mutation({
  args: {
    loanId: v.id("loans"),
    collectionId: v.id("collections"),
    conditionIn: v.optional(v.string()),
    notes: v.optional(v.string()),
    destinationLocationId: v.optional(v.id("locations")),
    confirmReturnToOrigin: v.optional(v.boolean()),
    incomingConditionAssessmentId: v.optional(v.id("conditionAssessments")),
  },
  returns: v.null(),
  handler: async (ctx, args) => returnLoanItemHandler(ctx, args),
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
    const [userId, loanItem] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.loanItemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!loanItem) {
      throw new Error("Loan item not found");
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    const collection = await ctx.db.get(loanItem.collectionId);
    if (!collection || collection.organizationId !== loan.organizationId)
      throw new Error("Loan object not found in this organization");
    if (!loan.useDetailedConditionReports) {
      throw new Error("Loan does not use detailed condition reports");
    }

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.update"),
    ]);

    const reportId = await ctx.db.insert("conditionReports", {
      loanItemId: args.loanItemId,
      reportType: args.reportType,
      conditionDescription: args.conditionDescription,
      damages: args.damages,
      photos: args.photos,
      assessedBy: userId,
      assessedAt: Date.now(),
    });

    for (const storageId of args.photos ?? [])
      await claimStorageOwnership(ctx, {
        storageId,
        organizationId: loan.organizationId,
        uploadedBy: userId,
        ownerType: "conditionReport",
        ownerId: reportId,
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
    const [userId, report] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.reportId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.update"),
    ]);

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

    await Promise.all([
      requireLoansAccess(ctx, loan.organizationId),
      requirePermission(ctx, loan.organizationId, "loans.read"),
    ]);

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
  handler: async (ctx, args) => uploadLoanDocumentHandler(ctx, args),
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
  handler: async (ctx, args) => listLoanDocumentsHandler(ctx, args),
});

export const deleteLoanDocument = mutation({
  args: {
    documentId: v.id("loanDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => deleteLoanDocumentHandler(ctx, args),
});

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

    await requirePermission(ctx, args.organizationId, "loans.update");
    return rejectPermanentEvidenceDeletion();
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

    const collectionMap = await getAuthorizedCollectionBatch(
      ctx,
      args.collectionIds,
      "loans.read",
    );

    const results: Array<{
      collectionId: Id<"collections">;
      loanId: Id<"loans">;
      loanNumber: string;
      status: "pending" | "active" | "dispatched" | "returned" | "cancelled";
    }> = [];

    const perCollectionResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        const collection = collectionMap.get(collectionId);
        if (!collection) return null;
        const loanItems = await ctx.db
          .query("loanItems")
          .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
          .collect();

        const loans = await batchGetByIds(
          ctx,
          loanItems.map((loanItem) => loanItem.loanId),
          "loans",
        );

        for (let i = 0; i < loanItems.length; i++) {
          const loan = loans[i];
          if (loan && loan.organizationId !== collection.organizationId) {
            throw new Error("Loan organization does not match collection");
          }
          if (
            loan &&
            (loan.status === "pending" ||
              loan.status === "active" ||
              loan.status === "dispatched")
          ) {
            return {
              collectionId,
              loanId: loan._id,
              loanNumber: loan.loanNumber,
              status: loan.status,
            };
          }
        }
        return null;
      }),
    );

    for (const entry of perCollectionResults) {
      if (entry) {
        results.push(entry);
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
        if (loan.organizationId !== collection.organizationId) return null;
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
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: workflowHistoryPageValidator,
  handler: async (ctx, args) => getLoanWorkflowHistoryHandler(ctx, args),
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
  handler: async (ctx, args) => bulkApproveLoansHandler(ctx, args),
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
  handler: async (ctx, args) => bulkCancelLoansHandler(ctx, args),
});

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
  handler: async (ctx, args) => requestLoanExtensionHandler(ctx, args),
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
  handler: async (ctx, args) => approveLoanExtensionHandler(ctx, args),
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
  handler: async (ctx, args) => rejectLoanExtensionHandler(ctx, args),
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
  handler: async (ctx, args) => listLoanExtensionRequestsHandler(ctx, args),
});

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

    const reminderOutcomes = await Promise.all(
      activeLoans.map(async (loan) => {
        if (!loan.endDate) {
          return { checked: false, created: false };
        }

        const daysUntilDue = Math.floor((loan.endDate - now) / oneDay);

        const existingReminders = await Promise.all(
          thresholds.map((threshold) =>
            ctx.db
              .query("loanReminders")
              .withIndex("by_loan_and_type", (q) =>
                q.eq("loanId", loan._id).eq("reminderType", threshold.type),
              )
              .first(),
          ),
        );

        let matchedThreshold: (typeof thresholds)[number] | null = null;
        for (let i = 0; i < thresholds.length; i++) {
          const threshold = thresholds[i];
          if (!threshold) continue;

          const shouldSend =
            threshold.type === "overdue"
              ? daysUntilDue < 0
              : daysUntilDue <= threshold.days &&
                daysUntilDue > (thresholds[i + 1]?.days ?? -1);

          if (!shouldSend || existingReminders[i]) continue;

          matchedThreshold = threshold;
          break;
        }

        if (!matchedThreshold) {
          return { checked: true, created: false };
        }

        await ctx.db.insert("loanReminders", {
          loanId: loan._id,
          organizationId: loan.organizationId,
          reminderType: matchedThreshold.type,
          sentAt: now,
          dueDate: loan.endDate,
        });

        const orgMembers = await ctx.db
          .query("userOrganizations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", loan.organizationId),
          )
          .collect();

        const notificationTitle =
          matchedThreshold.type === "overdue"
            ? "Loan Overdue"
            : `Loan Due in ${matchedThreshold.days} ${matchedThreshold.days === 1 ? "Day" : "Days"}`;

        const notificationMessage =
          matchedThreshold.type === "overdue"
            ? `Loan ${loan.loanNumber} is overdue for return`
            : `Loan ${loan.loanNumber} is due in ${matchedThreshold.days} ${matchedThreshold.days === 1 ? "day" : "days"}`;

        await Promise.all(
          orgMembers.map((member) =>
            ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: loan.organizationId,
              userId: member.userId,
              type:
                matchedThreshold.type === "overdue"
                  ? "loan_overdue"
                  : "loan_return_due_soon",
              title: notificationTitle,
              message: notificationMessage,
              relatedEntityType: "loan",
              relatedEntityId: loan._id,
            }),
          ),
        );

        return { checked: true, created: true };
      }),
    );

    for (const outcome of reminderOutcomes) {
      if (outcome.checked) {
        loansChecked++;
      }
      if (outcome.created) {
        remindersCreated++;
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
    const [userId, loan] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.loanId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!loan) {
      throw new Error("Loan not found");
    }

    const [, loanItem] = await Promise.all([
      requirePermission(ctx, loan.organizationId, "loans.update"),
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
        .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
        .first(),
    ] as const);

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

    const [, orgMembers] = await Promise.all([
      ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "created",
        entityType: "conditionDispute",
        entityId: disputeId,
        changes: { loanId: args.loanId, collectionId: args.collectionId },
      }),
      ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", loan.organizationId),
        )
        .collect(),
    ] as const);

    await Promise.all(
      Array.from(orgMembers).map(async (member) => {
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
      }),
    );

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
    const [userId, dispute] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.disputeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    if (dispute.status !== "reported") {
      throw new Error("Dispute is not in reported status");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");
    await Promise.all([
      ctx.db.patch(args.disputeId, {
        status: "investigating",
        investigatorId: userId,
        investigationStartedAt: Date.now(),
        investigationNotes: args.investigationNotes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: dispute.organizationId,
        userId,
        action: "updated",
        entityType: "conditionDispute",
        entityId: args.disputeId,
        changes: { status: "investigating" },
      }),
    ]);

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
    const [userId, dispute] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.disputeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    if (dispute.status !== "investigating") {
      throw new Error("Dispute is not under investigation");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

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
    const [userId, dispute] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.disputeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    if (dispute.status !== "reported" && dispute.status !== "investigating") {
      throw new Error("Dispute cannot be resolved in current status");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

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

    await Promise.all([
      ctx.db.patch(args.disputeId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: dispute.organizationId,
        userId,
        action: "resolved",
        entityType: "conditionDispute",
        entityId: args.disputeId,
        changes: {
          status: args.resolution,
          resolutionNotes: args.resolutionNotes,
        },
      }),
    ]);

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
    const [userId, dispute] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.disputeId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    if (
      dispute.status === "resolved_in_favor_lender" ||
      dispute.status === "resolved_in_favor_borrower" ||
      dispute.status === "resolved_compromise" ||
      dispute.status === "withdrawn"
    ) {
      throw new Error("Dispute is already resolved or withdrawn");
    }

    // Only the reporter or admins can withdraw
    if (dispute.reportedBy !== userId) {
      await requirePermission(ctx, dispute.organizationId, "loans.approve");
    }

    await requirePermission(ctx, dispute.organizationId, "loans.update");

    await Promise.all([
      ctx.db.patch(args.disputeId, {
        status: "withdrawn",
        resolvedBy: userId,
        resolvedAt: Date.now(),
        resolutionNotes: args.reason ?? "Dispute withdrawn",
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: dispute.organizationId,
        userId,
        action: "withdrawn",
        entityType: "conditionDispute",
        entityId: args.disputeId,
        changes: { reason: args.reason },
      }),
    ]);

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (!args.loanId && !args.organizationId) {
      throw new Error("Either loanId or organizationId is required");
    }

    const disputesQuery = await (async () => {
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

      const organizationId = args.organizationId;
      if (!organizationId) {
        throw new Error("Either loanId or organizationId is required");
      }
      await requirePermission(ctx, organizationId, "loans.read");
      const status = args.status;
      return status
        ? ctx.db
            .query("conditionDisputes")
            .withIndex("by_organization_and_status", (q) =>
              q.eq("organizationId", organizationId).eq("status", status),
            )
        : ctx.db
            .query("conditionDisputes")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            );
    })();

    const result = await disputesQuery.paginate(args.paginationOpts);

    const enrichedDisputes = await Promise.all(
      result.page.map(async (dispute) => {
        const [loan, collection, reporter] = await Promise.all([
          ctx.db.get(dispute.loanId),
          ctx.db.get(dispute.collectionId),
          ctx.db.get(dispute.reportedBy),
        ] as const);
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

    const [loan, collection, reporter] = await Promise.all([
      ctx.db.get(dispute.loanId),
      ctx.db.get(dispute.collectionId),
      ctx.db.get(dispute.reportedBy),
    ] as const);
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

    await Promise.all(
      Array.from(args.loanIds).map(async (loanId) => {
        const loan = await ctx.db.get(loanId);
        if (!loan) return;

        const [, loanItems] = await Promise.all([
          requirePermission(ctx, loan.organizationId, "loans.read"),
          ctx.db
            .query("loanItems")
            .withIndex("by_loan", (q) => q.eq("loanId", loanId))
            .collect(),
        ] as const);

        const collections = await batchGetByIds(
          ctx,
          loanItems.map((item) => item.collectionId),
          "collections",
        );
        const accessionNumbers = collections.flatMap((collection) =>
          collection === null ? [] : [collection.accessionNumber],
        );

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
      }),
    );

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
    await Promise.all([
      requireLoansAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "loans.read"),
    ]);
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
