import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, type QueryCtx, query } from "./_generated/server";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";
import {
  applyGenerationPage as applyPage,
  cancelGeneration,
  collectGenerationPage,
  continueFanOutPage,
  getProjectionState,
  isProjectionUpdating,
  markGenerationFailed,
  PROJECTION_DISCREPANCY_ROW_LIMIT,
  PROJECTION_FANOUT_LIMIT,
  PROJECTION_PAGE_SIZE,
  PROJECTION_STEPS,
  retryGeneration,
  startGeneration,
} from "./utils/projectionMaintenance";
import { PROJECTION_PHASES } from "./utils/projectionSources";
import {
  PROJECTION_DEFINITION_VERSION,
  readTotals,
} from "./utils/projectionStore";
import {
  projectionAvailability,
  projectionDiscrepancyFields,
  projectionGenerationStatus,
  projectionMode,
  projectionUnavailableReason,
} from "./utils/projectionValidators";

const MANAGE_PERMISSION = "organization.manage_settings";

const generationSummary = v.object({
  _id: v.id("projectionGenerations"),
  mode: projectionMode,
  status: projectionGenerationStatus,
  definitionVersion: v.number(),
  step: v.string(),
  stepIndex: v.number(),
  stepCount: v.number(),
  checkpoint: v.number(),
  attempts: v.number(),
  processedRows: v.number(),
  maxPageRows: v.number(),
  maxPageWrites: v.number(),
  totalWrites: v.number(),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  failure: v.optional(v.string()),
  discrepancyCount: v.number(),
  mismatchCount: v.number(),
  requestedByName: v.optional(v.string()),
});

const healthValidator = v.object({
  definitionVersion: v.number(),
  stateDefinitionVersion: v.union(v.number(), v.null()),
  availability: projectionAvailability,
  reason: v.optional(projectionUnavailableReason),
  updating: v.boolean(),
  revision: v.number(),
  lastBuiltAt: v.optional(v.number()),
  lastVerifiedAt: v.optional(v.number()),
  invalidatedAt: v.optional(v.number()),
  active: v.union(generationSummary, v.null()),
  building: v.union(generationSummary, v.null()),
  reconciling: v.union(generationSummary, v.null()),
  lastReconciliation: v.union(generationSummary, v.null()),
  recentGenerations: v.array(generationSummary),
  sourceQuality: v.array(v.object({ metric: v.string(), count: v.number() })),
  steps: v.array(v.string()),
  limits: v.object({
    pageSize: v.number(),
    fanOutLimit: v.number(),
    discrepancyRowLimit: v.number(),
  }),
});

async function summarize(
  ctx: Pick<QueryCtx, "db">,
  generation: Doc<"projectionGenerations"> | null,
) {
  if (!generation) return null;
  const stepCount =
    generation.mode === "reconcile"
      ? PROJECTION_STEPS.length
      : PROJECTION_PHASES.length;
  const requester = generation.requestedBy
    ? await ctx.db.get(generation.requestedBy)
    : null;
  return {
    _id: generation._id,
    mode: generation.mode,
    status: generation.status,
    definitionVersion: generation.definitionVersion,
    step: PROJECTION_STEPS[generation.phaseIndex] ?? "publish",
    stepIndex: Math.min(generation.phaseIndex, stepCount),
    stepCount,
    checkpoint: generation.checkpoint,
    attempts: generation.attempts,
    processedRows: generation.processedRows,
    maxPageRows: generation.maxPageRows,
    maxPageWrites: generation.maxPageWrites,
    totalWrites: generation.totalWrites,
    startedAt: generation.startedAt,
    finishedAt: generation.finishedAt,
    failure: generation.failure,
    discrepancyCount: generation.discrepancyCount,
    mismatchCount: generation.mismatchCount,
    requestedByName: requester?.name ?? requester?.email ?? undefined,
  };
}

async function loadOwnedGeneration(
  ctx: Pick<QueryCtx, "db">,
  organizationId: Id<"organizations">,
  generationId: Id<"projectionGenerations">,
) {
  const generation = await ctx.db.get(generationId);
  if (!generation || generation.organizationId !== organizationId) {
    throw new ConvexError("Projection job not found");
  }
  return generation;
}

export const getHealth = query({
  args: { organizationId: v.id("organizations") },
  returns: healthValidator,
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const state = await getProjectionState(ctx, args.organizationId);
    const load = (id?: Id<"projectionGenerations">) =>
      id ? ctx.db.get(id) : Promise.resolve(null);
    const [
      active,
      building,
      reconciling,
      lastReconciliation,
      recent,
      updating,
    ] = await Promise.all([
      load(state?.activeGenerationId),
      load(state?.buildingGenerationId),
      load(state?.reconcilingGenerationId),
      load(state?.lastReconciliationId),
      ctx.db
        .query("projectionGenerations")
        .withIndex("by_organizationId_and_startedAt", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(10),
      isProjectionUpdating(ctx, args.organizationId),
    ]);
    const quality =
      active && state?.availability === "ready"
        ? await readTotals(ctx, active._id, "all")
        : {};
    const definitionChanged =
      state !== null &&
      state.definitionVersion !== PROJECTION_DEFINITION_VERSION;
    return {
      definitionVersion: PROJECTION_DEFINITION_VERSION,
      stateDefinitionVersion: state?.definitionVersion ?? null,
      availability: definitionChanged
        ? ("unavailable" as const)
        : (state?.availability ?? ("unavailable" as const)),
      reason: definitionChanged
        ? ("definition_changed" as const)
        : state
          ? state.reason
          : ("not_built" as const),
      updating,
      revision: state?.revision ?? 0,
      lastBuiltAt: state?.lastBuiltAt,
      lastVerifiedAt: state?.lastVerifiedAt,
      invalidatedAt: state?.invalidatedAt,
      active: await summarize(ctx, active),
      building: await summarize(ctx, building),
      reconciling: await summarize(ctx, reconciling),
      lastReconciliation: await summarize(ctx, lastReconciliation),
      recentGenerations: await Promise.all(
        recent.map(async (generation) => {
          const summary = await summarize(ctx, generation);
          if (!summary) throw new Error("Generation summary missing");
          return summary;
        }),
      ),
      sourceQuality: Object.entries(quality).flatMap(([metric, count]) =>
        metric.startsWith("quality.") ? [{ metric, count }] : [],
      ),
      steps: [...PROJECTION_STEPS],
      limits: {
        pageSize: PROJECTION_PAGE_SIZE,
        fanOutLimit: PROJECTION_FANOUT_LIMIT,
        discrepancyRowLimit: PROJECTION_DISCREPANCY_ROW_LIMIT,
      },
    };
  },
});

export const listDiscrepancies = query({
  args: {
    organizationId: v.id("organizations"),
    generationId: v.id("projectionGenerations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      ...projectionDiscrepancyFields,
      _id: v.id("projectionDiscrepancies"),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    await loadOwnedGeneration(ctx, args.organizationId, args.generationId);
    return await ctx.db
      .query("projectionDiscrepancies")
      .withIndex("by_generationId", (q) =>
        q.eq("generationId", args.generationId),
      )
      .paginate(args.paginationOpts);
  },
});

export const startRebuild = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.id("projectionGenerations"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const userId = await getAuthUserId(ctx);
    const state = await getProjectionState(ctx, args.organizationId);
    if (state?.buildingGenerationId) {
      throw new ConvexError(
        "A projection rebuild is already running or awaiting retry",
      );
    }
    return await startGeneration(
      ctx,
      args.organizationId,
      "rebuild",
      userId ?? undefined,
    );
  },
});

export const startReconcile = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.id("projectionGenerations"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const userId = await getAuthUserId(ctx);
    const state = await getProjectionState(ctx, args.organizationId);
    if (
      !state?.activeGenerationId ||
      state.availability !== "ready" ||
      state.definitionVersion !== PROJECTION_DEFINITION_VERSION
    ) {
      throw new ConvexError(
        "Reconciliation needs a ready projection; rebuild first",
      );
    }
    if (state.reconcilingGenerationId) {
      throw new ConvexError("A reconciliation is already running");
    }
    return await startGeneration(
      ctx,
      args.organizationId,
      "reconcile",
      userId ?? undefined,
    );
  },
});

export const retryRebuild = mutation({
  args: {
    organizationId: v.id("organizations"),
    generationId: v.id("projectionGenerations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const generation = await loadOwnedGeneration(
      ctx,
      args.organizationId,
      args.generationId,
    );
    const state = await getProjectionState(ctx, args.organizationId);
    const current =
      state?.buildingGenerationId === generation._id ||
      state?.reconcilingGenerationId === generation._id;
    if (
      generation.status !== "failed" ||
      !current ||
      state?.revision !== generation.revision
    ) {
      throw new ConvexError(
        "Only the current failed projection job can be retried",
      );
    }
    await retryGeneration(ctx, generation);
    return null;
  },
});

export const cancelRebuild = mutation({
  args: {
    organizationId: v.id("organizations"),
    generationId: v.id("projectionGenerations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const generation = await loadOwnedGeneration(
      ctx,
      args.organizationId,
      args.generationId,
    );
    if (generation.status !== "building" && generation.status !== "failed") {
      throw new ConvexError(
        "Only a running or failed projection job can be cancelled",
      );
    }
    await cancelGeneration(ctx, generation);
    return null;
  },
});

export const applyGenerationPage = internalMutation({
  args: {
    generationId: v.id("projectionGenerations"),
    expectedCheckpoint: v.number(),
    pageSize: v.optional(v.number()),
  },
  returns: v.union(v.literal("noop"), v.literal("continue"), v.literal("done")),
  handler: async (ctx, args) =>
    await applyPage(
      ctx,
      args.generationId,
      args.expectedCheckpoint,
      args.pageSize,
    ),
});

export const markGenerationPageFailed = internalMutation({
  args: {
    generationId: v.id("projectionGenerations"),
    expectedCheckpoint: v.number(),
    failure: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await markGenerationFailed(
      ctx,
      args.generationId,
      args.expectedCheckpoint,
      args.failure,
    );
    return null;
  },
});

/**
 * Runs one checkpoint page. A failed page rolls back entirely, so it is
 * retried with fewer rows (dense rows can exceed per-transaction platform
 * limits at the default size). Only a failure at a single row is recorded
 * as a failed job that keeps its last committed checkpoint for retry.
 */
export const advanceGeneration = internalAction({
  args: {
    generationId: v.id("projectionGenerations"),
    expectedCheckpoint: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let pageSize = PROJECTION_PAGE_SIZE;
    for (;;) {
      try {
        await ctx.runMutation(internal.projections.applyGenerationPage, {
          ...args,
          pageSize,
        });
        return null;
      } catch (error) {
        if (pageSize > 1) {
          pageSize = Math.max(1, Math.floor(pageSize / 2));
          continue;
        }
        await ctx.runMutation(internal.projections.markGenerationPageFailed, {
          ...args,
          failure: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }
  },
});

export const continueFanOut = internalMutation({
  args: { fanOutId: v.id("projectionFanOuts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await continueFanOutPage(ctx, args.fanOutId);
    if (result === "continue") {
      await ctx.scheduler.runAfter(0, internal.projections.continueFanOut, {
        fanOutId: args.fanOutId,
      });
    }
    return null;
  },
});

export const collectGeneration = internalMutation({
  args: { generationId: v.id("projectionGenerations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await collectGenerationPage(ctx, args.generationId);
    if (result === "continue") {
      await ctx.scheduler.runAfter(0, internal.projections.collectGeneration, {
        generationId: args.generationId,
      });
    }
    return null;
  },
});

/**
 * Operator entry point (CLI, restore rehearsal): starts a source-derived
 * rebuild for one organization unless one is already running.
 */
export const startRebuildForOrganization = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.id("projectionGenerations"), v.null()),
  handler: async (ctx, args) => {
    const state = await getProjectionState(ctx, args.organizationId);
    if (state?.buildingGenerationId) return null;
    return await startGeneration(ctx, args.organizationId, "rebuild");
  },
});

/** Operator entry point: reconciles one organization against its active projection. */
export const startReconcileForOrganization = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.id("projectionGenerations"), v.null()),
  handler: async (ctx, args) => {
    const state = await getProjectionState(ctx, args.organizationId);
    if (
      !state?.activeGenerationId ||
      state.availability !== "ready" ||
      state.reconcilingGenerationId
    ) {
      return null;
    }
    return await startGeneration(ctx, args.organizationId, "reconcile");
  },
});

/**
 * Operator entry point: resumes the organization's current failed rebuild or
 * reconcile from its last committed checkpoint, with the same guards as the
 * admin Retry action. Returns the resumed job, or null when none is failed.
 */
export const retryFailedForOrganization = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.id("projectionGenerations"), v.null()),
  handler: async (ctx, args) => {
    const state = await getProjectionState(ctx, args.organizationId);
    for (const generationId of [
      state?.buildingGenerationId,
      state?.reconcilingGenerationId,
    ]) {
      if (!generationId) continue;
      const generation = await ctx.db.get(generationId);
      if (
        generation?.status === "failed" &&
        generation.revision === state?.revision
      ) {
        await retryGeneration(ctx, generation);
        return generation._id;
      }
    }
    return null;
  },
});

const ROLLOUT_PAGE_SIZE = 20;

/**
 * Rollout entry point: walks organizations in bounded pages and starts a
 * rebuild for every organization without a ready or running projection.
 */
export const startRebuildForAllOrganizations = internalMutation({
  args: { after: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_creation_time", (q) =>
        args.after === undefined ? q : q.gt("_creationTime", args.after),
      )
      .take(ROLLOUT_PAGE_SIZE);
    let started = 0;
    for (const organization of organizations) {
      const state = await getProjectionState(ctx, organization._id);
      const ready =
        state?.availability === "ready" &&
        state.definitionVersion === PROJECTION_DEFINITION_VERSION;
      if (ready || state?.buildingGenerationId) continue;
      await startGeneration(ctx, organization._id, "rebuild");
      started += 1;
    }
    const last = organizations.at(-1);
    if (organizations.length === ROLLOUT_PAGE_SIZE && last) {
      await ctx.scheduler.runAfter(
        0,
        internal.projections.startRebuildForAllOrganizations,
        { after: last._creationTime },
      );
    }
    return started;
  },
});
