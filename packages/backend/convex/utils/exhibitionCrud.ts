import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireExhibitionAccess } from "./exhibitionAccess";
import { hasFeatureAccess } from "./featureGates";
import {
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
  hasPermission,
  requirePermission,
} from "./permissions";
import { getWorkflowConfig } from "./workflowConfigs";
import { resolveWorkflowStepState } from "./workflowSteps";

export async function listExhibitionsByOrganizationHandler(
  ctx: QueryCtx,
  args: { organizationId: Id<"organizations"> },
) {
  await Promise.all([
    requireExhibitionAccess(ctx, args.organizationId),
    requirePermission(ctx, args.organizationId, "collections.read"),
  ]);
  const exhibitions = await ctx.db
    .query("exhibitions")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", args.organizationId),
    )
    .order("desc")
    .collect();

  const results = await Promise.all(
    exhibitions.map(async (exhibition) => {
      const collection = await ctx.db.get(exhibition.collectionId);
      return {
        _id: exhibition._id,
        _creationTime: exhibition._creationTime,
        title: exhibition.title,
        location: exhibition.location,
        startDate: exhibition.startDate,
        endDate: exhibition.endDate,
        isCurrent: exhibition.isCurrent,
        isLoan: exhibition.isLoan,
        loanVenue: exhibition.loanVenue,
        notes: exhibition.notes,
        collectionId: exhibition.collectionId,
        collectionTitle: collection?.title,
      };
    }),
  );

  return results;
}

export async function getExhibitionHandler(
  ctx: QueryCtx,
  args: { id: Id<"exhibitions"> },
) {
  const exhibition = await ctx.db.get(args.id);
  if (!exhibition) {
    return null;
  }

  await Promise.all([
    requireExhibitionAccess(ctx, exhibition.organizationId),
    requirePermission(ctx, exhibition.organizationId, "collections.read"),
  ]);

  const [collection, workflowConfig] = await Promise.all([
    ctx.db.get(exhibition.collectionId),
    getWorkflowConfig(ctx, exhibition.organizationId, "exhibition"),
  ] as const);
  const [approver, creator] = await Promise.all([
    exhibition.approvedBy
      ? ctx.db.get(exhibition.approvedBy)
      : Promise.resolve(null),
    exhibition.createdBy
      ? ctx.db.get(exhibition.createdBy)
      : Promise.resolve(null),
  ]);

  return {
    _id: exhibition._id,
    _creationTime: exhibition._creationTime,
    title: exhibition.title,
    location: exhibition.location,
    startDate: exhibition.startDate,
    endDate: exhibition.endDate,
    isCurrent: exhibition.isCurrent,
    isLoan: exhibition.isLoan,
    loanVenue: exhibition.loanVenue,
    notes: exhibition.notes,
    collectionId: exhibition.collectionId,
    organizationId: exhibition.organizationId,
    collectionTitle: collection?.title,
    status: exhibition.status,
    workflowStep: exhibition.workflowStep,
    totalWorkflowSteps: workflowConfig
      ? resolveWorkflowStepState(workflowConfig.steps, undefined)
          .approvalSteps.length
      : undefined,
    approvedBy: exhibition.approvedBy,
    approvedAt: exhibition.approvedAt,
    approverName: approver?.name ?? approver?.username ?? undefined,
    createdBy: exhibition.createdBy,
    creatorName: creator?.name ?? creator?.username ?? undefined,
  };
}

export async function updateExhibitionHandler(
  ctx: MutationCtx,
  args: {
    id: Id<"exhibitions">;
    title?: string;
    location?: string;
    startDate?: number;
    endDate?: number;
    isCurrent?: boolean;
    isLoan?: boolean;
    loanVenue?: string;
    notes?: string;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.id),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status === "closed" || exhibition.status === "rejected") {
    throw new Error("Cannot update closed or rejected exhibition");
  }

  await Promise.all([
    requireExhibitionAccess(ctx, exhibition.organizationId),
    requirePermission(ctx, exhibition.organizationId, "collections.update"),
  ]);

  const { id: _id, ...updates } = args;
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );

  if (filteredUpdates.isCurrent === true) {
    const currentExhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", exhibition.collectionId),
      )
      .filter((q) => q.eq(q.field("isCurrent"), true))
      .collect();

    await Promise.all(
      currentExhibitions.map((ex) =>
        ex._id !== args.id
          ? ctx.db.patch(ex._id, { isCurrent: false })
          : Promise.resolve(),
      ),
    );
  }

  await Promise.all([
    ctx.db.patch(args.id, filteredUpdates),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "updated",
      entityType: "exhibition",
      entityId: args.id,
      changes: filteredUpdates,
    }),
  ]);

  return null;
}

export async function removeExhibitionHandler(
  ctx: MutationCtx,
  args: { id: Id<"exhibitions"> },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.id),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status === "active") {
    throw new Error("Cannot delete active exhibition");
  }

  await Promise.all([
    requireExhibitionAccess(ctx, exhibition.organizationId),
    requirePermission(ctx, exhibition.organizationId, "collections.delete"),
  ]);

  await Promise.all([
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "deleted",
      entityType: "exhibition",
      entityId: args.id,
      changes: { title: exhibition.title },
    }),
    ctx.db.delete(args.id),
  ]);

  return null;
}

export async function listExhibitionsForCollectionHandler(
  ctx: QueryCtx,
  args: { collectionId: Id<"collections"> },
) {
  const collection = await ctx.db.get(args.collectionId);
  if (!collection) {
    return [];
  }

  const hasExhibitionsFeature = await hasFeatureAccess(
    ctx,
    collection.organizationId,
    "exhibitions",
  );
  if (!hasExhibitionsFeature) {
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

  const exhibitions = await ctx.db
    .query("exhibitions")
    .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
    .order("desc")
    .collect();

  return exhibitions.map((exhibition) => ({
    _id: exhibition._id,
    title: exhibition.title,
    location: exhibition.location,
    startDate: exhibition.startDate,
    endDate: exhibition.endDate,
    isCurrent: exhibition.isCurrent,
    isLoan: exhibition.isLoan,
    loanVenue: exhibition.loanVenue,
    notes: exhibition.notes,
  }));
}

export async function createExhibitionHandler(
  ctx: MutationCtx,
  args: {
    collectionId: Id<"collections">;
    title: string;
    location?: string;
    startDate: number;
    endDate?: number;
    isCurrent: boolean;
    isLoan?: boolean;
    loanVenue?: string;
    notes?: string;
  },
) {
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

  await requireExhibitionAccess(ctx, collection.organizationId);

  const canInitiate = await canInitiateWorkflow(
    ctx,
    collection.organizationId,
    "exhibition",
  );

  if (!canInitiate) {
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );
  }

  if (args.isCurrent) {
    const currentExhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .filter((q) => q.eq(q.field("isCurrent"), true))
      .collect();

    await Promise.all(
      currentExhibitions.map((exhibition) =>
        ctx.db.patch(exhibition._id, { isCurrent: false }),
      ),
    );
  }

  const workflowConfig = await getWorkflowConfig(
    ctx,
    collection.organizationId,
    "exhibition",
  );
  const workflowState = resolveWorkflowStepState(
    workflowConfig?.steps,
    undefined,
  );

  if (workflowConfig && workflowState.firstStep === undefined) {
    throw new Error("Workflow has no approval steps configured");
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

  const exhibitionId = await ctx.db.insert("exhibitions", {
    collectionId: args.collectionId,
    organizationId: collection.organizationId,
    title: args.title,
    location: args.location,
    startDate: args.startDate,
    endDate: args.endDate,
    isCurrent: args.isCurrent,
    isLoan: args.isLoan,
    loanVenue: args.loanVenue,
    notes: args.notes,
    status: workflowConfig ? "proposed" : "active",
    workflowStep: workflowConfig ? (workflowState.firstStep ?? 1) : undefined,
    workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
    createdBy: userId,
  });

  await ctx.runMutation(internal.audit.logAction, {
    organizationId: collection.organizationId,
    userId,
    action: "created",
    entityType: "exhibition",
    entityId: exhibitionId,
    changes: {
      title: args.title,
      status: workflowConfig ? "proposed" : "active",
    },
  });

  if (workflowConfig) {
    const usersToNotify = await getUsersToNotifyForWorkflowStep(
      ctx,
      collection.organizationId,
      "exhibition",
      workflowState.firstStep ?? 1,
    );

    await Promise.all(
      Array.from(usersToNotify).map(async (approverId) => {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: collection.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "New Exhibition Requires Approval",
            message: `Exhibition "${args.title}" is pending your approval at step ${workflowState.firstStep ?? 1}.`,
            relatedEntityType: "exhibition",
            relatedEntityId: exhibitionId,
          });
        }
      }),
    );
  }

  return exhibitionId;
}
