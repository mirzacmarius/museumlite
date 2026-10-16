import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  readWorkflowHistoryPage,
  workflowHistoryPageValidator,
} from "./auditLog";
import {
  accessionListItemValidator,
  toAccessionListItems,
} from "./utils/accessionListItems";
import { publishAccessionObjectDraft } from "./utils/accessionObjectDraftPublication";
import {
  accessionReviewDecisionValidator,
  accessionReviewError,
  accessionStatusValidator,
  isAwaitingReview,
  requireReviewReason,
} from "./utils/accessionReview";
import { syncAccessionSearchDocument } from "./utils/accessionSearch";
import { batchLookup } from "./utils/batchLookup";
import { capabilityUnavailable } from "./utils/capabilities";
import { appendCaseHistory, recentCaseHistory } from "./utils/caseHistory";
import { rejectPermanentEvidenceDeletion } from "./utils/evidenceRetention";
import { enforceMediaQuota } from "./utils/featureGates";
import {
  ensureIdentifierAvailable,
  generateConfiguredIdentifier,
  normalizeIdentifier,
} from "./utils/identifiers";
import { countIndexedQuery } from "./utils/indexedCounts";
import { validateObjectReferences } from "./utils/locationIntegrity";
import { isSupportedMediaMimeType } from "./utils/mediaAssets";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import { getWorkflowCreatorRecipient } from "./utils/notificationRecipients";
import {
  accessionDraftMediaValidator,
  objectDraftDataValidator,
} from "./utils/objectDraftData";
import { validateObjectDraftTypeDetails } from "./utils/objectDraftTypeDetails";
import {
  applyEntryReviewDecision,
  assertEntryAcquisitionRestorable,
  assertNoEntryObjectDraft,
  completeEntryAccession,
} from "./utils/objectEntryLifecycle";
import { requireLinkableParty } from "./utils/parties";
import { accessionSourceAssertion, recordPartyLink } from "./utils/partyLinks";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getCurrentUserOrganization,
  getUsersToNotifyForWorkflowStep,
  hasPermission,
  requirePermission,
  resolveCaseApproval,
} from "./utils/permissions";
import { suggestPreparation } from "./utils/preparation";
import {
  keepDraftPrimaryUnlessPermitted,
  normalizeDraftMediaPrimary,
} from "./utils/primaryMedia";
import { canReadRecord } from "./utils/recordAccess";
import {
  assertCurrentEditVersion,
  objectDraftEditVersion,
  recordEditError,
  requireFieldValue,
} from "./utils/recordEdits";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
  validateOwnedUploadSize,
} from "./utils/uploadOwnership";
import { workflowApprovalError } from "./utils/workflowApprovalErrors";
import {
  getWorkflowConfig,
  isAccessionWorkflowEnabled,
} from "./utils/workflowConfigs";
import {
  prepareWorkflowStepAdvance,
  recordWorkflowStepAdvance,
  recordWorkflowStepApproval,
} from "./utils/workflowExecution";
import { resolveWorkflowStepState } from "./utils/workflowSteps";

const accessionDraftMediaWithUrlValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileSize: v.number(),
  mimeType: v.string(),
  mediaCategory: v.union(v.literal("image"), v.literal("document")),
  isPrimary: v.boolean(),
  url: v.union(v.string(), v.null()),
});

function getDraftDisplaySource(
  objectData:
    | {
        creator?: string;
        title: string;
      }
    | null
    | undefined,
) {
  return (
    objectData?.creator?.trim() || objectData?.title?.trim() || "Object intake"
  );
}

async function ensureAccessionNumberAvailable(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  accessionNumber: string,
  existingAccessionId?: Id<"accessions">,
) {
  if (existingAccessionId) {
    const existing = await ctx.db.get(existingAccessionId);
    if (existing?.accessionNumber === accessionNumber) return;
  }
  await ensureIdentifierAvailable(
    ctx,
    organizationId,
    "accession",
    accessionNumber,
    existingAccessionId,
  );
}

async function generateUniqueAccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  return generateConfiguredIdentifier(ctx, organizationId, "accession");
}

/**
 * Create accession record
 */
/**
 * An accepted intake: publishes its object into the collection and suggests
 * the preparation recipes that follow intake acceptance (ADR 0012).
 */
async function completeIntakeAcceptance(
  ctx: MutationCtx,
  accession: Pick<Doc<"accessions">, "_id" | "organizationId">,
  actorId: Id<"users">,
) {
  await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
    accessionId: accession._id,
  });
  await suggestPreparation(
    ctx,
    {
      organizationId: accession.organizationId,
      caseType: "accession",
      caseId: accession._id,
    },
    actorId,
  );
}

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.optional(v.string()),
    catalogIdentifier: v.optional(v.string()),
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

    const accessionWorkflowEnabled = await isAccessionWorkflowEnabled(
      ctx,
      args.organizationId,
    );

    if (accessionWorkflowEnabled) {
      const canInitiate = await canInitiateWorkflow(
        ctx,
        args.organizationId,
        "accession",
      );

      if (!canInitiate) {
        throw new Error(
          "Permission denied: cannot initiate accession workflow",
        );
      }
    } else {
      await requirePermission(ctx, args.organizationId, "collections.create");
    }

    const donor = args.donorAccountId
      ? await requireLinkableParty(
          ctx,
          args.organizationId,
          args.donorAccountId,
        )
      : null;
    // Generate or use provided accession number
    let accessionNumber: string;
    if (args.accessionNumber) {
      accessionNumber = args.accessionNumber;
    } else {
      accessionNumber = await generateUniqueAccessionNumber(
        ctx,
        args.organizationId,
      );
    }

    // Get workflow config
    const workflowConfig = accessionWorkflowEnabled
      ? await getWorkflowConfig(ctx, args.organizationId, "accession")
      : null;
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

    await ensureAccessionNumberAvailable(
      ctx,
      args.organizationId,
      accessionNumber,
    );
    if (args.catalogIdentifier !== undefined)
      await ensureIdentifierAvailable(
        ctx,
        args.organizationId,
        "catalog",
        args.catalogIdentifier,
      );
    const accessionId = await ctx.db.insert("accessions", {
      organizationId: args.organizationId,
      accessionNumber,
      catalogIdentifier: args.catalogIdentifier,
      approvedBy: workflowConfig ? undefined : userId,
      approvedAt: workflowConfig ? undefined : Date.now(),
      normalizedIdentifier: normalizeIdentifier(accessionNumber),
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

    for (const storageId of args.documents ?? [])
      await claimStorageOwnership(ctx, {
        storageId,
        organizationId: args.organizationId,
        uploadedBy: userId,
        ownerType: "accessionDocument",
        ownerId: accessionId,
      });
    if (donor)
      await recordPartyLink(ctx, {
        organizationId: args.organizationId,
        target: { type: "accession", id: accessionId },
        account: donor,
        role: "donor",
        allowedRoles: ["donor"],
        effectiveFrom: args.dateReceived,
        assertedName: accessionSourceAssertion(args.source),
        userId,
        origin: "staff",
      });
    await Promise.all([
      syncAccessionSearchDocument(ctx, accessionId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "created",
        entityType: "accession",
        entityId: accessionId,
        changes: {
          accessionNumber,
          status: workflowConfig ? "pending" : "approved",
        },
      }),
    ]);

    // If workflow exists, notify users who can approve step 1
    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "accession",
        workflowState.firstStep ?? 1,
      );

      // Create notifications for approvers
      await dispatchNotification(ctx, {
        organizationId: args.organizationId,
        type: "workflow_pending",
        recipients: usersToNotify.filter((approverId) => approverId !== userId),
        title: "New Accession Requires Approval",
        message: `Accession ${accessionNumber} is pending your approval at step ${workflowState.firstStep ?? 1}.`,
        related: { entityType: "accession", entityId: accessionId },
      });
    }

    // Without a workflow the intake is accepted as it is created.
    if (!workflowConfig) {
      await completeIntakeAcceptance(
        ctx,
        { _id: accessionId, organizationId: args.organizationId },
        userId,
      );
    }

    return accessionId;
  },
});

export const generateDraftUploadUrl = mutation({
  args: {
    organizationId: v.id("organizations"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "media.upload"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (!isSupportedMediaMimeType(args.mimeType)) {
      throw new Error(`Unsupported file type: ${args.mimeType}`);
    }

    validateOwnedUploadSize(args.fileSize);
    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    return {
      uploadUrl: await createAuthorizedUploadUrl(
        ctx,
        userId,
        args.organizationId,
      ),
    };
  },
});

/**
 * Members whose role may not start accession review learn why; others get
 * the legacy uncoded error, so outsiders learn nothing (ADR 0004).
 */
async function workflowInitiationRefusal(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const message = "Permission denied: cannot initiate accession workflow";
  return (await getCurrentUserOrganization(ctx, organizationId))
    ? capabilityUnavailable({ reason: "permission_missing", message })
    : new Error(message);
}

const objectDraftSaveValidator = v.object({
  organizationId: v.id("organizations"),
  accessionId: v.optional(v.id("accessions")),
  saveMode: v.union(v.literal("draft"), v.literal("submit")),
  objectData: objectDraftDataValidator,
  draftMedia: v.optional(v.array(accessionDraftMediaValidator)),
  /** From `recordEdits.getEditState`; a stale version is refused. */
  expectedEditVersion: v.optional(v.string()),
});

/**
 * Saves the intake form's object draft, creating the pending accession on the
 * first save. Submitting starts review, or approves at once without a
 * workflow.
 */
async function saveObjectDraftRecord(
  ctx: MutationCtx,
  args: Infer<typeof objectDraftSaveValidator>,
): Promise<Id<"accessions">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const accessionWorkflowEnabled = await isAccessionWorkflowEnabled(
    ctx,
    args.organizationId,
  );
  const workflowConfig = accessionWorkflowEnabled
    ? await getWorkflowConfig(ctx, args.organizationId, "accession")
    : null;

  await validateObjectReferences(ctx, args.organizationId, args.objectData);
  const normalizedObjectData = {
    ...args.objectData,
    title: args.objectData.title.trim(),
  };
  const submittedDraftMedia =
    args.draftMedia && normalizeDraftMediaPrimary(args.draftMedia);

  requireFieldValue("title", normalizedObjectData.title);

  if (args.saveMode === "submit" && accessionWorkflowEnabled) {
    const canInitiate = await canInitiateWorkflow(
      ctx,
      args.organizationId,
      "accession",
    );

    if (!canInitiate) {
      throw await workflowInitiationRefusal(ctx, args.organizationId);
    }
  } else if (args.saveMode === "submit") {
    await requirePermission(ctx, args.organizationId, "collections.create");
  }

  const source = getDraftDisplaySource(normalizedObjectData);
  const workflowState = resolveWorkflowStepState(
    workflowConfig?.steps,
    undefined,
  );

  if (
    args.saveMode === "submit" &&
    workflowConfig &&
    workflowState.firstStep === undefined
  ) {
    throw workflowApprovalError(
      "WORKFLOW_NOT_CONFIGURED",
      "Workflow has no approval steps configured",
    );
  }

  const nextWorkflowStep =
    args.saveMode === "submit" && workflowConfig
      ? (workflowState.firstStep ?? 1)
      : 0;
  const shouldAutoApproveSubmit = args.saveMode === "submit" && !workflowConfig;

  if (args.accessionId) {
    const existing = await ctx.db.get(args.accessionId);
    if (!existing) {
      throw new Error("Accession not found");
    }
    if (existing.organizationId !== args.organizationId) {
      throw new Error("Accession does not belong to this organization");
    }
    await requirePermission(ctx, args.organizationId, "collections.update");
    if (existing.status !== "pending") {
      throw recordEditError(
        "RECORD_NOT_EDITABLE",
        "Only pending accessions can be updated",
      );
    }
    assertNoEntryObjectDraft(existing);
    assertCurrentEditVersion(
      await objectDraftEditVersion(existing),
      args.expectedEditVersion,
    );

    await validateObjectDraftTypeDetails(
      ctx,
      args.organizationId,
      args.objectData,
    );
    const draftMedia =
      submittedDraftMedia &&
      (await keepDraftPrimaryUnlessPermitted(
        ctx,
        args.organizationId,
        existing.draftMedia,
        submittedDraftMedia,
      ));

    const updatedWorkflowStep = shouldAutoApproveSubmit
      ? undefined
      : existing.workflowStep && existing.workflowStep > 0
        ? existing.workflowStep
        : nextWorkflowStep;

    const accessionNumber = normalizedObjectData.accessionNumber?.trim()
      ? normalizedObjectData.accessionNumber
      : existing.accessionNumber;
    if (accessionNumber !== existing.accessionNumber) {
      throw recordEditError(
        "IDENTIFIER_PERMANENT",
        "An existing accession identifier is permanent. Keep the original number; record historical conflicts in Settings > Preferences instead of renumbering.",
        { field: "accessionNumber" },
      );
    }

    await ensureAccessionNumberAvailable(
      ctx,
      args.organizationId,
      accessionNumber,
      existing._id,
    );

    for (const media of draftMedia ?? [])
      await claimStorageOwnership(ctx, {
        storageId: media.storageId,
        organizationId: args.organizationId,
        uploadedBy: userId,
        expectedFileSize: media.fileSize,
        expectedMimeType: media.mimeType,
        ownerType: "accessionDraft",
        ownerId: existing._id,
      });
    const submittedAt = Date.now();
    await Promise.all([
      ctx.db.patch(existing._id, {
        accessionNumber,
        normalizedIdentifier: normalizeIdentifier(accessionNumber),
        source,
        notes: normalizedObjectData.description?.trim() || existing.notes,
        status: shouldAutoApproveSubmit ? "approved" : existing.status,
        approvedBy: shouldAutoApproveSubmit ? userId : existing.approvedBy,
        approvedAt: shouldAutoApproveSubmit ? submittedAt : existing.approvedAt,
        workflowStep: updatedWorkflowStep,
        draftObjectData: {
          ...normalizedObjectData,
          accessionNumber,
        },
        draftMedia: draftMedia ?? existing.draftMedia,
      }),
      syncAccessionSearchDocument(ctx, existing._id),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action:
          args.saveMode === "submit"
            ? "submitted_object_accession"
            : "saved_object_draft",
        entityType: "accession",
        entityId: existing._id,
        changes: {
          accessionNumber,
          saveMode: args.saveMode,
          workflowStep: updatedWorkflowStep,
          status: shouldAutoApproveSubmit ? "approved" : existing.status,
          title: normalizedObjectData.title,
        },
      }),
    ] as const);

    if (shouldAutoApproveSubmit) {
      await completeIntakeAcceptance(ctx, existing, userId);
    }

    if (args.saveMode === "submit" && workflowConfig) {
      if (updatedWorkflowStep === undefined) {
        throw new Error("Workflow step is required for accession workflow");
      }
      if (updatedWorkflowStep === existing.workflowStep) {
        return existing._id;
      }

      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "accession",
        updatedWorkflowStep,
      );

      await dispatchNotification(ctx, {
        organizationId: args.organizationId,
        type: "workflow_pending",
        recipients: usersToNotify.filter((approverId) => approverId !== userId),
        title: "Object Request Requires Approval",
        message: `Object request ${accessionNumber} is pending your approval.`,
        related: { entityType: "accession", entityId: existing._id },
      });
    }

    return existing._id;
  }

  await requirePermission(ctx, args.organizationId, "collections.create");
  await validateObjectDraftTypeDetails(
    ctx,
    args.organizationId,
    args.objectData,
  );

  let accessionNumber = normalizedObjectData.accessionNumber?.trim()
    ? normalizedObjectData.accessionNumber
    : undefined;
  if (!accessionNumber) {
    accessionNumber = await generateUniqueAccessionNumber(
      ctx,
      args.organizationId,
    );
  }

  const now = Date.now();
  const workflowHistory = [
    {
      step: 0,
      approvedBy: userId,
      approvedAt: now,
      comment:
        args.saveMode === "submit"
          ? "Submitted object request"
          : "Saved object draft",
    },
  ];

  await ensureAccessionNumberAvailable(
    ctx,
    args.organizationId,
    accessionNumber,
  );
  const accessionId = await ctx.db.insert("accessions", {
    organizationId: args.organizationId,
    accessionNumber,
    normalizedIdentifier: normalizeIdentifier(accessionNumber),
    dateReceived: now,
    source,
    method: "other",
    notes: normalizedObjectData.description?.trim() || undefined,
    status: shouldAutoApproveSubmit ? "approved" : "pending",
    approvedBy: shouldAutoApproveSubmit ? userId : undefined,
    approvedAt: shouldAutoApproveSubmit ? now : undefined,
    workflowStep: shouldAutoApproveSubmit ? undefined : nextWorkflowStep,
    workflowHistory,
    draftObjectData: {
      ...normalizedObjectData,
      accessionNumber,
    },
    draftMedia: submittedDraftMedia,
  });
  for (const media of submittedDraftMedia ?? [])
    await claimStorageOwnership(ctx, {
      storageId: media.storageId,
      organizationId: args.organizationId,
      uploadedBy: userId,
      expectedFileSize: media.fileSize,
      expectedMimeType: media.mimeType,
      ownerType: "accessionDraft",
      ownerId: accessionId,
    });
  await Promise.all([
    syncAccessionSearchDocument(ctx, accessionId),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action:
        args.saveMode === "submit"
          ? "submitted_object_accession"
          : "saved_object_draft",
      entityType: "accession",
      entityId: accessionId,
      changes: {
        accessionNumber,
        saveMode: args.saveMode,
        workflowStep: shouldAutoApproveSubmit ? undefined : nextWorkflowStep,
        status: shouldAutoApproveSubmit ? "approved" : "pending",
        title: normalizedObjectData.title,
      },
    }),
  ]);

  if (shouldAutoApproveSubmit) {
    await completeIntakeAcceptance(
      ctx,
      { _id: accessionId, organizationId: args.organizationId },
      userId,
    );
  }

  if (args.saveMode === "submit" && workflowConfig) {
    const usersToNotify = await getUsersToNotifyForWorkflowStep(
      ctx,
      args.organizationId,
      "accession",
      nextWorkflowStep,
    );

    await dispatchNotification(ctx, {
      organizationId: args.organizationId,
      type: "workflow_pending",
      recipients: usersToNotify.filter((approverId) => approverId !== userId),
      title: "Object Request Requires Approval",
      message: `Object request ${accessionNumber} is pending your approval.`,
      related: { entityType: "accession", entityId: accessionId },
    });
  }

  return accessionId;
}

export const saveObjectDraft = mutation({
  args: objectDraftSaveValidator.fields,
  returns: v.object({
    accessionId: v.id("accessions"),
    editVersion: v.string(),
  }),
  handler: async (ctx, args) => {
    const accessionId = await saveObjectDraftRecord(ctx, args);
    const accession = await ctx.db.get(accessionId);
    if (!accession) throw new Error("Draft disappeared during save");
    return {
      accessionId,
      editVersion: await objectDraftEditVersion(accession),
    };
  },
});

/** Earlier form of `saveObjectDraft` that returns only the accession id. */
export const upsertObjectDraft = mutation({
  args: objectDraftSaveValidator.fields,
  returns: v.id("accessions"),
  handler: (ctx, args) => saveObjectDraftRecord(ctx, args),
});

/**
 * List accessions with filters
 */
const accessionPageValidator = v.object({
  page: v.array(accessionListItemValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(accessionStatusValidator),
    search: v.optional(v.string()),
  },
  returns: accessionPageValidator,
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const search = args.search?.trim();
    const status = args.status;

    if (search) {
      const result = await ctx.db
        .query("accessionSearchDocuments")
        .withSearchIndex("search_text", (q) => {
          const scoped = q
            .search("searchText", search)
            .eq("organizationId", args.organizationId);
          return status ? scoped.eq("status", status) : scoped;
        })
        .paginate(args.paginationOpts);
      return {
        page: await toAccessionListItems(
          ctx,
          await loadSearchedAccessions(ctx, result.page),
        ),
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    const result = status
      ? await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_status_and_dateReceived", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", status),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_dateReceived", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .order("desc")
          .paginate(args.paginationOpts);
    return {
      page: await toAccessionListItems(ctx, result.page),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

async function loadSearchedAccessions(
  ctx: QueryCtx,
  documents: Doc<"accessionSearchDocuments">[],
) {
  const accessionsById = await batchLookup(
    ctx,
    documents.map((document) => document.accessionId),
    "accessions",
  );
  return documents.flatMap((document) => {
    const accession = accessionsById.get(document.accessionId);
    return accession ? [accession] : [];
  });
}

/** Configured approval steps; Draft is 0 and Approved is -1. */
async function getLastAccessionStep(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const config = await getWorkflowConfig(ctx, organizationId, "accession");
  return Math.max(0, ...(config?.steps.map((step) => step.stepNumber) ?? []));
}

/**
 * Pending accessions in one board column. Draft also holds legacy rows
 * without a step, and the last step holds rows left beyond a shortened
 * workflow, so every pending accession appears in exactly one column.
 */
function pendingColumnQuery(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  step: number,
  lastStep: number,
) {
  const index = "by_organization_and_status_and_workflowStep_and_dateReceived";
  if (lastStep === 0) {
    return ctx.db
      .query("accessions")
      .withIndex(index, (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      );
  }
  if (step <= 0) {
    return ctx.db
      .query("accessions")
      .withIndex(index, (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("status", "pending")
          .lte("workflowStep", 0),
      );
  }
  if (step >= lastStep) {
    return ctx.db
      .query("accessions")
      .withIndex(index, (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("status", "pending")
          .gte("workflowStep", lastStep),
      );
  }
  return ctx.db
    .query("accessions")
    .withIndex(index, (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("status", "pending")
        .eq("workflowStep", step),
    );
}

function isInPendingColumn(
  accession: Doc<"accessions">,
  step: number,
  lastStep: number,
) {
  if (accession.status !== "pending") return false;
  const current = accession.workflowStep ?? 0;
  if (lastStep === 0) return true;
  if (step <= 0) return current <= 0;
  if (step >= lastStep) return current >= lastStep;
  return current === step;
}

const boardColumnValidator = v.union(
  v.object({ kind: v.literal("approved") }),
  v.object({ kind: v.literal("withdrawn") }),
  v.object({ kind: v.literal("step"), step: v.number() }),
);

/** Approved reads as a log ordered by approval; other columns by receipt. */
function boardColumnQuery(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  column: Infer<typeof boardColumnValidator>,
  lastStep: number,
) {
  if (column.kind === "step") {
    return pendingColumnQuery(ctx, organizationId, column.step, lastStep);
  }
  if (column.kind === "approved") {
    return ctx.db
      .query("accessions")
      .withIndex("by_organization_and_status_and_approvedAt", (q) =>
        q.eq("organizationId", organizationId).eq("status", "approved"),
      );
  }
  const withdrawn: "withdrawn" = column.kind;
  return ctx.db
    .query("accessions")
    .withIndex("by_organization_and_status_and_dateReceived", (q) =>
      q.eq("organizationId", organizationId).eq("status", withdrawn),
    );
}

/**
 * One accession board column, paginated on the server. With a search, rows
 * come from the indexed search documents; a page can hold fewer rows than
 * requested while more remain.
 */
export const listBoardColumn = query({
  args: {
    organizationId: v.id("organizations"),
    column: boardColumnValidator,
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: accessionPageValidator,
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const search = args.search?.trim();
    const column = args.column;
    const lastStep = await getLastAccessionStep(ctx, args.organizationId);

    if (search) {
      const status = column.kind === "step" ? "pending" : column.kind;
      const result = await ctx.db
        .query("accessionSearchDocuments")
        .withSearchIndex("search_text", (q) =>
          q
            .search("searchText", search)
            .eq("organizationId", args.organizationId)
            .eq("status", status),
        )
        .paginate(args.paginationOpts);
      const accessions = await loadSearchedAccessions(ctx, result.page);
      return {
        page: await toAccessionListItems(
          ctx,
          column.kind === "step"
            ? accessions.filter((row) =>
                isInPendingColumn(row, column.step, lastStep),
              )
            : accessions.filter((row) => row.status === status),
        ),
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    const result = await boardColumnQuery(
      ctx,
      args.organizationId,
      column,
      lastStep,
    )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      page: await toAccessionListItems(ctx, result.page),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/** Exact board totals, independent of which rows a client has loaded. */
export const getBoardCounts = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    pending: v.number(),
    approved: v.number(),
    /** Legacy rejections; new reviewer rejections return to Draft or withdraw. */
    rejected: v.number(),
    withdrawn: v.number(),
    columns: v.array(v.object({ stepNumber: v.number(), count: v.number() })),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const lastStep = await getLastAccessionStep(ctx, args.organizationId);
    const countStatus = (status: Doc<"accessions">["status"]) =>
      countIndexedQuery(
        ctx.db
          .query("accessions")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", status),
          ),
      );
    const steps = Array.from({ length: lastStep + 1 }, (_, step) => step);
    const [pending, approved, rejected, withdrawn, ...stepCounts] =
      await Promise.all([
        countStatus("pending"),
        countStatus("approved"),
        countStatus("rejected"),
        countStatus("withdrawn"),
        ...steps.map((step) =>
          countIndexedQuery(
            pendingColumnQuery(ctx, args.organizationId, step, lastStep),
          ),
        ),
      ]);
    return {
      pending,
      approved,
      rejected,
      withdrawn,
      columns: [
        ...steps.map((stepNumber, index) => ({
          stepNumber,
          count: stepCounts[index] ?? 0,
        })),
        { stepNumber: -1, count: approved },
      ],
    };
  },
});

/**
 * Get accession details
 */
export const get = query({
  args: {
    // A string, so malformed links and other tables' IDs read as missing.
    accessionId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("accessions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      collectionId: v.optional(v.id("collections")),
      accessionNumber: v.string(),
      catalogIdentifier: v.optional(v.string()),
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
      sourceVerified: v.optional(v.boolean()),
      sourceVerificationNotes: v.optional(v.string()),
      sourceVerificationException: v.optional(
        v.object({ reason: v.string(), authorizedAt: v.number() }),
      ),
      canCurrentUserApprove: v.boolean(),
      canCurrentUserRestore: v.boolean(),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      status: accessionStatusValidator,
      notes: v.optional(v.string()),
      workflowStep: v.optional(v.number()),
      reviewDecision: v.optional(
        accessionReviewDecisionValidator.omit("decidedBy").extend({
          decidedByName: v.optional(v.string()),
        }),
      ),
      draftObjectData: v.optional(objectDraftDataValidator),
      draftMedia: v.optional(v.array(accessionDraftMediaWithUrlValidator)),
      workflowHistory: v.optional(
        v.array(
          v.object({
            step: v.number(),
            approvedBy: v.id("users"),
            approvedAt: v.number(),
            comment: v.optional(v.string()),
            approverName: v.optional(v.string()),
          }),
        ),
      ),
      workflowHistoryIsPreview: v.literal(true),
      workflowHistoryHasMore: v.boolean(),
      /** The entry the object was received under, for entry acquisitions. */
      entry: v.optional(
        v.object({ _id: v.id("objectEntries"), entryNumber: v.string() }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const accessionId = ctx.db.normalizeId("accessions", args.accessionId);
    const accession = accessionId ? await ctx.db.get(accessionId) : null;
    if (
      !accession ||
      !(await canReadRecord(ctx, accession.organizationId, "collections.read"))
    ) {
      return null;
    }

    let canCurrentUserApprove = false;
    if (isAwaitingReview(accession)) {
      const workflowConfig = await getWorkflowConfig(
        ctx,
        accession.organizationId,
        "accession",
      );

      const workflowState = resolveWorkflowStepState(
        workflowConfig?.steps,
        accession.workflowStep,
      );
      const effectiveApprovalStep = workflowState.currentStep;

      if (effectiveApprovalStep !== undefined) {
        const hasApprovalPermission = await hasPermission(
          ctx,
          accession.organizationId,
          "collections.approve_accession",
        );

        canCurrentUserApprove =
          hasApprovalPermission &&
          (await canApproveAtStep(
            ctx,
            accession.organizationId,
            "accession",
            effectiveApprovalStep,
          ));
      }
    }

    const canCurrentUserRestore =
      accession.status === "withdrawn" &&
      (
        await resolveIntakeReviewer(
          ctx,
          accession.organizationId,
          accession.reviewDecision?.fromStep,
        )
      ).allowed;
    const reviewDecision = accession.reviewDecision;
    const decidedBy = reviewDecision
      ? await ctx.db.get(reviewDecision.decidedBy)
      : null;

    // Ensure workflowHistory is always an array (even if empty)
    const historyPreview = await recentCaseHistory(ctx, accession, "accession");
    const entry = accession.entryId
      ? await ctx.db.get(accession.entryId)
      : null;
    const draftMedia = accession.draftMedia
      ? await Promise.all(
          accession.draftMedia.map(async (mediaItem) => ({
            ...mediaItem,
            url: await ctx.storage.getUrl(mediaItem.storageId),
          })),
        )
      : undefined;

    // IMPORTANT: Convex return validators are strict. Do not spread `accession`,
    // because the DB document may include additional fields (for example
    // `assignedTo`) that are not part of this query's `returns` shape.
    return {
      _id: accession._id,
      _creationTime: accession._creationTime,
      organizationId: accession.organizationId,
      collectionId: accession.collectionId,
      accessionNumber: accession.accessionNumber,
      catalogIdentifier: accession.catalogIdentifier,
      dateReceived: accession.dateReceived,
      source: accession.source,
      method: accession.method,
      cost: accession.cost,
      sourceVerified: accession.sourceVerified,
      sourceVerificationNotes: accession.sourceVerificationNotes,
      sourceVerificationException: accession.sourceVerificationException && {
        reason: accession.sourceVerificationException.reason,
        authorizedAt: accession.sourceVerificationException.authorizedAt,
      },
      canCurrentUserApprove,
      canCurrentUserRestore,
      approvedBy: accession.approvedBy,
      approvedAt: accession.approvedAt,
      status: accession.status,
      notes: accession.notes,
      workflowStep: accession.workflowStep,
      reviewDecision: reviewDecision && {
        decision: reviewDecision.decision,
        reason: reviewDecision.reason,
        decidedAt: reviewDecision.decidedAt,
        fromStep: reviewDecision.fromStep,
        decidedByName:
          decidedBy?.name ?? decidedBy?.username ?? decidedBy?.email,
      },
      draftObjectData: accession.draftObjectData,
      draftMedia,
      workflowHistory: historyPreview.entries,
      workflowHistoryIsPreview: true as const,
      workflowHistoryHasMore: historyPreview.hasMore,
      entry:
        entry && entry.organizationId === accession.organizationId
          ? { _id: entry._id, entryNumber: entry.entryNumber }
          : undefined,
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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
    const donor =
      args.donorAccountId !== undefined
        ? await requireLinkableParty(
            ctx,
            accession.organizationId,
            args.donorAccountId,
          )
        : null;
    if (donor) updates.donorAccountId = donor._id;
    if (args.documents !== undefined) {
      const existingDocuments = new Set(accession.documents);
      for (const storageId of args.documents) {
        if (!existingDocuments.has(storageId))
          await claimStorageOwnership(ctx, {
            storageId,
            organizationId: accession.organizationId,
            uploadedBy: userId,
            ownerType: "accessionDocument",
            ownerId: accession._id,
          });
      }
      updates.documents = args.documents;
    }
    if (args.method !== undefined) updates.method = args.method;
    if (args.cost !== undefined) updates.cost = args.cost;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.accessionId, updates);
    if (donor)
      await recordPartyLink(ctx, {
        organizationId: accession.organizationId,
        target: { type: "accession", id: accession._id },
        account: donor,
        role: "donor",
        allowedRoles: ["donor"],
        effectiveFrom: accession.dateReceived,
        assertedName: accessionSourceAssertion(
          updates.source ?? accession.source,
        ),
        userId,
        origin: "staff",
      });
    await syncAccessionSearchDocument(ctx, args.accessionId);

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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "pending") {
      throw new Error("Can only update workflow step for pending accessions");
    }

    if (args.workflowStep < 0 || args.workflowStep > 2) {
      throw new Error("Invalid workflow step");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "pending" || (accession.workflowStep ?? 0) > 0) {
      throw accessionReviewError(
        "NOT_A_DRAFT",
        "Only a draft accession can be submitted for approval",
      );
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    const workflowConfig = await getWorkflowConfig(
      ctx,
      accession.organizationId,
      "accession",
    );

    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      undefined,
    );
    const firstApprovalStep = workflowState.firstStep;

    if (workflowConfig && firstApprovalStep === undefined) {
      throw workflowApprovalError(
        "WORKFLOW_NOT_CONFIGURED",
        "Workflow has no approval steps configured",
      );
    }

    const workflowStep = firstApprovalStep ?? 1;
    await ctx.db.patch(args.accessionId, { workflowStep });
    const reviewers = await getUsersToNotifyForWorkflowStep(
      ctx,
      accession.organizationId,
      "accession",
      workflowStep,
    );
    await Promise.all([
      ctx.runMutation(internal.workflows.recordWorkflowHistory, {
        organizationId: accession.organizationId,
        workflowType: "accession",
        entityId: args.accessionId,
        fromStep: accession.workflowStep ?? 0,
        toStep: workflowStep,
        action: "submitted",
        performedBy: userId,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId,
        action: "submitted_object_accession",
        entityType: "accession",
        entityId: args.accessionId,
        changes: {
          accessionNumber: accession.accessionNumber,
          saveMode: "submit",
          workflowStep,
          status: accession.status,
        },
      }),
      dispatchNotification(ctx, {
        organizationId: accession.organizationId,
        type: "workflow_pending",
        recipients: Array.from(reviewers).filter(
          (reviewerId) => reviewerId !== userId,
        ),
        title: "Object Request Requires Approval",
        message: `Object request ${accession.accessionNumber} is pending your approval.`,
        related: { entityType: "accession", entityId: args.accessionId },
      }),
    ]);

    return null;
  },
});

export const approve = mutation({
  args: {
    accessionId: v.id("accessions"),
    comment: v.optional(v.string()),
    /** Approve despite missing required source verification, with a reason. */
    sourceVerificationExceptionReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (!isAwaitingReview(accession)) {
      throw accessionReviewError(
        "NOT_IN_REVIEW",
        "Accession is not awaiting review",
      );
    }

    const approval = await resolveCaseApproval(
      ctx,
      accession.organizationId,
      "accession",
      accession.workflowStep,
    );
    if (!approval.allowed) {
      throw approval.refusal;
    }

    if (approval.workflow) {
      const {
        config: workflowConfig,
        state: workflowState,
        currentStep,
      } = approval.workflow;

      // Drafts and existing-object accessions follow the same source rule.
      // A recorded exception satisfies it for the remaining steps.
      const sourceVerificationMissing =
        workflowConfig.requireSourceVerification === true &&
        !accession.sourceVerified &&
        !accession.sourceVerificationException;
      const exceptionReason = args.sourceVerificationExceptionReason?.trim();
      if (sourceVerificationMissing && !exceptionReason) {
        throw accessionReviewError(
          "SOURCE_VERIFICATION_REQUIRED",
          "Source verification is required before approval",
        );
      }
      if (!sourceVerificationMissing && exceptionReason) {
        throw new ConvexError(
          "Source verification is complete or not required; approve without an exception",
        );
      }
      if (sourceVerificationMissing && exceptionReason) {
        await Promise.all([
          ctx.db.patch(args.accessionId, {
            sourceVerificationException: {
              reason: exceptionReason,
              authorizedBy: userId,
              authorizedAt: Date.now(),
              stepNumber: currentStep,
            },
          }),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: accession.organizationId,
            userId,
            action: "source_verification_exception_authorized",
            entityType: "accession",
            entityId: args.accessionId,
            changes: { reason: exceptionReason, step: currentStep },
          }),
        ] as const);
      }

      const currentStepConfig = workflowConfig.steps.find(
        (s) => s.stepNumber === currentStep,
      );
      if (!currentStepConfig) {
        throw workflowApprovalError(
          "WORKFLOW_NOT_CONFIGURED",
          "Current workflow step is not configured",
        );
      }

      const { approvalDecision, approvalMode } =
        await recordWorkflowStepApproval(ctx, {
          organizationId: accession.organizationId,
          workflowType: "accession",
          entityId: args.accessionId,
          stepNumber: currentStep,
          step: currentStepConfig,
          performedBy: userId,
          comment: args.comment,
          isPastLastStep: workflowState.isPastLastStep,
        });

      if (!approvalDecision.shouldAdvance) {
        return null;
      }

      const history = [...(accession.workflowHistory ?? [])];
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
          ctx.db.patch(args.accessionId, {
            status: "approved",
            approvedBy: userId,
            approvedAt: Date.now(),
            ...(await appendCaseHistory(ctx, accession, "accession", history)),
          }),
          syncAccessionSearchDocument(ctx, args.accessionId),
          ctx.runMutation(internal.workflows.recordWorkflowHistory, {
            organizationId: accession.organizationId,
            workflowType: "accession",
            entityId: args.accessionId,
            fromStep: workflowState.requestedStep ?? currentStep,
            toStep: -1,
            action: "completed",
            performedBy: userId,
            comment: args.comment,
          }),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: accession.organizationId,
            userId,
            action: "approved",
            entityType: "accession",
            entityId: args.accessionId,
            changes: {
              status: "approved",
              step: workflowState.requestedStep ?? currentStep,
            },
          }),
        ] as const);

        const creatorId = getWorkflowCreatorRecipient(history, userId);
        if (creatorId && creatorId !== userId) {
          await dispatchNotification(ctx, {
            organizationId: accession.organizationId,
            type: "workflow_approved",
            recipients: [creatorId],
            title: "Accession Approved",
            message: `Accession ${accession.accessionNumber} has been fully approved and added to the collection.`,
            related: { entityType: "accession", entityId: args.accessionId },
          });
        }

        await completeIntakeAcceptance(ctx, accession, userId);
      } else {
        const nextStep = await prepareWorkflowStepAdvance(ctx, {
          organizationId: accession.organizationId,
          workflowType: "accession",
          fromStep: currentStep,
          toStep: workflowState.nextStep,
          validateTransition: true,
        });

        await ctx.db.patch(args.accessionId, {
          workflowStep: nextStep,
          ...(await appendCaseHistory(ctx, accession, "accession", history)),
        });

        if (approvalMode !== "single") {
          await ctx.runMutation(internal.workflows.clearStepApprovals, {
            workflowType: "accession",
            entityId: args.accessionId,
            stepNumber: currentStep,
          });
        }

        await recordWorkflowStepAdvance(ctx, {
          organizationId: accession.organizationId,
          workflowType: "accession",
          entityId: args.accessionId,
          fromStep: currentStep,
          toStep: nextStep,
          performedBy: userId,
          comment: args.comment,
          recordWorkflowHistory: true,
          notification: {
            title: "Accession Requires Your Approval",
            message: `Accession ${accession.accessionNumber} is pending your approval at step ${nextStep}.`,
          },
        });
      }
    } else {
      const [, userOrgs] = await Promise.all([
        Promise.all([
          ctx.db.patch(args.accessionId, {
            status: "approved",
            approvedBy: userId,
            approvedAt: Date.now(),
          }),
          syncAccessionSearchDocument(ctx, args.accessionId),
          ctx.runMutation(internal.workflows.recordWorkflowHistory, {
            organizationId: accession.organizationId,
            workflowType: "accession",
            entityId: args.accessionId,
            fromStep: 0,
            toStep: -1,
            action: "completed",
            performedBy: userId,
            comment: args.comment,
          }),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: accession.organizationId,
            userId,
            action: "approved",
            entityType: "accession",
            entityId: args.accessionId,
            changes: { status: "approved" },
          }),
        ]),
        ctx.db
          .query("userOrganizations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", accession.organizationId),
          )
          .collect(),
      ] as const);

      await dispatchNotification(ctx, {
        organizationId: accession.organizationId,
        type: "workflow_approved",
        recipients: userOrgs.flatMap((userOrg) =>
          userOrg.userId === userId ? [] : [userOrg.userId],
        ),
        title: "Accession Approved",
        message: `Accession ${accession.accessionNumber} has been approved and added to the collection.`,
        related: { entityType: "accession", entityId: args.accessionId },
      });

      await completeIntakeAcceptance(ctx, accession, userId);
    }

    return null;
  },
});

/**
 * Whether the caller may decide on an intake at a workflow step: the approver
 * permission plus that step's role (organization administrators override step
 * roles). Returns the configured step the decision applies to.
 */
async function resolveIntakeReviewer(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowStep: number | undefined,
) {
  const [hasApprovePermission, workflowConfig] = await Promise.all([
    hasPermission(ctx, organizationId, "collections.approve_accession"),
    getWorkflowConfig(ctx, organizationId, "accession"),
  ]);
  const step = resolveWorkflowStepState(
    workflowConfig?.steps,
    workflowStep,
  ).currentStep;
  const allowed =
    hasApprovePermission &&
    (!workflowConfig ||
      step === undefined ||
      (await canApproveAtStep(ctx, organizationId, "accession", step)));
  return { allowed, step };
}

async function requireIntakeReviewer(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  workflowStep: number | undefined,
) {
  const reviewer = await resolveIntakeReviewer(
    ctx,
    organizationId,
    workflowStep,
  );
  if (!reviewer.allowed) {
    throw accessionReviewError(
      "NOT_PERMITTED",
      "Permission denied: cannot review this accession at its step",
    );
  }
  return reviewer.step;
}

type IntakeReviewDecision = typeof accessionReviewDecisionValidator.type;

const intakeReviewDecisionRecords = {
  returned_to_draft: {
    historyLabel: "Returned to draft",
    workflowAction: "returned",
    notificationType: "workflow_rejected",
    notificationTitle: "Object Request Returned to Draft",
    notificationMessage: (accessionNumber: string) =>
      `Object request ${accessionNumber} was returned to draft for changes.`,
  },
  withdrawn: {
    historyLabel: "Withdrawn",
    workflowAction: "cancelled",
    notificationType: "workflow_rejected",
    notificationTitle: "Object Request Withdrawn",
    notificationMessage: (accessionNumber: string) =>
      `Object request ${accessionNumber} was withdrawn from review. The record is kept and can be restored.`,
  },
  restored: {
    historyLabel: "Restored to draft",
    workflowAction: "returned",
    notificationType: "workflow_restored",
    notificationTitle: "Object Request Restored",
    notificationMessage: (accessionNumber: string) =>
      `Object request ${accessionNumber} was restored to draft.`,
  },
} as const;

/**
 * Applies a reviewer decision to an intake and records it in the case
 * history, workflow history and audit log, and tells the submitter why.
 */
export async function recordIntakeReviewDecision(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
  {
    decidedBy,
    decision,
    fromStep,
    reason,
  }: Omit<IntakeReviewDecision, "decidedAt">,
) {
  const record = intakeReviewDecisionRecords[decision];
  const decidedAt = Date.now();
  const withdrawn = decision === "withdrawn";
  await applyEntryReviewDecision(ctx, accession, decision, decidedAt);
  const history = [
    ...(accession.workflowHistory ?? []),
    {
      step: fromStep,
      approvedBy: decidedBy,
      approvedAt: decidedAt,
      comment: `${record.historyLabel}: ${reason}`,
    },
  ];
  await ctx.db.patch(accession._id, {
    status: withdrawn ? "withdrawn" : "pending",
    workflowStep: withdrawn ? undefined : 0,
    reviewDecision: { decision, reason, decidedBy, decidedAt, fromStep },
    // An exception authorizes approval within one review round, which ends
    // here; the audit log keeps the authorization.
    sourceVerificationException: undefined,
    ...(await appendCaseHistory(ctx, accession, "accession", history)),
  });

  const submitterId = getWorkflowCreatorRecipient(
    accession.workflowHistory,
    decidedBy,
  );
  await Promise.all([
    syncAccessionSearchDocument(ctx, accession._id),
    ctx.runMutation(internal.workflows.recordWorkflowHistory, {
      organizationId: accession.organizationId,
      workflowType: "accession",
      entityId: accession._id,
      fromStep,
      toStep: withdrawn ? fromStep : 0,
      action: record.workflowAction,
      performedBy: decidedBy,
      comment: reason,
      metadata: { decision },
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId: decidedBy,
      action: decision,
      entityType: "accession",
      entityId: accession._id,
      changes: {
        accessionNumber: accession.accessionNumber,
        status: withdrawn ? "withdrawn" : "pending",
        fromStep,
        reason,
      },
    }),
    submitterId
      ? dispatchNotification(ctx, {
          organizationId: accession.organizationId,
          type: record.notificationType,
          recipients: [submitterId],
          title: record.notificationTitle,
          message: `${record.notificationMessage(accession.accessionNumber)} Reason: ${reason}`,
          related: { entityType: "accession", entityId: accession._id },
        })
      : null,
  ]);
}

/**
 * Reviewer rejection of an intake under review. Either returns it to Draft
 * for the submitter to edit and resubmit, or withdraws it: the record, draft
 * data and media are retained and restorable. Neither publishes an object or
 * records a deaccession; nothing was accessioned.
 */
export const reject = mutation({
  args: {
    accessionId: v.id("accessions"),
    decision: v.union(v.literal("returnToDraft"), v.literal("withdraw")),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (!isAwaitingReview(accession)) {
      throw accessionReviewError(
        "NOT_IN_REVIEW",
        "Accession is not awaiting review",
      );
    }
    const currentStep = await requireIntakeReviewer(
      ctx,
      accession.organizationId,
      accession.workflowStep,
    );
    const reason = requireReviewReason(args.reason);

    const fromStep = accession.workflowStep ?? currentStep ?? 0;
    await Promise.all([
      recordIntakeReviewDecision(ctx, accession, {
        decision:
          args.decision === "withdraw" ? "withdrawn" : "returned_to_draft",
        reason,
        decidedBy: userId,
        fromStep,
      }),
      // Partial approvals at this step must not count after resubmission.
      ctx.runMutation(internal.workflows.clearStepApprovals, {
        workflowType: "accession",
        entityId: args.accessionId,
        stepNumber: fromStep,
      }),
    ]);

    return null;
  },
});

/** Returns a withdrawn intake to Draft so it can be edited and resubmitted. */
export const restoreWithdrawn = mutation({
  args: {
    accessionId: v.id("accessions"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "withdrawn") {
      throw accessionReviewError(
        "NOT_WITHDRAWN",
        "Only a withdrawn accession can be restored",
      );
    }
    const withdrawnFromStep = accession.reviewDecision?.fromStep;
    await requireIntakeReviewer(
      ctx,
      accession.organizationId,
      withdrawnFromStep,
    );
    const reason = requireReviewReason(args.reason);
    await assertEntryAcquisitionRestorable(ctx, accession);

    await recordIntakeReviewDecision(ctx, accession, {
      decision: "restored",
      reason,
      decidedBy: userId,
      fromStep: withdrawnFromStep ?? 0,
    });

    return null;
  },
});

export const emptyRejected = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.delete"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return rejectPermanentEvidenceDeletion();
  },
});

/**
 * Get workflow history
 */
export const getWorkflowHistory = query({
  args: {
    accessionId: v.id("accessions"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: workflowHistoryPageValidator,
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(ctx, accession.organizationId, "collections.read");

    return await readWorkflowHistoryPage(ctx, {
      organizationId: accession.organizationId,
      caseType: "accession",
      entityId: args.accessionId,
      cursor: args.cursor,
      limit: args.limit,
    });
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

    if (accession.entryId && accession.collectionId) {
      if (!accession.approvedBy) {
        throw new Error("Accession must be approved before publish");
      }
      await completeEntryAccession(ctx, accession, accession.approvedBy);
      await syncAccessionSearchDocument(ctx, args.accessionId);
      return accession.collectionId;
    }

    if (accession.collectionId) {
      // Collection already created
      return accession.collectionId;
    }

    if (!accession.approvedBy) {
      throw new Error("Accession must be approved before publish");
    }

    const catalogedBy = accession.approvedBy;

    const catalogedAt = accession.approvedAt ?? Date.now();
    const collectionId = await publishAccessionObjectDraft(ctx, {
      accession,
      catalogedBy,
      catalogedAt,
      status: "active",
    });

    await Promise.all([
      ctx.db.patch(args.accessionId, {
        collectionId,
      }),
      syncAccessionSearchDocument(ctx, args.accessionId),
    ]);

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
    requireSourceVerification: v.boolean(),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        name: v.string(),
        roleName: v.optional(v.string()),
        approvalMode: v.optional(
          v.union(
            v.literal("single"),
            v.literal("multi"),
            v.literal("unanimous"),
          ),
        ),
        requiredApprovals: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const workflowConfig = await getWorkflowConfig(
      ctx,
      args.organizationId,
      "accession",
    );

    if (!workflowConfig) {
      return {
        hasWorkflow: false,
        requireSourceVerification: false,
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
          approvalMode: step.approvalMode,
          requiredApprovals: step.requiredApprovals,
        };
      }),
    );

    const normalizedSteps = [
      { stepNumber: 0, name: "Draft" },
      ...stepsWithRoles,
      { stepNumber: -1, name: "Approved" },
    ].filter(
      (step, index, steps) =>
        steps.findIndex(
          (candidate) => candidate.stepNumber === step.stepNumber,
        ) === index,
    );

    return {
      hasWorkflow: true,
      requireSourceVerification:
        workflowConfig.requireSourceVerification ?? false,
      steps: normalizedSteps,
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
    await Promise.all([
      requirePermission(ctx, accession.organizationId, "collections.update"),
      ctx.db.patch(args.accessionId, {
        assignedTo: args.userId,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId: currentUserId,
        action: "updated",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { assignedTo: args.userId },
      }),
    ] as const);

    // Send notification to assignee if different from current user
    if (args.userId !== currentUserId) {
      const assigningUser = await ctx.db.get(currentUserId);
      const assignedByName =
        assigningUser?.name ?? assigningUser?.email ?? "A team member";
      await dispatchNotification(ctx, {
        organizationId: accession.organizationId,
        type: "task_assigned",
        recipients: [args.userId],
        title: "Accession Assigned",
        message: `You have been assigned to accession: ${accession.accessionNumber}`,
        related: { entityType: "accession", entityId: args.accessionId },
        email: {
          kind: "taskAssigned",
          taskTitle: `Accession ${accession.accessionNumber}`,
          assignedBy: assignedByName,
        },
      });
    }

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
    await Promise.all([
      requirePermission(ctx, accession.organizationId, "collections.update"),
      ctx.db.patch(args.accessionId, {
        assignedTo: undefined,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId: currentUserId,
        action: "updated",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { assignedTo: null },
      }),
    ] as const);

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
      status: accessionStatusValidator,
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

    return accessions.flatMap((accession) =>
      accession.organizationId === args.organizationId
        ? [
            {
              _id: accession._id,
              accessionNumber: accession.accessionNumber,
              source: accession.source,
              status: accession.status,
              workflowStep: accession.workflowStep,
              dateReceived: accession.dateReceived,
            },
          ]
        : [],
    );
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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }
    await Promise.all([
      requirePermission(ctx, accession.organizationId, "collections.update"),
      ctx.db.patch(args.accessionId, {
        sourceVerified: true,
        sourceVerifiedBy: userId,
        sourceVerifiedAt: Date.now(),
        sourceVerificationNotes: args.verificationNotes,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId,
        action: "source_verified",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { sourceVerified: true },
      }),
    ] as const);

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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }
    await Promise.all([
      requirePermission(ctx, accession.organizationId, "collections.update"),
      ctx.db.patch(args.accessionId, {
        sourceVerified: false,
        sourceVerificationNotes: `Unverified: ${args.reason}`,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId,
        action: "source_unverified",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { reason: args.reason },
      }),
    ] as const);

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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    // Get workflow config to determine required documents
    const workflowConfig = await getWorkflowConfig(
      ctx,
      accession.organizationId,
      "accession",
    );

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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );
    await claimStorageOwnership(ctx, {
      storageId: args.storageId,
      organizationId: accession.organizationId,
      uploadedBy: userId,
      ownerType: "accessionDocument",
      ownerId: `${args.accessionId}:${args.documentType}`,
    });

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

    await Promise.all([
      ctx.db.patch(args.accessionId, {
        documentChecklist: updatedChecklist,
        documents,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId,
        action: "document_uploaded",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { documentType: args.documentType },
      }),
    ]);

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
    const [userId, accession] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.accessionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    return rejectPermanentEvidenceDeletion();
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

    // Batch fetch uploader users to avoid N+1 queries
    const uploaderIds = checklist.flatMap((item) =>
      item.uploadedBy === undefined ? [] : [item.uploadedBy],
    );
    const [uploaderMap, storageUrls] = await Promise.all([
      batchLookup(ctx, uploaderIds, "users"),
      Promise.all(
        checklist.map((item) =>
          item.storageId
            ? ctx.storage.getUrl(item.storageId)
            : Promise.resolve(null),
        ),
      ),
    ] as const);

    // Fetch storage URLs in parallel
    // Enrich with uploader names and URLs using batch lookup map
    const enrichedChecklist = checklist.map((item, index) => {
      let uploaderName: string | undefined;
      if (item.uploadedBy) {
        const user = uploaderMap.get(item.uploadedBy);
        uploaderName = user?.name || user?.email || undefined;
      }

      const url = storageUrls[index] ?? undefined;

      return {
        ...item,
        uploaderName,
        url,
      };
    });

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

    // Fetch all accessions first
    const accessions = await Promise.all(
      args.accessionIds.map((id) => ctx.db.get(id)),
    );

    // Filter out null accessions and check permissions
    const validAccessions: Doc<"accessions">[] = [];
    await Promise.all(
      Array.from(accessions).map(async (accession) => {
        if (accession) {
          await requirePermission(
            ctx,
            accession.organizationId,
            "collections.read",
          );
          validAccessions.push(accession);
        }
      }),
    );

    // Batch fetch collections to avoid N+1 queries
    const collectionIds = validAccessions.flatMap((accession) =>
      accession.collectionId ? [accession.collectionId] : [],
    );
    const collectionMap = await batchLookup(ctx, collectionIds, "collections");

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

    await Promise.all(
      Array.from(validAccessions).map(async (accession) => {
        // Get collection info using batch lookup map
        let collectionTitle: string | undefined;
        let collectionAccessionNumber: string | undefined;
        if (accession.collectionId) {
          const collection = collectionMap.get(accession.collectionId);
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
          assignedToName = assignee?.name ?? assignee?.email;
        }

        // Get approver name
        let approvedByName: string | undefined;
        if (accession.approvedBy) {
          const approver = await ctx.db.get(accession.approvedBy);
          approvedByName = approver?.name ?? approver?.email;
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
      }),
    );

    return results;
  },
});
