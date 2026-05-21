import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
  bulkInstallObjectsHandler,
  bulkReturnObjectsHandler,
  deinstallObjectHandler,
  installObjectHandler,
  listExhibitionObjectsHandler,
  removeExhibitionObjectHandler,
  returnObjectToOriginalLocationHandler,
} from "./utils/exhibitionObjectLocation";
import {
  activateExhibitionHandler,
  approveExhibitionHandler,
  checkScheduleConflictsHandler,
  closeExhibitionHandler,
  getWorkflowHistoryHandler,
  rejectExhibitionHandler,
} from "./utils/exhibitionWorkflow";

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
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
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) =>
    listExhibitionsByOrganizationHandler(ctx, args),
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
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
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
  handler: async (ctx, args) =>
    listExhibitionsForCollectionHandler(ctx, args),
});

export const create = mutation({
  args: {
    collectionId: v.id("collections"),
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

export const getWorkflowHistory = query({
  args: {
    exhibitionId: v.id("exhibitions"),
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
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
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
    conditionNotes: v.optional(v.string()),
    exhibitionLocationId: v.optional(v.id("locations")),
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
    overrideLocationId: v.optional(v.id("locations")),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    returnObjectToOriginalLocationHandler(ctx, args),
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
