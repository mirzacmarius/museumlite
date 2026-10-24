import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { batchLookup } from "./utils/batchLookup";
import { CAPABILITY_MATRIX } from "./utils/capabilities";
import { displayName } from "./utils/caseTaskRules";
import { syncCollectionOptionUsages } from "./utils/collectionOptionUsages";
import { conditionAssessmentError } from "./utils/conditionAssessmentErrors";
import {
  type ConditionAssessmentStatus,
  conditionAssessmentStatusValidator,
  MAX_REJECTION_REASON_LENGTH,
  OPEN_CONDITION_ASSESSMENT_STATUSES,
} from "./utils/conditionAssessmentStatus";
import { mutation } from "./utils/mutationBuilders";
import {
  getUserPermissions,
  hasPermission,
  requireCapability,
  requirePermission,
} from "./utils/permissions";
import type { ColumnPage } from "./utils/workBoardColumns";

const observation = v.object({
  area: v.string(),
  description: v.string(),
  severity: v.union(
    v.literal("minor"),
    v.literal("moderate"),
    v.literal("severe"),
  ),
});

/** What staff record in an assessment, whether new or an edited draft. */
const assessmentContent = {
  assessedAt: v.number(),
  condition: v.string(),
  summary: v.string(),
  observations: v.array(observation),
  photos: v.array(v.id("mediaFiles")),
};

/** Board totals stop here and read "999+", so a count never scans a log. */
export const BOARD_COUNT_LIMIT = 999;
const BOARD_PERMISSIONS = CAPABILITY_MATRIX.condition_assessments.permissions;
const REVIEW_PERMISSION = "collections.accept_condition";

function requiredText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

async function validatedContent(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  input: {
    assessedAt: number;
    condition: string;
    summary: string;
    observations: Infer<typeof observation>[];
    photos: Id<"mediaFiles">[];
  },
) {
  if (!Number.isFinite(input.assessedAt) || input.assessedAt > Date.now()) {
    throw new Error(
      "Assessment date must be valid and cannot be in the future",
    );
  }
  if (input.observations.length > 100 || input.photos.length > 20) {
    throw new Error("Assessment has too many observations or photos");
  }
  const observations = input.observations.map((item) => ({
    area: requiredText(item.area, "Observation area"),
    description: requiredText(item.description, "Observation description"),
    severity: item.severity,
  }));
  const photos: Doc<"conditionAssessments">["photos"] = [];
  for (const photoId of new Set(input.photos)) {
    const photo = await ctx.db.get(photoId);
    if (
      !photo ||
      photo.collectionId !== collectionId ||
      photo.fileType !== "image" ||
      photo.uploadStatus !== "completed" ||
      !(await ctx.db.system.get(photo.storageId))
    ) {
      throw conditionAssessmentError(
        "ASSESSMENT_PHOTO_UNAVAILABLE",
        "Assessment photo must belong to this object",
      );
    }
    photos.push({
      mediaId: photoId,
      storageId: photo.storageId,
      fileName: photo.fileName,
    });
  }
  return {
    assessedAt: input.assessedAt,
    condition: requiredText(input.condition, "Condition"),
    summary: requiredText(input.summary, "Summary"),
    observations,
    photos,
  };
}

/**
 * The object's newest draft or submitted assessment. Records from before
 * drafts were kept apart from submissions can leave several drafts; staff
 * finish them one at a time.
 */
async function findOpenAssessment(
  ctx: QueryCtx,
  collectionId: Id<"collections">,
) {
  const newestPerStatus = await Promise.all(
    OPEN_CONDITION_ASSESSMENT_STATUSES.map((status) =>
      ctx.db
        .query("conditionAssessments")
        .withIndex("by_collection_and_status_and_acceptedAt", (q) =>
          q.eq("collectionId", collectionId).eq("status", status),
        )
        .order("desc")
        .first(),
    ),
  );
  let newest: Doc<"conditionAssessments"> | null = null;
  for (const candidate of newestPerStatus) {
    if (
      candidate &&
      (!newest || candidate._creationTime > newest._creationTime)
    ) {
      newest = candidate;
    }
  }
  return newest;
}

type AssessmentAction =
  | "created_condition_assessment"
  | "updated_condition_assessment"
  | "submitted_condition_assessment"
  | "accepted_condition_assessment"
  | "rejected_condition_assessment";

async function logAssessmentActions(
  ctx: MutationCtx,
  assessment: {
    organizationId: Id<"organizations">;
    _id: Id<"conditionAssessments">;
  },
  userId: Id<"users">,
  actions: AssessmentAction[],
) {
  for (const action of actions) {
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: assessment.organizationId,
      userId,
      action,
      entityType: "conditionAssessment",
      entityId: assessment._id,
    });
  }
}

/** A submission's fields; a draft stays a draft. */
function lifecycleFields(submit: boolean | undefined, userId: Id<"users">) {
  const now = Date.now();
  return submit
    ? {
        status: "submitted" as const,
        submittedBy: userId,
        submittedAt: now,
        statusChangedAt: now,
      }
    : { status: "draft" as const };
}

/**
 * Records a new assessment as a draft, or submits it for approval at once
 * with `submit`. Refused while the object has a draft or submitted one.
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    ...assessmentContent,
    submit: v.optional(v.boolean()),
  },
  returns: v.id("conditionAssessments"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!collection) throw new Error("Object not found");
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );
    if (await findOpenAssessment(ctx, args.collectionId)) {
      throw conditionAssessmentError(
        "ASSESSMENT_ALREADY_OPEN",
        "The object already has a draft or submitted condition assessment",
      );
    }
    const { collectionId, submit, ...input } = args;
    const content = await validatedContent(ctx, collectionId, input);
    const assessmentId = await ctx.db.insert("conditionAssessments", {
      organizationId: collection.organizationId,
      collectionId,
      assessedBy: userId,
      recordedAt: Date.now(),
      statusChangedAt: Date.now(),
      ...content,
      ...lifecycleFields(submit, userId),
    });
    await logAssessmentActions(
      ctx,
      { organizationId: collection.organizationId, _id: assessmentId },
      userId,
      submit
        ? ["created_condition_assessment", "submitted_condition_assessment"]
        : ["created_condition_assessment"],
    );
    return assessmentId;
  },
});

/** Saves changes to a draft, and submits it for approval with `submit`. */
export const update = mutation({
  args: {
    assessmentId: v.id("conditionAssessments"),
    ...assessmentContent,
    submit: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, assessment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.assessmentId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!assessment) throw new Error("Assessment not found");
    await requirePermission(
      ctx,
      assessment.organizationId,
      "collections.update",
    );
    if (assessment.status !== "draft") {
      throw conditionAssessmentError(
        "ASSESSMENT_NOT_DRAFT",
        "Only a draft condition assessment can be changed or submitted",
      );
    }
    const { assessmentId, submit, ...input } = args;
    const content = await validatedContent(ctx, assessment.collectionId, input);
    await ctx.db.patch(assessmentId, {
      ...content,
      ...lifecycleFields(submit, userId),
    });
    await logAssessmentActions(
      ctx,
      assessment,
      userId,
      submit
        ? ["updated_condition_assessment", "submitted_condition_assessment"]
        : ["updated_condition_assessment"],
    );
    return null;
  },
});

/** Makes an assessment awaiting approval the object's current condition. */
export const accept = mutation({
  args: { assessmentId: v.id("conditionAssessments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, assessment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.assessmentId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!assessment) throw new Error("Assessment not found");
    await requirePermission(ctx, assessment.organizationId, REVIEW_PERMISSION);
    if (assessment.status === "accepted") return null;
    if (assessment.status === "rejected") {
      throw conditionAssessmentError(
        "ASSESSMENT_ALREADY_DECIDED",
        "The condition assessment was already rejected",
      );
    }
    if (assessment.status !== "submitted") {
      throw conditionAssessmentError(
        "ASSESSMENT_NOT_SUBMITTED",
        "Only a condition assessment awaiting approval can be accepted",
      );
    }
    const collection = await ctx.db.get(assessment.collectionId);
    if (
      !collection ||
      collection.organizationId !== assessment.organizationId
    ) {
      throw conditionAssessmentError(
        "ASSESSMENT_EVIDENCE_UNAVAILABLE",
        "Object is unavailable; assessment remains awaiting approval",
      );
    }
    for (const snapshot of assessment.photos) {
      const photo = await ctx.db.get(snapshot.mediaId);
      if (
        !photo ||
        photo.collectionId !== collection._id ||
        !(await ctx.db.system.get(snapshot.storageId))
      ) {
        throw conditionAssessmentError(
          "ASSESSMENT_EVIDENCE_UNAVAILABLE",
          "Assessment photo is unavailable; assessment remains awaiting approval",
        );
      }
    }
    const acceptedAt = Date.now();
    await ctx.db.patch(args.assessmentId, {
      status: "accepted",
      acceptedBy: userId,
      acceptedAt,
      statusChangedAt: acceptedAt,
    });
    await ctx.db.patch(collection._id, {
      condition: assessment.condition,
      currentConditionAssessmentId: assessment._id,
      legacyConditionSnapshot: collection.currentConditionAssessmentId
        ? collection.legacyConditionSnapshot
        : collection.condition,
      lastModifiedBy: userId,
      lastModifiedAt: acceptedAt,
    });
    await syncCollectionOptionUsages(ctx, collection._id);
    await logAssessmentActions(ctx, assessment, userId, [
      "accepted_condition_assessment",
    ]);
    return null;
  },
});

/**
 * Declines an assessment awaiting approval, or a draft nobody will finish.
 * The object's condition stays as it was, and staff may record a new
 * assessment.
 */
export const reject = mutation({
  args: {
    assessmentId: v.id("conditionAssessments"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, assessment] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.assessmentId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!assessment) throw new Error("Assessment not found");
    await requirePermission(ctx, assessment.organizationId, REVIEW_PERMISSION);
    if (assessment.status === "rejected") return null;
    if (assessment.status === "accepted") {
      throw conditionAssessmentError(
        "ASSESSMENT_ALREADY_DECIDED",
        "The condition assessment was already accepted",
      );
    }
    const reason = args.reason?.trim();
    if (reason && reason.length > MAX_REJECTION_REASON_LENGTH) {
      throw new Error("Rejection reason is too long");
    }
    const rejectedAt = Date.now();
    await ctx.db.patch(args.assessmentId, {
      status: "rejected",
      rejectedBy: userId,
      rejectedAt,
      statusChangedAt: rejectedAt,
      ...(reason ? { rejectionReason: reason } : {}),
    });
    await logAssessmentActions(ctx, assessment, userId, [
      "rejected_condition_assessment",
    ]);
    return null;
  },
});

const conditionHistoryEntry = v.object({
  condition: v.string(),
  changedAt: v.number(),
  changedBy: v.id("users"),
  note: v.optional(v.string()),
  changedByName: v.optional(v.string()),
});

export const getForObject = query({
  args: { collectionId: v.id("collections") },
  returns: v.object({
    organizationId: v.id("organizations"),
    current: v.object({
      source: v.union(
        v.literal("assessment"),
        v.literal("legacy"),
        v.literal("unknown"),
      ),
      condition: v.union(v.string(), v.null()),
      assessmentId: v.union(v.id("conditionAssessments"), v.null()),
    }),
    /** The draft to keep editing, or the submission a reviewer must decide. */
    open: v.union(
      v.object({
        assessmentId: v.id("conditionAssessments"),
        status: v.union(v.literal("draft"), v.literal("submitted")),
        assessedAt: v.number(),
        condition: v.string(),
        summary: v.string(),
        observations: v.array(observation),
        photoIds: v.array(v.id("mediaFiles")),
      }),
      v.null(),
    ),
    legacy: v.object({
      condition: v.optional(v.string()),
      history: v.array(conditionHistoryEntry),
      provenance: v.literal("uncertain"),
    }),
    comparison: v.object({
      legacyCondition: v.optional(v.string()),
      previousAccepted: v.union(
        v.object({
          assessmentId: v.id("conditionAssessments"),
          condition: v.string(),
          assessedAt: v.number(),
        }),
        v.null(),
      ),
      currentCondition: v.union(v.string(), v.null()),
    }),
  }),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Object not found");
    await requirePermission(ctx, collection.organizationId, "collections.read");
    const [currentAssessment, openAssessment] = await Promise.all([
      collection.currentConditionAssessmentId
        ? ctx.db.get(collection.currentConditionAssessmentId)
        : null,
      findOpenAssessment(ctx, args.collectionId),
    ]);
    const legacy = {
      condition:
        collection.legacyConditionSnapshot ??
        collection.conditionHistory?.at(-1)?.condition ??
        (currentAssessment ? undefined : collection.condition),
      history: collection.conditionHistory ?? [],
      provenance: "uncertain" as const,
    };
    const current =
      currentAssessment?.status === "accepted"
        ? {
            source: "assessment" as const,
            condition: currentAssessment.condition,
            assessmentId: currentAssessment._id,
          }
        : collection.currentConditionAssessmentId
          ? { source: "unknown" as const, condition: null, assessmentId: null }
          : collection.condition
            ? {
                source: "legacy" as const,
                condition: collection.condition,
                assessmentId: null,
              }
            : {
                source: "unknown" as const,
                condition: null,
                assessmentId: null,
              };
    const acceptedByRecency = await ctx.db
      .query("conditionAssessments")
      .withIndex("by_collection_and_status_and_acceptedAt", (q) =>
        q.eq("collectionId", args.collectionId).eq("status", "accepted"),
      )
      .order("desc")
      .take(2);
    const previousAcceptedDoc = acceptedByRecency.find((item) => {
      if (currentAssessment && item._id === currentAssessment._id) {
        return false;
      }
      if (currentAssessment?.acceptedAt === undefined) {
        return true;
      }
      return (item.acceptedAt ?? -1) <= currentAssessment.acceptedAt;
    });
    const previousAccepted = previousAcceptedDoc
      ? {
          assessmentId: previousAcceptedDoc._id,
          condition: previousAcceptedDoc.condition,
          assessedAt: previousAcceptedDoc.assessedAt,
        }
      : null;
    const comparison = {
      legacyCondition: legacy.condition,
      previousAccepted,
      currentCondition:
        current.source === "assessment" ? current.condition : null,
    };
    const open =
      openAssessment?.status === "draft" ||
      openAssessment?.status === "submitted"
        ? {
            assessmentId: openAssessment._id,
            status: openAssessment.status,
            assessedAt: openAssessment.assessedAt,
            condition: openAssessment.condition,
            summary: openAssessment.summary,
            observations: openAssessment.observations,
            photoIds: openAssessment.photos.map((photo) => photo.mediaId),
          }
        : null;
    return {
      organizationId: collection.organizationId,
      current,
      open,
      legacy,
      comparison,
    };
  },
});

/** Display names of the given users, looked up once each. */
async function userNames(ctx: QueryCtx, ids: (Id<"users"> | undefined)[]) {
  const users = await batchLookup(
    ctx,
    ids.filter((id): id is Id<"users"> => id !== undefined),
    "users",
  );
  return (id: Id<"users"> | undefined) =>
    id === undefined ? undefined : displayName(users.get(id) ?? null);
}

/**
 * The accepted assessment the Object points to, read by that pointer so it is
 * found however many later drafts and rejections the Object has.
 */
export const getCurrentAccepted = query({
  args: { collectionId: v.id("collections") },
  returns: v.union(
    v.object({
      assessmentId: v.id("conditionAssessments"),
      condition: v.string(),
      assessedAt: v.number(),
      summary: v.string(),
      observations: v.array(observation),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Object not found");
    await requirePermission(ctx, collection.organizationId, "collections.read");
    const current = collection.currentConditionAssessmentId
      ? await ctx.db.get(collection.currentConditionAssessmentId)
      : null;
    if (
      !current ||
      current.status !== "accepted" ||
      current.organizationId !== collection.organizationId
    )
      return null;
    return {
      assessmentId: current._id,
      condition: current.condition,
      assessedAt: current.assessedAt,
      summary: current.summary,
      observations: current.observations,
    };
  },
});

export const listForObject = query({
  args: {
    collectionId: v.id("collections"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) throw new Error("Object not found");
    await requirePermission(ctx, collection.organizationId, "collections.read");
    const canReadMedia = await hasPermission(
      ctx,
      collection.organizationId,
      "media.read",
    );
    const result = await ctx.db
      .query("conditionAssessments")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const nameOf = await userNames(
      ctx,
      result.page.flatMap((assessment) => [
        assessment.assessedBy,
        assessment.acceptedBy,
        assessment.rejectedBy,
      ]),
    );
    const page = await Promise.all(
      result.page.map(async (assessment) => ({
        ...assessment,
        assessorName: nameOf(assessment.assessedBy) ?? "Unknown assessor",
        acceptedByName: assessment.acceptedBy
          ? (nameOf(assessment.acceptedBy) ?? "Unknown reviewer")
          : null,
        rejectedByName: nameOf(assessment.rejectedBy) ?? null,
        photos: await Promise.all(
          assessment.photos.map(async (photo) => ({
            id: photo.mediaId,
            name: canReadMedia ? photo.fileName : "",
            url: canReadMedia
              ? await ctx.storage.getUrl(photo.storageId)
              : null,
          })),
        ),
      })),
    );
    return { ...result, page };
  },
});

export const boardItemValidator = v.object({
  _id: v.id("conditionAssessments"),
  _creationTime: v.number(),
  collectionId: v.id("collections"),
  objectTitle: v.union(v.string(), v.null()),
  accessionNumber: v.union(v.string(), v.null()),
  status: conditionAssessmentStatusValidator,
  condition: v.string(),
  summary: v.string(),
  observationCount: v.number(),
  photoCount: v.number(),
  assessedAt: v.number(),
  assessorName: v.union(v.string(), v.null()),
  submittedAt: v.union(v.number(), v.null()),
  decidedAt: v.union(v.number(), v.null()),
  decidedByName: v.union(v.string(), v.null()),
  rejectionReason: v.union(v.string(), v.null()),
});

type BoardItem = Infer<typeof boardItemValidator>;

async function toBoardItems(
  ctx: QueryCtx,
  assessments: Doc<"conditionAssessments">[],
): Promise<BoardItem[]> {
  const [collections, nameOf] = await Promise.all([
    batchLookup(
      ctx,
      assessments.map((assessment) => assessment.collectionId),
      "collections",
    ),
    userNames(
      ctx,
      assessments.flatMap((assessment) => [
        assessment.assessedBy,
        assessment.acceptedBy,
        assessment.rejectedBy,
      ]),
    ),
  ]);
  return assessments.map((assessment) => {
    const collection = collections.get(assessment.collectionId);
    const visible = collection?.organizationId === assessment.organizationId;
    return {
      _id: assessment._id,
      _creationTime: assessment._creationTime,
      collectionId: assessment.collectionId,
      objectTitle: visible ? collection.title : null,
      accessionNumber: visible ? collection.accessionNumber : null,
      status: assessment.status,
      condition: assessment.condition,
      summary: assessment.summary,
      observationCount: assessment.observations.length,
      photoCount: assessment.photos.length,
      assessedAt: assessment.assessedAt,
      assessorName: nameOf(assessment.assessedBy) ?? null,
      submittedAt: assessment.submittedAt ?? null,
      decidedAt: assessment.acceptedAt ?? assessment.rejectedAt ?? null,
      decidedByName:
        nameOf(assessment.acceptedBy ?? assessment.rejectedBy) ?? null,
      rejectionReason: assessment.rejectionReason ?? null,
    };
  });
}

function matchesBoardSearch(item: BoardItem, search: string) {
  return [
    item.objectTitle,
    item.accessionNumber,
    item.condition,
    item.summary,
    item.assessorName,
  ].some((text) => text?.toLowerCase().includes(search));
}

function statusQuery(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  status: ConditionAssessmentStatus,
) {
  return ctx.db
    .query("conditionAssessments")
    .withIndex("by_organization_and_status_and_statusChangedAt", (q) =>
      q.eq("organizationId", organizationId).eq("status", status),
    );
}

/** How many assessments have a status, counting no further than `limit`. */
async function countUpTo(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  status: ConditionAssessmentStatus,
  limit: number,
) {
  const rows = await statusQuery(ctx, organizationId, status).take(limit + 1);
  return { count: Math.min(rows.length, limit), hasMore: rows.length > limit };
}

const boundedCount = v.object({ count: v.number(), hasMore: v.boolean() });

/**
 * One column of the condition assessment board, most recent status change
 * first. Search narrows each loaded page, as on the deaccession board
 * without search documents.
 */
export const listBoardColumn = query({
  args: {
    organizationId: v.id("organizations"),
    column: conditionAssessmentStatusValidator,
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(boardItemValidator),
  handler: async (ctx, args) => {
    await requireCapability(
      ctx,
      args.organizationId,
      "condition_assessments",
      BOARD_PERMISSIONS,
    );
    const result = await statusQuery(ctx, args.organizationId, args.column)
      .order("desc")
      .paginate(args.paginationOpts);
    const items = await toBoardItems(ctx, result.page);
    const search = args.search?.trim().toLowerCase();
    return {
      ...result,
      page: search
        ? items.filter((item) => matchesBoardSearch(item, search))
        : items,
    };
  },
});

export const getBoardCounts = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    draft: boundedCount,
    submitted: boundedCount,
    accepted: boundedCount,
    rejected: boundedCount,
  }),
  handler: async (ctx, args) => {
    await requireCapability(
      ctx,
      args.organizationId,
      "condition_assessments",
      BOARD_PERMISSIONS,
    );
    const count = (status: ConditionAssessmentStatus) =>
      countUpTo(ctx, args.organizationId, status, BOARD_COUNT_LIMIT);
    const [draft, submitted, accepted, rejected] = await Promise.all([
      count("draft"),
      count("submitted"),
      count("accepted"),
      count("rejected"),
    ]);
    return { draft, submitted, accepted, rejected };
  },
});

/**
 * Submitted assessments waiting for the viewer to accept or reject them,
 * newest first. Null for members who cannot open the board or accept
 * assessments, so they never see the Work board column.
 */
export async function readAwaitingAcceptance(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  limit: number,
): Promise<ColumnPage<BoardItem> | null> {
  const permissions = await getUserPermissions(ctx, organizationId);
  const canAct = [...BOARD_PERMISSIONS, REVIEW_PERMISSION].every((permission) =>
    permissions.includes(permission),
  );
  if (!canAct) return null;
  const rows = await statusQuery(ctx, organizationId, "submitted")
    .order("desc")
    .take(limit + 1);
  return {
    cards: await toBoardItems(ctx, rows.slice(0, limit)),
    hasMore: rows.length > limit,
  };
}
