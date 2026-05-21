import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { getNextCounterValue } from "./utils/accessionCounter";
import { accessionParser } from "./utils/accessionNumberParser";
import { publishAccessionObjectDraft } from "./utils/accessionObjectDraftPublication";
import { batchLookup } from "./utils/batchLookup";
import { markCollectionDeaccessioned } from "./utils/collectionLifecycle";
import { enforceMediaQuota } from "./utils/featureGates";
import { getWorkflowCreatorRecipient } from "./utils/notificationRecipients";
import {
  accessionDraftMediaValidator,
  objectDraftDataValidator,
} from "./utils/objectDraftData";
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

const REJECTED_OBJECT_DISPLAY_STATUS = "REJECTED";

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

async function isAccessionWorkflowEnabled(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  return organization?.settings?.accessionWorkflowEnabled ?? true;
}

function buildSearchText(values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => {
      const trimmedValue = value?.trim();
      return trimmedValue ? [trimmedValue] : [];
    })
    .join(" ");
}

async function buildAccessionSearchText(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
) {
  const collection = accession.collectionId
    ? await ctx.db.get(accession.collectionId)
    : null;

  return buildSearchText([
    accession.accessionNumber,
    accession.draftObjectData?.title,
    accession.source,
    accession.notes,
    collection?.title,
    accession.method,
  ]);
}

async function upsertAccessionSearchDocument(
  ctx: MutationCtx,
  accession: Doc<"accessions">,
) {
  const [searchText, existing] = await Promise.all([
    buildAccessionSearchText(ctx, accession),
    ctx.db
      .query("accessionSearchDocuments")
      .withIndex("by_accession", (q) => q.eq("accessionId", accession._id))
      .first(),
  ] as const);
  const fields = {
    organizationId: accession.organizationId,
    accessionId: accession._id,
    status: accession.status,
    searchText,
    dateReceived: accession.dateReceived,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return;
  }

  await ctx.db.insert("accessionSearchDocuments", fields);
}

async function syncAccessionSearchDocument(
  ctx: MutationCtx,
  accessionId: Id<"accessions">,
) {
  const accession = await ctx.db.get(accessionId);
  if (accession) {
    await upsertAccessionSearchDocument(ctx, accession);
  }
}

async function deleteAccessionSearchDocument(
  ctx: MutationCtx,
  accessionId: Id<"accessions">,
) {
  const existing = await ctx.db
    .query("accessionSearchDocuments")
    .withIndex("by_accession", (q) => q.eq("accessionId", accessionId))
    .first();

  if (existing) {
    await ctx.db.delete(existing._id);
  }
}

async function ensureAccessionNumberAvailable(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  accessionNumber: string,
  existingAccessionId?: Id<"accessions">,
) {
  const existingAccession = await ctx.db
    .query("accessions")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("accessionNumber"), accessionNumber))
    .first();

  if (existingAccession && existingAccession._id !== existingAccessionId) {
    throw new Error("Accession number already exists");
  }

  const existingCollection = await ctx.db
    .query("collections")
    .withIndex("by_organization_and_accessionNumber", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("accessionNumber", accessionNumber),
    )
    .first();

  if (existingCollection) {
    throw new Error("Accession number already exists");
  }
}

async function generateUniqueAccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  let lastGeneratedAccessionNumber: string | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextAccessionNumber = await generateAccessionNumber(
      ctx,
      organizationId,
    );
    lastGeneratedAccessionNumber = nextAccessionNumber;
    try {
      await ensureAccessionNumberAvailable(
        ctx,
        organizationId,
        nextAccessionNumber,
      );
      return nextAccessionNumber;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "Accession number already exists"
      ) {
        throw error;
      }
    }
  }

  const fallbackBase =
    lastGeneratedAccessionNumber || `ACC-${new Date().getFullYear()}`;

  for (let suffixAttempt = 1; suffixAttempt <= 20; suffixAttempt += 1) {
    const fallbackAccessionNumber = `${fallbackBase}-${suffixAttempt}`;
    try {
      await ensureAccessionNumberAvailable(
        ctx,
        organizationId,
        fallbackAccessionNumber,
      );
      return fallbackAccessionNumber;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "Accession number already exists"
      ) {
        throw error;
      }
    }
  }

  throw new Error("Could not generate a unique accession number");
}

async function findReusablePendingDraftAccession(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  accessionNumber: string,
) {
  const candidate = await ctx.db
    .query("accessions")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("accessionNumber"), accessionNumber),
        q.eq(q.field("status"), "pending"),
      ),
    )
    .first();

  if (!candidate || candidate.collectionId) {
    return null;
  }

  return candidate;
}

/**
 * Generate accession number based on organization format template
 */
async function generateAccessionNumber(
  ctx: MutationCtx,
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

    // Generate or use provided accession number
    let accessionNumber: string;
    if (args.accessionNumber) {
      accessionNumber = args.accessionNumber;
    } else {
      accessionNumber = await generateAccessionNumber(ctx, args.organizationId);
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
      await Promise.all(
        Array.from(usersToNotify).map(async (approverId) => {
          if (approverId !== userId) {
            // Don't notify the creator
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: args.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "New Accession Requires Approval",
              message: `Accession ${accessionNumber} is pending your approval at step ${workflowState.firstStep ?? 1}.`,
              relatedEntityType: "accession",
              relatedEntityId: accessionId,
            });
          }
        }),
      );
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "media.upload");
    await enforceMediaQuota(ctx, args.organizationId, args.fileSize);

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
});

export const upsertObjectDraft = mutation({
  args: {
    organizationId: v.id("organizations"),
    accessionId: v.optional(v.id("accessions")),
    saveMode: v.union(v.literal("draft"), v.literal("submit")),
    objectData: objectDraftDataValidator,
    draftMedia: v.optional(v.array(accessionDraftMediaValidator)),
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
    const workflowConfig = accessionWorkflowEnabled
      ? await getWorkflowConfig(ctx, args.organizationId, "accession")
      : null;

    const normalizedObjectData = {
      ...args.objectData,
      title: args.objectData.title.trim(),
    };

    if (normalizedObjectData.title.length === 0) {
      throw new Error("Title is required");
    }

    if (args.saveMode === "submit" && accessionWorkflowEnabled) {
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
      throw new Error("Workflow has no approval steps configured");
    }

    const nextWorkflowStep =
      args.saveMode === "submit" && workflowConfig
        ? workflowState.firstStep ?? 1
        : 0;
    const shouldAutoApproveSubmit =
      args.saveMode === "submit" && !workflowConfig;

    if (args.accessionId) {
      const existing = await ctx.db.get(args.accessionId);
      if (!existing) {
        throw new Error("Accession not found");
      }
      if (existing.organizationId !== args.organizationId) {
        throw new Error("Accession does not belong to this organization");
      }
      if (existing.status !== "pending") {
        throw new Error("Only pending accessions can be updated");
      }

      await requirePermission(ctx, args.organizationId, "collections.update");

      const updatedWorkflowStep = shouldAutoApproveSubmit
        ? undefined
        : existing.workflowStep && existing.workflowStep > 0
          ? existing.workflowStep
          : nextWorkflowStep;

      const accessionNumber =
        normalizedObjectData.accessionNumber?.trim() ||
        existing.accessionNumber;

      await ensureAccessionNumberAvailable(
        ctx,
        args.organizationId,
        accessionNumber,
        existing._id,
      );

      const submittedAt = Date.now();
      await Promise.all([
        ctx.db.patch(existing._id, {
          accessionNumber,
          source,
          notes: normalizedObjectData.description?.trim() || existing.notes,
          status: shouldAutoApproveSubmit ? "approved" : existing.status,
          approvedBy: shouldAutoApproveSubmit ? userId : existing.approvedBy,
          approvedAt: shouldAutoApproveSubmit
            ? submittedAt
            : existing.approvedAt,
          workflowStep: updatedWorkflowStep,
          draftObjectData: {
            ...normalizedObjectData,
            accessionNumber,
          },
          draftMedia: args.draftMedia ?? existing.draftMedia,
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
        await ctx.runMutation(
          internal.accessions.createCollectionFromAccession,
          {
            accessionId: existing._id,
          },
        );
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

        await Promise.all(
          Array.from(usersToNotify).map(async (approverId) => {
            if (approverId !== userId) {
              await ctx.runMutation(internal.audit.createNotificationInternal, {
                organizationId: args.organizationId,
                userId: approverId,
                type: "workflow_pending",
                title: "Object Request Requires Approval",
                message: `Object request ${accessionNumber} is pending your approval.`,
                relatedEntityType: "accession",
                relatedEntityId: existing._id,
              });
            }
          }),
        );
      }

      return existing._id;
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    let accessionNumber = normalizedObjectData.accessionNumber?.trim();
    if (!accessionNumber) {
      accessionNumber = await generateUniqueAccessionNumber(
        ctx,
        args.organizationId,
      );
    }

    const reusableDraft = await findReusablePendingDraftAccession(
      ctx,
      args.organizationId,
      accessionNumber,
    );

    if (reusableDraft) {
      const submittedAt = Date.now();
      await Promise.all([
        ctx.db.patch(reusableDraft._id, {
          source,
          notes:
            normalizedObjectData.description?.trim() || reusableDraft.notes,
          status: shouldAutoApproveSubmit ? "approved" : reusableDraft.status,
          approvedBy: shouldAutoApproveSubmit
            ? userId
            : reusableDraft.approvedBy,
          approvedAt: shouldAutoApproveSubmit
            ? submittedAt
            : reusableDraft.approvedAt,
          workflowStep: shouldAutoApproveSubmit ? undefined : nextWorkflowStep,
          draftObjectData: {
            ...normalizedObjectData,
            accessionNumber,
          },
          draftMedia: args.draftMedia ?? reusableDraft.draftMedia,
        }),
        syncAccessionSearchDocument(ctx, reusableDraft._id),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: args.organizationId,
          userId,
          action:
            args.saveMode === "submit"
              ? "submitted_object_accession"
              : "saved_object_draft",
          entityType: "accession",
          entityId: reusableDraft._id,
          changes: {
            accessionNumber,
            saveMode: args.saveMode,
            workflowStep: shouldAutoApproveSubmit
              ? undefined
              : nextWorkflowStep,
            status: shouldAutoApproveSubmit ? "approved" : reusableDraft.status,
            title: normalizedObjectData.title,
            recoveredDraft: true,
          },
        }),
      ] as const);

      if (shouldAutoApproveSubmit) {
        await ctx.runMutation(
          internal.accessions.createCollectionFromAccession,
          {
            accessionId: reusableDraft._id,
          },
        );
      }

      if (args.saveMode === "submit" && workflowConfig) {
        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          args.organizationId,
          "accession",
          nextWorkflowStep,
        );

        await Promise.all(
          Array.from(usersToNotify).map(async (approverId) => {
            if (approverId !== userId) {
              await ctx.runMutation(internal.audit.createNotificationInternal, {
                organizationId: args.organizationId,
                userId: approverId,
                type: "workflow_pending",
                title: "Object Request Requires Approval",
                message: `Object request ${accessionNumber} is pending your approval.`,
                relatedEntityType: "accession",
                relatedEntityId: reusableDraft._id,
              });
            }
          }),
        );
      }

      return reusableDraft._id;
    }

    try {
      await ensureAccessionNumberAvailable(
        ctx,
        args.organizationId,
        accessionNumber,
      );
    } catch (error) {
      if (
        normalizedObjectData.accessionNumber?.trim() &&
        error instanceof Error &&
        error.message === "Accession number already exists"
      ) {
        accessionNumber = await generateUniqueAccessionNumber(
          ctx,
          args.organizationId,
        );
      } else {
        throw error;
      }
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

    const accessionId = await ctx.db.insert("accessions", {
      organizationId: args.organizationId,
      accessionNumber,
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
      draftMedia: args.draftMedia,
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
      await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
        accessionId,
      });
    }

    if (args.saveMode === "submit" && workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "accession",
        nextWorkflowStep,
      );

      await Promise.all(
        Array.from(usersToNotify).map(async (approverId) => {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: args.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Object Request Requires Approval",
              message: `Object request ${accessionNumber} is pending your approval.`,
              relatedEntityType: "accession",
              relatedEntityId: accessionId,
            });
          }
        }),
      );
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
        draftTitle: v.optional(v.string()),
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

    const search = args.search?.trim();

    const addAssigneeNames = async (page: Doc<"accessions">[]) => {
      const assigneeIds = page.flatMap((item) =>
        item.assignedTo ? [item.assignedTo] : [],
      );
      const usersMap = await batchLookup(ctx, assigneeIds, "users");

      return page.map((item) => {
        let assigneeName: string | undefined;
        if (item.assignedTo) {
          const user = usersMap.get(item.assignedTo);
          assigneeName = user?.name || user?.email || undefined;
        }

        return {
          _id: item._id,
          accessionNumber: item.accessionNumber,
          dateReceived: item.dateReceived,
          source: item.source,
          draftTitle: item.draftObjectData?.title,
          method: item.method,
          status: item.status,
          workflowStep: item.workflowStep,
          assignedTo: item.assignedTo,
          assigneeName,
        };
      });
    };

    if (!search) {
      if (args.status) {
        const status = args.status;
        const paginationResult = await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_status_and_dateReceived", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", status),
          )
          .order("desc")
          .paginate(args.paginationOpts);

        return {
          page: await addAssigneeNames(paginationResult.page),
          isDone: paginationResult.isDone,
          continueCursor: paginationResult.continueCursor,
        };
      }

      const paginationResult = await ctx.db
        .query("accessions")
        .withIndex("by_organization_and_dateReceived", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .paginate(args.paginationOpts);

      return {
        page: await addAssigneeNames(paginationResult.page),
        isDone: paginationResult.isDone,
        continueCursor: paginationResult.continueCursor,
      };
    }

    const hasSearchDocuments = await ctx.db
      .query("accessionSearchDocuments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (hasSearchDocuments) {
      const paginationResult = args.status
        ? await (() => {
            const status = args.status;
            return ctx.db
              .query("accessionSearchDocuments")
              .withSearchIndex("search_text", (q) =>
                q
                  .search("searchText", search)
                  .eq("organizationId", args.organizationId)
                  .eq("status", status),
              )
              .paginate(args.paginationOpts);
          })()
        : await ctx.db
            .query("accessionSearchDocuments")
            .withSearchIndex("search_text", (q) =>
              q
                .search("searchText", search)
                .eq("organizationId", args.organizationId),
            )
            .paginate(args.paginationOpts);

      const accessionsMap = await batchLookup(
        ctx,
        paginationResult.page.map(
          (searchDocument) => searchDocument.accessionId,
        ),
        "accessions",
      );
      const page = paginationResult.page.flatMap((searchDocument) => {
        const accession = accessionsMap.get(searchDocument.accessionId);
        return accession ? [accession] : [];
      });

      return {
        page: await addAssigneeNames(page),
        isDone: paginationResult.isDone,
        continueCursor: paginationResult.continueCursor,
      };
    }

    let allResults: Doc<"accessions">[];
    if (args.status) {
      const status = args.status;
      allResults = await ctx.db
        .query("accessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", status),
        )
        .collect();
    } else {
      allResults = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
    }

    const searchLower = search.toLowerCase();
    // Batch fetch collections to avoid N+1 queries
    const collectionIds = allResults.flatMap((accession) =>
      accession.collectionId ? [accession.collectionId] : [],
    );
    const collectionMap = await batchLookup(ctx, collectionIds, "collections");

    // Get collection titles for accessions to include in search
    const accessionsWithCollectionInfo = allResults.map((accession) => {
      const collectionTitle = accession.collectionId
        ? collectionMap.get(accession.collectionId)?.title || ""
        : "";
      return { ...accession, collectionTitle };
    });

    allResults = accessionsWithCollectionInfo.flatMap(
      ({ collectionTitle, ...accession }) =>
        accession.accessionNumber?.toLowerCase().includes(searchLower) ||
        accession.draftObjectData?.title?.toLowerCase().includes(searchLower) ||
        accession.source?.toLowerCase().includes(searchLower) ||
        accession.notes?.toLowerCase().includes(searchLower) ||
        collectionTitle?.toLowerCase().includes(searchLower) ||
        accession.method?.toLowerCase().includes(searchLower)
          ? [accession]
          : [],
    );

    // Sort by date received (newest first)
    allResults.sort((a, b) => b.dateReceived - a.dateReceived);

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

    return {
      page: await addAssigneeNames(page),
      isDone: endIndex >= allResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const backfillSearchDocuments = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    updatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const accessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    await Promise.all(
      Array.from(accessions).map(async (accession) => {
        await upsertAccessionSearchDocument(ctx, accession);
      }),
    );

    return { updatedCount: accessions.length };
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
      sourceVerified: v.optional(v.boolean()),
      sourceVerificationNotes: v.optional(v.string()),
      canCurrentUserApprove: v.boolean(),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      notes: v.optional(v.string()),
      workflowStep: v.optional(v.number()),
      draftObjectData: v.optional(objectDraftDataValidator),
      draftMedia: v.optional(v.array(accessionDraftMediaWithUrlValidator)),
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

    let canCurrentUserApprove = false;
    if (accession.status === "pending" && accession.workflowStep !== 0) {
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

    // Ensure workflowHistory is always an array (even if empty)
    const workflowHistory = accession.workflowHistory ?? [];
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
      dateReceived: accession.dateReceived,
      source: accession.source,
      method: accession.method,
      cost: accession.cost,
      sourceVerified: accession.sourceVerified,
      sourceVerificationNotes: accession.sourceVerificationNotes,
      canCurrentUserApprove,
      approvedBy: accession.approvedBy,
      approvedAt: accession.approvedAt,
      status: accession.status,
      notes: accession.notes,
      workflowStep: accession.workflowStep,
      draftObjectData: accession.draftObjectData,
      draftMedia,
      workflowHistory,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
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
      throw new Error("Workflow has no approval steps configured");
    }

    // Reset workflow step if needed
    await ctx.db.patch(args.accessionId, {
      workflowStep: firstApprovalStep ?? 1,
    });

    return null;
  },
});

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

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.approve_accession",
    );

    const workflowConfig = await getWorkflowConfig(
      ctx,
      accession.organizationId,
      "accession",
    );

    if (workflowConfig) {
      const workflowState = resolveWorkflowStepState(
        workflowConfig.steps,
        accession.workflowStep,
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
        accession.organizationId,
        "accession",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      if (
        workflowConfig.requireSourceVerification &&
        !accession.draftObjectData &&
        !accession.sourceVerified
      ) {
        throw new Error("Source verification is required before approval");
      }

      const currentStepConfig = workflowConfig.steps.find(
        (s) => s.stepNumber === currentStep,
      );
      if (!currentStepConfig) {
        throw new Error("Current workflow step is not configured");
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

      const history = accession.workflowHistory ?? [];
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
            workflowHistory: history,
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

        await ctx.runMutation(
          internal.accessions.createCollectionFromAccession,
          {
            accessionId: args.accessionId,
          },
        );
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
          workflowHistory: history,
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
      await Promise.all([
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
      ]);
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", accession.organizationId),
        )
        .collect();

      await Promise.all(
        Array.from(userOrgs).map(async (userOrg) => {
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
        }),
      );

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

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.approve_accession",
    );

    await Promise.all([
      ctx.db.patch(args.accessionId, {
        status: "rejected",
        workflowStep: -2,
        approvedBy: userId,
        approvedAt: Date.now(),
        notes: args.comment
          ? `${accession.notes || ""}\nRejected: ${args.comment}`.trim()
          : accession.notes,
      }),
      syncAccessionSearchDocument(ctx, args.accessionId),
    ]);
    const collectionId = await ctx.runMutation(
      internal.accessions.createCollectionFromRejectedAccession,
      {
        accessionId: args.accessionId,
        rejectedBy: userId,
      },
    );

    await ctx.runMutation(internal.deaccessions.createRejectedFromAccession, {
      organizationId: accession.organizationId,
      collectionId,
      createdByUserId: userId,
      accessionNumber: accession.accessionNumber,
      comment: args.comment,
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

export const emptyRejected = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.delete");

    const rejectedAccessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("status"), "rejected"))
      .collect();

    let deletedCount = 0;

    await Promise.all(
      Array.from(rejectedAccessions).map(async (accession) => {
        if (accession.collectionId) {
          return;
        }

        const storageIds = new Set<Id<"_storage">>();

        for (const storageId of accession.documents || []) {
          storageIds.add(storageId);
        }

        for (const mediaItem of accession.draftMedia || []) {
          storageIds.add(mediaItem.storageId);
        }

        for (const checklistItem of accession.documentChecklist || []) {
          if (checklistItem.storageId) {
            storageIds.add(checklistItem.storageId);
          }
        }
        await Promise.all([
          Promise.all(
            Array.from(storageIds).map(async (storageId) => {
              await ctx.storage.delete(storageId);
            }),
          ),
          ctx.db.delete(accession._id),
          deleteAccessionSearchDocument(ctx, accession._id),
        ] as const);
        deletedCount += 1;
      }),
    );

    return { deletedCount };
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

    // Batch fetch approver users to avoid N+1 queries
    const approverIds = history.map((item) => item.approvedBy);
    const approverMap = await batchLookup(ctx, approverIds, "users");

    // Enrich with approver names using batch lookup map
    const enrichedHistory = history.map((item) => {
      const approver = approverMap.get(item.approvedBy);
      return {
        ...item,
        approverName: approver?.name || approver?.email || undefined,
      };
    });

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

    const firstUser = await ctx.db.query("users").first();
    const catalogedBy = accession.approvedBy ?? firstUser?._id;
    if (!catalogedBy) {
      throw new Error("Could not determine cataloging user");
    }

    const catalogedAt = accession.approvedAt ?? Date.now();
    const collectionId = await publishAccessionObjectDraft(ctx, {
      accession,
      catalogedBy,
      catalogedAt,
      status: "active",
    });

    await ctx.db.patch(args.accessionId, {
      collectionId,
    });
    await syncAccessionSearchDocument(ctx, args.accessionId);

    return collectionId;
  },
});

export const createCollectionFromRejectedAccession = internalMutation({
  args: {
    accessionId: v.id("accessions"),
    rejectedBy: v.id("users"),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "rejected") {
      throw new Error("Accession must be rejected");
    }

    const rejectedAt = accession.approvedAt ?? Date.now();

    if (accession.collectionId) {
      await markCollectionDeaccessioned(ctx, {
        collectionId: accession.collectionId,
        changedBy: args.rejectedBy,
        changedAt: rejectedAt,
        displayStatus: REJECTED_OBJECT_DISPLAY_STATUS,
      });
      await syncAccessionSearchDocument(ctx, args.accessionId);
      return accession.collectionId;
    }

    const collectionId = await publishAccessionObjectDraft(ctx, {
      accession,
      catalogedBy: args.rejectedBy,
      catalogedAt: rejectedAt,
      status: "deaccessioned",
      displayStatus: REJECTED_OBJECT_DISPLAY_STATUS,
    });

    await ctx.db.patch(args.accessionId, {
      collectionId,
    });
    await syncAccessionSearchDocument(ctx, args.accessionId);

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
      // Get user who is assigning
      const assigningUser = await ctx.db.get(currentUserId);
      const assignedByName =
        assigningUser?.name ?? assigningUser?.email ?? "A team member";

      // Get organization for building deep link
      const org = await ctx.db.get(accession.organizationId);
      const siteUrl = process.env.SITE_URL;
      const taskUrl =
        org && siteUrl
          ? `${siteUrl}/${org.slug}/accessions/${args.accessionId}`
          : undefined;

      await ctx.runMutation(internal.notifications.sendNotification, {
        organizationId: accession.organizationId,
        userId: args.userId,
        type: "task_assigned",
        title: "Accession Assigned",
        message: `You have been assigned to accession: ${accession.accessionNumber}`,
        relatedEntityType: "accession",
        relatedEntityId: args.accessionId,
        emailData: {
          taskTitle: `Accession ${accession.accessionNumber}`,
          assignedBy: assignedByName,
          taskUrl,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
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
        accessionNumber: accessionNumber || "[Auto-generated]",
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

    const accessionWorkflowEnabled = await isAccessionWorkflowEnabled(
      ctx,
      args.organizationId,
    );
    const workflowConfig = accessionWorkflowEnabled
      ? await getWorkflowConfig(ctx, args.organizationId, "accession")
      : null;

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

        await syncAccessionSearchDocument(ctx, accessionId);

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
