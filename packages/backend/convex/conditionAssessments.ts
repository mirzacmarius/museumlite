import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { syncCollectionOptionUsages } from "./utils/collectionOptionUsages";
import { hasPermission, requirePermission } from "./utils/permissions";

const observation = v.object({
  area: v.string(),
  description: v.string(),
  severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("severe")),
});

function requiredText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    assessedAt: v.number(),
    condition: v.string(),
    summary: v.string(),
    observations: v.array(observation),
    photos: v.array(v.id("mediaFiles")),
  },
  returns: v.id("conditionAssessments"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!collection) throw new Error("Object not found");
    await requirePermission(ctx, collection.organizationId, "collections.update");
    if (!Number.isFinite(args.assessedAt) || args.assessedAt > Date.now()) {
      throw new Error("Assessment date must be valid and cannot be in the future");
    }
    if (args.observations.length > 100 || args.photos.length > 20) {
      throw new Error("Assessment has too many observations or photos");
    }
    const observations = args.observations.map((item) => ({
      area: requiredText(item.area, "Observation area"),
      description: requiredText(item.description, "Observation description"),
      severity: item.severity,
    }));
    const photos: Doc<"conditionAssessments">["photos"] = [];
    for (const photoId of new Set(args.photos)) {
      const photo = await ctx.db.get(photoId);
      if (!photo || photo.collectionId !== args.collectionId || photo.fileType !== "image" || photo.uploadStatus !== "completed" || !(await ctx.db.system.get(photo.storageId))) {
        throw new Error("Assessment photo must belong to this object");
      }
      photos.push({ mediaId: photoId, storageId: photo.storageId, fileName: photo.fileName });
    }
    const assessmentId = await ctx.db.insert("conditionAssessments", {
      organizationId: collection.organizationId,
      collectionId: args.collectionId,
      assessedBy: userId,
      assessedAt: args.assessedAt,
      recordedAt: Date.now(),
      condition: requiredText(args.condition, "Condition"),
      summary: requiredText(args.summary, "Summary"),
      observations,
      photos,
      status: "draft",
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created_condition_assessment",
      entityType: "conditionAssessment",
      entityId: assessmentId,
    });
    return assessmentId;
  },
});

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
    await requirePermission(ctx, assessment.organizationId, "collections.accept_condition");
    if (assessment.status === "accepted") return null;
    const collection = await ctx.db.get(assessment.collectionId);
    if (!collection || collection.organizationId !== assessment.organizationId) {
      throw new Error("Object is unavailable; assessment remains a draft");
    }
    for (const snapshot of assessment.photos) {
      const photo = await ctx.db.get(snapshot.mediaId);
      if (!photo || photo.collectionId !== collection._id || !(await ctx.db.system.get(snapshot.storageId))) {
        throw new Error("Assessment photo is unavailable; assessment remains a draft");
      }
    }
    const acceptedAt = Date.now();
    await ctx.db.patch(args.assessmentId, { status: "accepted", acceptedBy: userId, acceptedAt });
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
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "accepted_condition_assessment",
      entityType: "conditionAssessment",
      entityId: assessment._id,
    });
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
    const currentAssessment = collection.currentConditionAssessmentId
      ? await ctx.db.get(collection.currentConditionAssessmentId)
      : null;
    const legacy = {
      condition: collection.legacyConditionSnapshot ?? collection.conditionHistory?.at(-1)?.condition ?? (currentAssessment ? undefined : collection.condition),
      history: collection.conditionHistory ?? [],
      provenance: "uncertain" as const,
    };
    const current = currentAssessment?.status === "accepted"
      ? { source: "assessment" as const, condition: currentAssessment.condition, assessmentId: currentAssessment._id }
      : collection.currentConditionAssessmentId
        ? { source: "unknown" as const, condition: null, assessmentId: null }
      : collection.condition
        ? { source: "legacy" as const, condition: collection.condition, assessmentId: null }
        : { source: "unknown" as const, condition: null, assessmentId: null };
    const recentAssessments = await ctx.db
      .query("conditionAssessments")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .order("desc")
      .take(25);
    const acceptedOrdered = recentAssessments.filter((item) => item.status === "accepted");
    const previousAccepted = acceptedOrdered[1]
      ? {
          assessmentId: acceptedOrdered[1]._id,
          condition: acceptedOrdered[1].condition,
          assessedAt: acceptedOrdered[1].assessedAt,
        }
      : null;
    const comparison = {
      legacyCondition: legacy.condition,
      previousAccepted,
      currentCondition: current.condition,
    };
    return { organizationId: collection.organizationId, current, legacy, comparison };
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
    const canReadMedia = await hasPermission(ctx, collection.organizationId, "media.read");
    const result = await ctx.db.query("conditionAssessments")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .order("desc").paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map(async (assessment) => ({
      ...assessment,
      assessorName: (await ctx.db.get(assessment.assessedBy))?.name ?? "Unknown assessor",
      acceptedByName: assessment.acceptedBy
        ? (await ctx.db.get(assessment.acceptedBy))?.name ?? "Unknown reviewer"
        : null,
      photos: await Promise.all(assessment.photos.map(async (photo) => ({
        id: photo.mediaId,
        name: canReadMedia ? photo.fileName : "",
        url: canReadMedia ? await ctx.storage.getUrl(photo.storageId) : null,
      }))),
    })));
    return { ...result, page };
  },
});
