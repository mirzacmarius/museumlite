import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { workflowHistoryPageValidator } from "./auditLog";
import { requireExhibitionAccess } from "./utils/exhibitionAccess";
import { loadExhibitionMutationContext } from "./utils/exhibitionContext";
import {
  createExhibitionHandler,
  getExhibitionHandler,
  listExhibitionsByOrganizationHandler,
  listExhibitionsForCollectionHandler,
  removeExhibitionHandler,
  updateExhibitionHandler,
} from "./utils/exhibitionCrud";
import {
  deleteExhibitionDocumentHandler,
  listExhibitionDocumentsHandler,
  uploadExhibitionDocumentHandler,
} from "./utils/exhibitionDocuments";
import {
  checkDeinstallationReadinessHandler,
  checkInstallationReadinessHandler,
  completeDeinstallationTaskHandler,
  completeInstallationHandler,
  completeInstallationTaskHandler,
  setDeinstallationChecklistHandler,
  setInstallationChecklistHandler,
  startDeinstallationHandler,
  startInstallationHandler,
  uncompleteInstallationTaskHandler,
} from "./utils/exhibitionInstallation";
import {
  addExhibitionObjectHandler,
  authorizeReturnExceptionHandler,
  bulkInstallObjectsHandler,
  bulkReturnObjectsHandler,
  deinstallObjectHandler,
  installObjectHandler,
  listExhibitionObjectsHandler,
  removeExhibitionObjectHandler,
  returnObjectToOriginalLocationHandler,
} from "./utils/exhibitionObjectLocation";
import {
  getExhibitionParticipants,
  getLegacyParticipationReview,
} from "./utils/exhibitionParticipation";
import { getExhibitionPhysicalHandoffSummary } from "./utils/exhibitionPhysicalHandoff";
import {
  activateExhibitionHandler,
  approveExhibitionHandler,
  checkScheduleConflictsForParticipantsHandler,
  checkScheduleConflictsHandler,
  closeExhibitionHandler,
  getWorkflowHistoryHandler,
  rejectExhibitionHandler,
} from "./utils/exhibitionWorkflow";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";
import { createAuthorizedUploadUrl } from "./utils/uploadOwnership";

const observedLocationValidator = v.union(v.id("locations"), v.null());

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    metricFilters: v.optional(
      v.object({
        asOf: v.number(),
        schedule: v.optional(
          v.union(
            v.literal("current"),
            v.literal("upcoming"),
            v.literal("past"),
          ),
        ),
        lifecycle: v.optional(
          v.union(
            v.literal("proposed"),
            v.literal("approved"),
            v.literal("installing"),
            v.literal("active"),
            v.literal("deinstalling"),
            v.literal("closed"),
            v.literal("rejected"),
            v.literal("unclassified"),
          ),
        ),
        includeLoans: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      _creationTime: v.number(),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      status: v.optional(
        v.union(
          v.literal("proposed"),
          v.literal("approved"),
          v.literal("installing"),
          v.literal("active"),
          v.literal("deinstalling"),
          v.literal("closed"),
          v.literal("rejected"),
        ),
      ),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.optional(v.id("collections")),
      collectionTitle: v.optional(v.string()),
      participantCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => listExhibitionsByOrganizationHandler(ctx, args),
});

export const get = query({
  args: {
    id: v.id("exhibitions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("exhibitions"),
      _creationTime: v.number(),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.optional(v.id("collections")),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
      participantCount: v.number(),
      legacyParticipationReview: v.optional(
        v.object({
          anchorCollectionId: v.id("collections"),
          reason: v.union(
            v.literal("anchor_only"),
            v.literal("anchor_and_members"),
            v.literal("anchor_missing_from_members"),
          ),
          memberCount: v.number(),
        }),
      ),
      status: v.optional(
        v.union(
          v.literal("proposed"),
          v.literal("approved"),
          v.literal("active"),
          v.literal("closed"),
          v.literal("rejected"),
          v.literal("installing"),
          v.literal("deinstalling"),
        ),
      ),
      workflowStep: v.optional(v.number()),
      totalWorkflowSteps: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      approverName: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
      creatorName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => getExhibitionHandler(ctx, args),
});

export const update = mutation({
  args: {
    id: v.id("exhibitions"),
    title: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isCurrent: v.optional(v.boolean()),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
    participants: v.optional(
      v.array(
        v.object({
          collectionId: v.id("collections"),
          role: v.union(v.literal("featured"), v.literal("participant")),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => updateExhibitionHandler(ctx, args),
});

export const remove = mutation({
  args: {
    id: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => removeExhibitionHandler(ctx, args),
});

export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => listExhibitionsForCollectionHandler(ctx, args),
});

export const create = mutation({
  args: {
    collectionId: v.optional(v.id("collections")),
    organizationId: v.optional(v.id("organizations")),
    participants: v.optional(
      v.array(
        v.object({
          collectionId: v.id("collections"),
          role: v.union(v.literal("featured"), v.literal("participant")),
        }),
      ),
    ),
    title: v.string(),
    location: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isCurrent: v.boolean(),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("exhibitions"),
  handler: async (ctx, args) => createExhibitionHandler(ctx, args),
});

export const reviewLegacyParticipation = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      exhibitionId: v.id("exhibitions"),
      anchorCollectionId: v.id("collections"),
      reason: v.union(
        v.literal("anchor_only"),
        v.literal("anchor_and_members"),
        v.literal("anchor_missing_from_members"),
      ),
      memberCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireExhibitionAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const reviews = await Promise.all(
      exhibitions.map(async (exhibition) => {
        const review = await getLegacyParticipationReview(ctx, exhibition);
        return review ? { exhibitionId: exhibition._id, ...review } : null;
      }),
    );
    return reviews.filter(
      (review): review is NonNullable<typeof review> => review !== null,
    );
  },
});

export const reconcileLegacyParticipation = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    includeAnchor: v.boolean(),
    expectedMemberCollectionIds: v.array(v.id("collections")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) throw new Error("Exhibition not found");
    await Promise.all([
      requireExhibitionAccess(ctx, exhibition.organizationId),
      requirePermission(ctx, exhibition.organizationId, "collections.update"),
    ]);
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const review = await getLegacyParticipationReview(ctx, exhibition);
    if (!review)
      throw new Error("Exhibition participation has already been reconciled");
    const members = await getExhibitionParticipants(ctx, exhibition._id);
    if (
      members.length !== args.expectedMemberCollectionIds.length ||
      members.some(
        (member, index) =>
          member.collectionId !== args.expectedMemberCollectionIds[index],
      )
    ) {
      throw new Error("Exhibition membership changed; review it again");
    }
    if (!args.includeAnchor && members.length === 0) {
      throw new Error("Exhibition must have at least one participant");
    }
    const anchor = await ctx.db.get(review.anchorCollectionId);
    if (!anchor || anchor.organizationId !== exhibition.organizationId) {
      throw new Error(
        "Historical anchor is missing or outside the organization",
      );
    }
    for (const [order, member] of members.entries()) {
      await ctx.db.patch(member._id, {
        role: member.role ?? "participant",
        order,
      });
    }
    if (
      args.includeAnchor &&
      !members.some(
        (member) => member.collectionId === review.anchorCollectionId,
      )
    ) {
      await ctx.db.insert("exhibitionObjects", {
        exhibitionId: exhibition._id,
        organizationId: exhibition.organizationId,
        collectionId: review.anchorCollectionId,
        role: "participant",
        order: members.length,
        status: "pending",
      });
    }
    await ctx.db.patch(exhibition._id, { participationVersion: "members" });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "reconciled_exhibition_participation",
      entityType: "exhibition",
      entityId: exhibition._id,
      changes: {
        historicalAnchorCollectionId: review.anchorCollectionId,
        includedAnchor: args.includeAnchor,
        memberCount: members.length,
      },
    });
    return null;
  },
});

export const backfillUnambiguousParticipation = mutation({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    migrated: v.number(),
    requiresReview: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireExhibitionAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.update"),
    ]);
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const limit = args.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new Error("Limit must be between 1 and 50");
    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    let migrated = 0;
    let requiresReview = 0;
    let remaining = 0;
    for (const exhibition of exhibitions) {
      const review = await getLegacyParticipationReview(ctx, exhibition);
      if (!review) continue;
      if (review.reason === "anchor_missing_from_members") {
        requiresReview++;
        continue;
      }
      if (migrated >= limit) {
        remaining++;
        continue;
      }
      const anchor = await ctx.db.get(review.anchorCollectionId);
      if (!anchor || anchor.organizationId !== args.organizationId) {
        requiresReview++;
        continue;
      }
      const members = await getExhibitionParticipants(ctx, exhibition._id);
      if (members.length === 0) {
        await ctx.db.insert("exhibitionObjects", {
          exhibitionId: exhibition._id,
          organizationId: args.organizationId,
          collectionId: review.anchorCollectionId,
          role: "participant",
          order: 0,
          status: "pending",
        });
      } else {
        for (const [order, member] of members.entries()) {
          await ctx.db.patch(member._id, {
            role: member.role ?? "participant",
            order,
          });
        }
      }
      await ctx.db.patch(exhibition._id, { participationVersion: "members" });
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "backfilled_exhibition_participation",
        entityType: "exhibition",
        entityId: exhibition._id,
        changes: {
          historicalAnchorCollectionId: review.anchorCollectionId,
          memberCount: Math.max(1, members.length),
        },
      });
      migrated++;
    }
    return { migrated, requiresReview, remaining };
  },
});

export const approve = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => approveExhibitionHandler(ctx, args),
});

export const reject = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => rejectExhibitionHandler(ctx, args),
});

export const activate = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    skipInstallationCheck: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => activateExhibitionHandler(ctx, args),
});

export const close = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    skipDeinstallationCheck: v.optional(v.boolean()),
    returnObjectsToOriginalLocations: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => closeExhibitionHandler(ctx, args),
});

export const checkScheduleConflicts = query({
  args: {
    collectionId: v.id("collections"),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    excludeExhibitionId: v.optional(v.id("exhibitions")),
  },
  returns: v.object({
    hasConflicts: v.boolean(),
    conflicts: v.array(
      v.object({
        type: v.union(v.literal("exhibition"), v.literal("loan")),
        id: v.string(),
        title: v.string(),
        startDate: v.number(),
        endDate: v.optional(v.number()),
        status: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => checkScheduleConflictsHandler(ctx, args),
});

const scheduleConflictsReturnValidator = v.object({
  hasConflicts: v.boolean(),
  conflicts: v.array(
    v.object({
      type: v.union(v.literal("exhibition"), v.literal("loan")),
      id: v.string(),
      title: v.string(),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      status: v.string(),
    }),
  ),
});

export const checkScheduleConflictsForParticipants = query({
  args: {
    collectionIds: v.array(v.id("collections")),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    excludeExhibitionId: v.optional(v.id("exhibitions")),
  },
  returns: scheduleConflictsReturnValidator,
  handler: async (ctx, args) =>
    checkScheduleConflictsForParticipantsHandler(ctx, args),
});

export const getWorkflowHistory = query({
  args: {
    exhibitionId: v.id("exhibitions"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: workflowHistoryPageValidator,
  handler: async (ctx, args) => getWorkflowHistoryHandler(ctx, args),
});

export const listDocuments = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitionDocuments"),
      storageId: v.id("_storage"),
      documentType: v.union(
        v.literal("floor_plan"),
        v.literal("label"),
        v.literal("press_release"),
        v.literal("checklist"),
        v.literal("other"),
      ),
      fileName: v.string(),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
      uploaderName: v.optional(v.string()),
      url: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => listExhibitionDocumentsHandler(ctx, args),
});

export const uploadDocument = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    storageId: v.id("_storage"),
    documentType: v.union(
      v.literal("floor_plan"),
      v.literal("label"),
      v.literal("press_release"),
      v.literal("checklist"),
      v.literal("other"),
    ),
    fileName: v.string(),
  },
  returns: v.id("exhibitionDocuments"),
  handler: async (ctx, args) => uploadExhibitionDocumentHandler(ctx, args),
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("exhibitionDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => deleteExhibitionDocumentHandler(ctx, args),
});

export const generateUploadUrl = mutation({
  args: { exhibitionId: v.id("exhibitions") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { userId, exhibition } = await loadExhibitionMutationContext(
      ctx,
      args.exhibitionId,
    );
    return await createAuthorizedUploadUrl(
      ctx,
      userId,
      exhibition.organizationId,
    );
  },
});

// ============================================================================
// Installation Phase Management
// ============================================================================

export const setInstallationChecklist = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => setInstallationChecklistHandler(ctx, args),
});

export const startInstallation = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => startInstallationHandler(ctx, args),
});

export const completeInstallationTask = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    taskId: v.string(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => completeInstallationTaskHandler(ctx, args),
});

export const uncompleteInstallationTask = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    taskId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => uncompleteInstallationTaskHandler(ctx, args),
});

export const checkInstallationReadiness = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    isReady: v.boolean(),
    totalTasks: v.number(),
    completedTasks: v.number(),
    requiredTasksRemaining: v.number(),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
        completed: v.boolean(),
        completedBy: v.optional(v.id("users")),
        completedAt: v.optional(v.number()),
        completedByName: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => checkInstallationReadinessHandler(ctx, args),
});

export const completeInstallation = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => completeInstallationHandler(ctx, args),
});

export const setDeinstallationChecklist = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => setDeinstallationChecklistHandler(ctx, args),
});

export const startDeinstallation = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => startDeinstallationHandler(ctx, args),
});

export const completeDeinstallationTask = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    taskId: v.string(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => completeDeinstallationTaskHandler(ctx, args),
});

export const checkDeinstallationReadiness = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    isReady: v.boolean(),
    totalTasks: v.number(),
    completedTasks: v.number(),
    requiredTasksRemaining: v.number(),
    objectsNotReturned: v.number(),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
        completed: v.boolean(),
        completedBy: v.optional(v.id("users")),
        completedAt: v.optional(v.number()),
        completedByName: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => checkDeinstallationReadinessHandler(ctx, args),
});

// ============================================================================
// Exhibition Object Location Tracking
// ============================================================================

/**
 * Add an object to an exhibition
 */
export const addExhibitionObject = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    collectionId: v.id("collections"),
    originalLocationId: v.optional(v.id("locations")),
    exhibitionLocationId: v.optional(v.id("locations")),
    role: v.optional(v.union(v.literal("featured"), v.literal("participant"))),
  },
  returns: v.id("exhibitionObjects"),
  handler: async (ctx, args) => addExhibitionObjectHandler(ctx, args),
});

/**
 * Remove an object from an exhibition (before installation)
 */
export const removeExhibitionObject = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => removeExhibitionObjectHandler(ctx, args),
});

/**
 * Install an object in the exhibition (mark as placed and update location)
 */
export const installObject = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    observedFromLocationId: observedLocationValidator,
    conditionNotes: v.optional(v.string()),
    exhibitionLocationId: v.optional(v.id("locations")),
    installationConditionAssessmentId: v.optional(v.id("conditionAssessments")),
  },
  returns: v.null(),
  handler: async (ctx, args) => installObjectHandler(ctx, args),
});

/**
 * Deinstall an object from the exhibition
 */
export const deinstallObject = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    conditionNotes: v.optional(v.string()),
    deinstallationConditionAssessmentId: v.optional(
      v.id("conditionAssessments"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => deinstallObjectHandler(ctx, args),
});

/**
 * Return an object to its original location after exhibition
 */
export const returnObjectToOriginalLocation = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    observedFromLocationId: observedLocationValidator,
    overrideLocationId: v.optional(v.id("locations")),
    returnConditionAssessmentId: v.optional(v.id("conditionAssessments")),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    returnObjectToOriginalLocationHandler(ctx, args),
});

export const authorizeReturnException = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => authorizeReturnExceptionHandler(ctx, args),
});

export const getPhysicalHandoffSummary = query({
  args: { exhibitionId: v.id("exhibitions") },
  returns: v.object({
    participantCount: v.number(),
    outstandingCount: v.number(),
    canClose: v.boolean(),
    timeline: v.array(
      v.object({
        exhibitionObjectId: v.id("exhibitionObjects"),
        collectionId: v.id("collections"),
        phase: v.union(
          v.literal("installed"),
          v.literal("deinstalled"),
          v.literal("returned"),
          v.literal("exception"),
        ),
        recordedAt: v.number(),
        actorId: v.optional(v.id("users")),
        actorName: v.optional(v.string()),
        conditionAssessmentId: v.optional(v.id("conditionAssessments")),
        movementId: v.optional(v.id("locationHistory")),
        notes: v.optional(v.string()),
      }),
    ),
    participants: v.array(
      v.object({
        exhibitionObjectId: v.id("exhibitionObjects"),
        collectionId: v.id("collections"),
        collectionTitle: v.optional(v.string()),
        collectionAccessionNumber: v.optional(v.string()),
        status: v.union(
          v.literal("pending"),
          v.literal("installed"),
          v.literal("deinstalled"),
          v.literal("returned"),
        ),
        role: v.union(v.literal("featured"), v.literal("participant")),
        order: v.number(),
        hasReturnException: v.boolean(),
        installationMovementId: v.optional(v.id("locationHistory")),
        returnMovementId: v.optional(v.id("locationHistory")),
        installationConditionAssessmentId: v.optional(
          v.id("conditionAssessments"),
        ),
        deinstallationConditionAssessmentId: v.optional(
          v.id("conditionAssessments"),
        ),
        returnConditionAssessmentId: v.optional(v.id("conditionAssessments")),
        installedAt: v.optional(v.number()),
        deinstalledAt: v.optional(v.number()),
        returnedAt: v.optional(v.number()),
        originalLocationId: v.optional(v.id("locations")),
      }),
    ),
    outstanding: v.array(
      v.object({
        exhibitionObjectId: v.id("exhibitionObjects"),
        collectionId: v.id("collections"),
        collectionTitle: v.optional(v.string()),
        collectionAccessionNumber: v.optional(v.string()),
        status: v.union(
          v.literal("pending"),
          v.literal("installed"),
          v.literal("deinstalled"),
          v.literal("returned"),
        ),
        role: v.union(v.literal("featured"), v.literal("participant")),
        order: v.number(),
        hasReturnException: v.boolean(),
        installationMovementId: v.optional(v.id("locationHistory")),
        returnMovementId: v.optional(v.id("locationHistory")),
        installationConditionAssessmentId: v.optional(
          v.id("conditionAssessments"),
        ),
        deinstallationConditionAssessmentId: v.optional(
          v.id("conditionAssessments"),
        ),
        returnConditionAssessmentId: v.optional(v.id("conditionAssessments")),
        installedAt: v.optional(v.number()),
        deinstalledAt: v.optional(v.number()),
        returnedAt: v.optional(v.number()),
        originalLocationId: v.optional(v.id("locations")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) throw new Error("Exhibition not found");
    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(ctx, exhibition.organizationId, "collections.read");
    return await getExhibitionPhysicalHandoffSummary(
      ctx,
      args.exhibitionId,
      exhibition.organizationId,
    );
  },
});

/**
 * List objects in an exhibition
 */
export const listExhibitionObjects = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitionObjects"),
      collectionId: v.id("collections"),
      role: v.union(v.literal("featured"), v.literal("participant")),
      order: v.number(),
      collectionTitle: v.optional(v.string()),
      collectionAccessionNumber: v.optional(v.string()),
      originalLocationId: v.optional(v.id("locations")),
      originalLocationName: v.optional(v.string()),
      exhibitionLocationId: v.optional(v.id("locations")),
      exhibitionLocationName: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("installed"),
        v.literal("deinstalled"),
        v.literal("returned"),
      ),
      installedAt: v.optional(v.number()),
      installedByName: v.optional(v.string()),
      conditionAtInstallation: v.optional(v.string()),
      deinstalledAt: v.optional(v.number()),
      deinstalledByName: v.optional(v.string()),
      conditionAtDeinstallation: v.optional(v.string()),
      returnedAt: v.optional(v.number()),
      installationConditionAssessmentId: v.optional(
        v.id("conditionAssessments"),
      ),
      deinstallationConditionAssessmentId: v.optional(
        v.id("conditionAssessments"),
      ),
      returnConditionAssessmentId: v.optional(v.id("conditionAssessments")),
      returnExceptionReason: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => listExhibitionObjectsHandler(ctx, args),
});

/**
 * Bulk install all pending objects in an exhibition
 */
export const bulkInstallObjects = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    installedCount: v.number(),
  }),
  handler: async (ctx, args) => bulkInstallObjectsHandler(ctx, args),
});

/**
 * Bulk return all deinstalled objects in an exhibition
 */
export const bulkReturnObjects = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    returnedCount: v.number(),
  }),
  handler: async (ctx, args) => bulkReturnObjectsHandler(ctx, args),
});
