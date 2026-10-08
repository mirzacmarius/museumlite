import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rejectPermanentEvidenceDeletion } from "./evidenceRetention";
import { requireExhibitionAccess } from "./exhibitionAccess";
import {
  type ExhibitionParticipantInput,
  getExhibitionParticipants,
  getExhibitionsForObject,
  getLegacyParticipationReview,
  validateExhibitionParticipants,
} from "./exhibitionParticipation";
import { hasFeatureAccess } from "./featureGates";
import { assertCollectionNotOnLoan } from "./loanOccupancy";
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
  args: {
    organizationId: Id<"organizations">;
    collectionId?: Id<"collections">;
  },
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

  const matchingIds = args.collectionId
    ? new Set(
        (await getExhibitionsForObject(ctx, args.collectionId)).map(
          (exhibition) => exhibition._id,
        ),
      )
    : null;
  const filteredExhibitions = matchingIds
    ? exhibitions.filter((exhibition) => matchingIds.has(exhibition._id))
    : exhibitions;
  const results = await Promise.all(
    filteredExhibitions.map(async (exhibition) => {
      const members = await getExhibitionParticipants(ctx, exhibition._id);
      const review = await getLegacyParticipationReview(ctx, exhibition);
      const firstId = members[0]?.collectionId ?? review?.anchorCollectionId;
      const collection = firstId ? await ctx.db.get(firstId) : null;
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
        collectionId: firstId,
        participantCount:
          members.length +
          (review && review.reason !== "anchor_and_members" ? 1 : 0),
        collectionTitle:
          collection?.organizationId === exhibition.organizationId
            ? collection.title
            : undefined,
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

  const [
    members,
    legacyParticipationReview,
    workflowConfig,
    approver,
    creator,
  ] = await Promise.all([
    getExhibitionParticipants(ctx, exhibition._id),
    getLegacyParticipationReview(ctx, exhibition),
    getWorkflowConfig(ctx, exhibition.organizationId, "exhibition"),
    exhibition.approvedBy
      ? ctx.db.get(exhibition.approvedBy)
      : Promise.resolve(null),
    exhibition.createdBy
      ? ctx.db.get(exhibition.createdBy)
      : Promise.resolve(null),
  ] as const);
  const firstId =
    members[0]?.collectionId ?? legacyParticipationReview?.anchorCollectionId;
  const collection = firstId ? await ctx.db.get(firstId) : null;

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
    collectionId: firstId,
    participantCount:
      members.length +
      (legacyParticipationReview &&
      legacyParticipationReview.reason !== "anchor_and_members"
        ? 1
        : 0),
    legacyParticipationReview: legacyParticipationReview ?? undefined,
    organizationId: exhibition.organizationId,
    collectionTitle:
      collection?.organizationId === exhibition.organizationId
        ? collection.title
        : undefined,
    status: exhibition.status,
    workflowStep: exhibition.workflowStep,
    totalWorkflowSteps: workflowConfig
      ? resolveWorkflowStepState(workflowConfig.steps, undefined).approvalSteps
          .length
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
    participants?: ExhibitionParticipantInput[];
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

  const { id: _id, participants, ...updates } = args;
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );

  if (participants) {
    if (exhibition.participationVersion !== "members") {
      throw new Error(
        "Review legacy exhibition participation before editing objects",
      );
    }
    await validateExhibitionParticipants(
      ctx,
      exhibition.organizationId,
      participants,
    );
    const members = await getExhibitionParticipants(ctx, exhibition._id);
    for (const participant of participants) {
      if (
        !members.some(
          (member) => member.collectionId === participant.collectionId,
        )
      ) {
        await assertCollectionNotOnLoan(
          ctx,
          participant.collectionId,
          "Cannot add an object that is currently on loan",
        );
      }
    }
    const selected = new Set(
      participants.map((participant) => participant.collectionId),
    );
    for (const member of members) {
      if (!selected.has(member.collectionId)) {
        if (
          member.status !== "pending" ||
          member.installedAt !== undefined ||
          member.deinstalledAt !== undefined ||
          member.returnedAt !== undefined
        ) {
          throw new Error(
            "Cannot remove an object with installation or return evidence",
          );
        }
        await ctx.db.delete(member._id);
      }
    }
    const membersByCollectionId = new Map(
      members.map((member) => [member.collectionId, member]),
    );
    for (const [order, participant] of participants.entries()) {
      const existing = membersByCollectionId.get(participant.collectionId);
      if (existing) {
        await ctx.db.patch(existing._id, { role: participant.role, order });
      } else {
        await ctx.db.insert("exhibitionObjects", {
          exhibitionId: exhibition._id,
          organizationId: exhibition.organizationId,
          collectionId: participant.collectionId,
          role: participant.role,
          order,
          status: "pending",
        });
      }
    }
  }

  await Promise.all([
    ctx.db.patch(args.id, filteredUpdates),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "updated",
      entityType: "exhibition",
      entityId: args.id,
      changes: { ...filteredUpdates, participants },
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

  return rejectPermanentEvidenceDeletion();
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

  const exhibitions = await getExhibitionsForObject(ctx, args.collectionId);

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
    collectionId?: Id<"collections">;
    organizationId?: Id<"organizations">;
    participants?: ExhibitionParticipantInput[];
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
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  const participants =
    args.participants ??
    (args.collectionId
      ? [{ collectionId: args.collectionId, role: "participant" as const }]
      : []);
  const firstCollection = participants[0]
    ? await ctx.db.get(participants[0].collectionId)
    : null;
  const organizationId = args.organizationId ?? firstCollection?.organizationId;
  if (!organizationId)
    throw new Error("Organization and exhibition objects are required");
  if (
    args.collectionId &&
    args.participants &&
    !participants.some((member) => member.collectionId === args.collectionId)
  ) {
    throw new Error("Legacy object must be included in participants");
  }
  await validateExhibitionParticipants(ctx, organizationId, participants);
  for (const participant of participants) {
    await assertCollectionNotOnLoan(
      ctx,
      participant.collectionId,
      "Cannot add an object that is currently on loan",
    );
  }
  await requireExhibitionAccess(ctx, organizationId);

  const canInitiate = await canInitiateWorkflow(
    ctx,
    organizationId,
    "exhibition",
  );

  if (!canInitiate) {
    await requirePermission(ctx, organizationId, "collections.update");
  }

  const workflowConfig = await getWorkflowConfig(
    ctx,
    organizationId,
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
    organizationId,
    participationVersion: "members",
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

  for (const [order, participant] of participants.entries()) {
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: participant.collectionId,
      role: participant.role,
      order,
      status: "pending",
    });
  }

  await ctx.runMutation(internal.audit.logAction, {
    organizationId,
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
      organizationId,
      "exhibition",
      workflowState.firstStep ?? 1,
    );

    await Promise.all(
      Array.from(usersToNotify).map(async (approverId) => {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId,
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
