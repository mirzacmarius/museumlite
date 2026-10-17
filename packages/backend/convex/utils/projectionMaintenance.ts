import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getUsageCounter } from "./organizationUsageCounters";
import {
  CHILD_PHASES,
  computeSourceFacts,
  dependentsFromFacts,
  PROJECTION_PHASES,
  type ProjectionSource,
  type ProjectionSourceDoc,
  phaseIndexOf,
  relationFanOut,
  sourceOrganization,
} from "./projectionSources";
import {
  claimMetricSlot,
  datedEntries,
  getContribution,
  metricNamespace,
  metricTree,
  PROJECTION_DEFINITION_VERSION,
  type ProjectionFact,
  type ProjectionGeneration,
  readTotals,
  replaceContribution,
  sameFacts,
} from "./projectionStore";

/** Source rows scanned per checkpoint page. */
export const PROJECTION_PAGE_SIZE = 25;
/** Rows a single source change may refresh through relations. */
export const PROJECTION_FANOUT_LIMIT = 100;
/** Discrepancy rows persisted per reconciliation; the count is kept beyond it. */
export const PROJECTION_DISCREPANCY_ROW_LIMIT = 200;
const MAX_DEPENDENCY_DEPTH = 4;
/** Delay before a reconcile re-checks for pending wide refreshes. */
const FAN_OUT_WAIT_MS = 1_000;
/** Quiet period after a change before the automatic reconciliation starts. */
export const RECONCILE_SETTLE_MS = 5 * 60 * 1000;
/** Minimum spacing between automatic reconciliations of one organization. */
export const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;
/** Attempts, including the first, before a failed job waits for an administrator. */
export const PROJECTION_AUTO_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 30_000;

export const COMPARE_STEPS = [
  "compare_source_vectors",
  "compare_projected_vectors",
  "compare_source_totals",
  "compare_projected_totals",
  "compare_legacy_usage",
] as const;

export const PROJECTION_STEPS = [...PROJECTION_PHASES, ...COMPARE_STEPS];

type Ctx = MutationCtx;
type ReadCtx = Pick<QueryCtx, "db">;
type ScanRow = { _id: string; _creationTime: number };

export class ProjectionFanOutExceeded extends Error {
  constructor() {
    super("Projection fan-out limit exceeded");
  }
}

interface Budget {
  remaining: number;
}

export async function getProjectionState(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("organizationProjectionStates")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .unique();
}

export async function ensureProjectionState(
  ctx: Ctx,
  organizationId: Id<"organizations">,
) {
  const existing = await getProjectionState(ctx, organizationId);
  if (existing) return existing;
  const stateId = await ctx.db.insert("organizationProjectionStates", {
    organizationId,
    definitionVersion: PROJECTION_DEFINITION_VERSION,
    revision: 0,
    availability: "unavailable",
    reason: "not_built",
  });
  const state = await ctx.db.get(stateId);
  if (!state) throw new Error("Projection state was not created");
  return state;
}

function emptyGeneration(
  organizationId: Id<"organizations">,
  mode: "rebuild" | "reconcile",
  revision: number,
  now: number,
) {
  return {
    organizationId,
    mode,
    status: "building" as const,
    definitionVersion: PROJECTION_DEFINITION_VERSION,
    revision,
    phaseIndex: 0,
    cursor: null,
    checkpoint: 0,
    attempts: 1,
    processedRows: 0,
    maxPageRows: 0,
    maxPageWrites: 0,
    totalWrites: 0,
    startedAt: now,
    discrepancyCount: 0,
    mismatchCount: 0,
  };
}

/**
 * A new organization has no source rows, so an empty generation is a
 * complete, source-derived projection.
 */
export async function initializeEmptyProjection(
  ctx: Ctx,
  organizationId: Id<"organizations">,
) {
  const state = await ensureProjectionState(ctx, organizationId);
  if (state.activeGenerationId || state.buildingGenerationId) return;
  const now = Date.now();
  const { slot, slotsInUse } = claimMetricSlot(state.metricSlotsInUse);
  const generationId = await ctx.db.insert("projectionGenerations", {
    ...emptyGeneration(organizationId, "rebuild", state.revision, now),
    status: "completed",
    phaseIndex: PROJECTION_PHASES.length,
    finishedAt: now,
    metricSlot: slot,
  });
  await ctx.db.patch(state._id, {
    metricSlotsInUse: slotsInUse,
    activeGenerationId: generationId,
    availability: "ready",
    reason: undefined,
    lastBuiltAt: now,
  });
}

export async function startGeneration(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  mode: "rebuild" | "reconcile",
  requestedBy?: Id<"users">,
) {
  const state = await ensureProjectionState(ctx, organizationId);
  const now = Date.now();
  const { slot, slotsInUse } = claimMetricSlot(state.metricSlotsInUse);
  await ctx.db.patch(state._id, { metricSlotsInUse: slotsInUse });
  const generationId = await ctx.db.insert("projectionGenerations", {
    ...emptyGeneration(organizationId, mode, state.revision, now),
    metricSlot: slot,
    ...(requestedBy ? { requestedBy } : {}),
    ...(mode === "reconcile" && state.activeGenerationId
      ? { baselineGenerationId: state.activeGenerationId }
      : {}),
  });
  if (mode === "rebuild") {
    await ctx.db.patch(state._id, {
      buildingGenerationId: generationId,
      ...(state.availability === "unavailable" && state.reason !== "invalidated"
        ? { reason: "building" as const }
        : {}),
    });
  } else {
    await ctx.db.patch(state._id, { reconcilingGenerationId: generationId });
  }
  await ctx.scheduler.runAfter(0, internal.projections.advanceGeneration, {
    generationId,
    expectedCheckpoint: 0,
  });
  return generationId;
}

async function stopGeneration(
  ctx: Ctx,
  generation: ProjectionGeneration,
  status: "cancelled" | "superseded",
  failure?: string,
) {
  await ctx.db.patch(generation._id, {
    status,
    finishedAt: Date.now(),
    ...(failure ? { failure } : {}),
  });
  await ctx.scheduler.runAfter(0, internal.projections.collectGeneration, {
    generationId: generation._id,
  });
}

/**
 * Last resort when a single row's own dependency chain exceeds the limit:
 * readers become unavailable and a fresh rebuild starts, unless a rebuild for
 * an earlier invalidation is still running.
 */
export async function invalidateProjection(
  ctx: Ctx,
  organizationId: Id<"organizations">,
) {
  const state = await getProjectionState(ctx, organizationId);
  if (!state) return;
  if (state.reason === "invalidated" && state.buildingGenerationId) {
    const running = await ctx.db.get(state.buildingGenerationId);
    if (running?.status === "building") return;
  }
  for (const generationId of [
    state.buildingGenerationId,
    state.reconcilingGenerationId,
  ]) {
    const generation = generationId ? await ctx.db.get(generationId) : null;
    if (generation && generation.status !== "cancelled") {
      await stopGeneration(
        ctx,
        generation,
        "cancelled",
        "Invalidated by a change wider than the fan-out limit",
      );
    }
  }
  await ctx.db.patch(state._id, {
    revision: state.revision + 1,
    availability: "unavailable",
    reason: "invalidated",
    invalidatedAt: Date.now(),
    buildingGenerationId: undefined,
    reconcilingGenerationId: undefined,
  });
  await startGeneration(ctx, organizationId, "rebuild");
}

async function maintainedGenerations(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  const state = await getProjectionState(ctx, organizationId);
  if (!state) return [];
  const ids = [
    state.availability === "ready" &&
    state.definitionVersion === PROJECTION_DEFINITION_VERSION
      ? state.activeGenerationId
      : undefined,
    state.buildingGenerationId,
    state.reconcilingGenerationId,
  ];
  const generations: ProjectionGeneration[] = [];
  for (const id of ids) {
    if (!id) continue;
    const generation = await ctx.db.get(id);
    if (generation) generations.push(generation);
  }
  return generations;
}

/**
 * Building generations skip rows of phases the scanner has not reached; the
 * scanner computes them later from their current source.
 */
function maintainsTable(generation: ProjectionGeneration, table: string) {
  if (generation.status === "completed") return true;
  return phaseIndexOf(table) <= generation.phaseIndex;
}

async function refreshSource(
  ctx: Ctx,
  generation: ProjectionGeneration,
  table: ProjectionSource,
  sourceId: string,
  budget: Budget,
  depth: number,
  force = false,
): Promise<{ facts: ProjectionFact[]; writes: number }> {
  if (!maintainsTable(generation, table)) return { facts: [], writes: 0 };
  if (depth > MAX_DEPENDENCY_DEPTH) throw new ProjectionFanOutExceeded();
  const id = ctx.db.normalizeId(table, sourceId);
  const doc = (id ? await ctx.db.get(id) : null) as ProjectionSourceDoc | null;
  const organizationId = doc ? await sourceOrganization(ctx, table, doc) : null;
  const facts =
    doc && organizationId === generation.organizationId
      ? await computeSourceFacts(ctx, generation, table, doc)
      : [];
  const result = await replaceContribution(
    ctx,
    generation,
    table,
    sourceId,
    facts,
  );
  let writes = result.writes;
  if (!result.changed && !force) return { facts, writes };

  const seen = new Set<string>();
  for (const dependent of dependentsFromFacts([
    ...result.previousFacts,
    ...facts,
  ])) {
    const key = `${dependent.table}:${dependent.id}`;
    if (seen.has(key) || !maintainsTable(generation, dependent.table)) continue;
    seen.add(key);
    if (
      !(await getContribution(
        ctx,
        generation._id,
        dependent.table,
        dependent.id,
      ))
    )
      continue;
    budget.remaining -= 1;
    if (budget.remaining < 0) throw new ProjectionFanOutExceeded();
    writes += (
      await refreshSource(
        ctx,
        generation,
        dependent.table,
        dependent.id,
        budget,
        depth + 1,
        force,
      )
    ).writes;
  }
  return { facts, writes };
}

async function takeLimited<T>(
  query: { take(count: number): Promise<T[]> },
  limit: number,
) {
  const rows = await query.take(Math.max(limit, 0) + 1);
  if (rows.length > limit) throw new ProjectionFanOutExceeded();
  return rows;
}

async function refreshMany(
  ctx: Ctx,
  generation: ProjectionGeneration,
  table: ProjectionSource,
  ids: string[],
  budget: Budget,
) {
  for (const id of ids) {
    budget.remaining -= 1;
    if (budget.remaining < 0) throw new ProjectionFanOutExceeded();
    await refreshSource(ctx, generation, table, id, budget, 1);
  }
}

async function refreshObjectRelations(
  ctx: Ctx,
  generation: ProjectionGeneration,
  collectionId: Id<"collections">,
  budget: Budget,
) {
  const limit = budget.remaining;
  if (maintainsTable(generation, "loanItems")) {
    const rows = await takeLimited(
      ctx.db
        .query("loanItems")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId)),
      limit,
    );
    await refreshMany(
      ctx,
      generation,
      "loanItems",
      rows.map((row) => row._id),
      budget,
    );
  }
  if (maintainsTable(generation, "collectionGroupItems")) {
    const rows = await takeLimited(
      ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId)),
      limit,
    );
    await refreshMany(
      ctx,
      generation,
      "collectionGroupItems",
      rows.map((row) => row._id),
      budget,
    );
  }
  if (maintainsTable(generation, "accessions")) {
    const rows = await takeLimited(
      ctx.db
        .query("accessions")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId)),
      limit,
    );
    await refreshMany(
      ctx,
      generation,
      "accessions",
      rows.map((row) => row._id),
      budget,
    );
  }
  if (maintainsTable(generation, "deaccessions")) {
    const rows = await takeLimited(
      ctx.db
        .query("deaccessions")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId)),
      limit,
    );
    await refreshMany(
      ctx,
      generation,
      "deaccessions",
      rows.map((row) => row._id),
      budget,
    );
  }
}

async function applyFanOut(
  ctx: Ctx,
  generation: ProjectionGeneration,
  fanOut: ReturnType<typeof relationFanOut>[number],
  budget: Budget,
) {
  switch (fanOut.kind) {
    case "loanItemsByLoan": {
      if (!maintainsTable(generation, "loanItems")) return;
      const rows = await takeLimited(
        ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", fanOut.id)),
        budget.remaining,
      );
      await refreshMany(
        ctx,
        generation,
        "loanItems",
        rows.map((row) => row._id),
        budget,
      );
      return;
    }
    case "groupItemsByGroup": {
      if (!maintainsTable(generation, "collectionGroupItems")) return;
      const rows = await takeLimited(
        ctx.db
          .query("collectionGroupItems")
          .withIndex("by_collectionGroup", (q) =>
            q.eq("collectionGroupId", fanOut.id),
          ),
        budget.remaining,
      );
      await refreshMany(
        ctx,
        generation,
        "collectionGroupItems",
        rows.map((row) => row._id),
        budget,
      );
      return;
    }
    case "objectRelations":
      await refreshObjectRelations(ctx, generation, fanOut.id, budget);
      return;
    case "objectsByLocation": {
      if (fanOut.organizationId !== generation.organizationId) return;
      const rows = await takeLimited(
        ctx.db
          .query("collections")
          .withIndex("by_organization_and_location", (q) =>
            q
              .eq("organizationId", fanOut.organizationId)
              .eq("currentLocationId", fanOut.id),
          ),
        budget.remaining,
      );
      for (const row of rows) {
        await refreshMany(ctx, generation, "collections", [row._id], budget);
        await refreshObjectRelations(ctx, generation, row._id, budget);
      }
      return;
    }
  }
}

/**
 * Trigger entry point: runs inside the source mutation, so source and
 * projection changes commit or roll back together.
 */
export async function handleSourceChange(
  ctx: Ctx,
  table: ProjectionSource,
  sourceId: string,
  oldDoc: ProjectionSourceDoc | null,
  newDoc: ProjectionSourceDoc | null,
) {
  const organizations = new Set<Id<"organizations">>();
  for (const doc of [oldDoc, newDoc]) {
    if (!doc) continue;
    const organizationId = await sourceOrganization(ctx, table, doc);
    if (organizationId) organizations.add(organizationId);
  }
  const existing = await ctx.db
    .query("projectionContributions")
    .withIndex("by_sourceTable_and_sourceId", (q) =>
      q.eq("sourceTable", table).eq("sourceId", sourceId),
    )
    .take(16);
  for (const contribution of existing) {
    organizations.add(contribution.organizationId);
  }

  const fanOuts = relationFanOut(table, oldDoc, newDoc);
  for (const organizationId of organizations) {
    for (const generation of await maintainedGenerations(ctx, organizationId)) {
      const budget = { remaining: PROJECTION_FANOUT_LIMIT };
      try {
        await refreshSource(ctx, generation, table, sourceId, budget, 0);
        for (const fanOut of fanOuts) {
          await applyFanOut(ctx, generation, fanOut, budget);
        }
      } catch (error) {
        if (!(error instanceof ProjectionFanOutExceeded)) throw error;
        // Too wide to finish inside this write: refresh the rest in bounded
        // pages while readers keep serving the current generation as updating.
        await enqueueFanOut(ctx, generation, {
          kind: "source",
          sourceTable: table,
          targetId: sourceId,
        });
        for (const fanOut of fanOuts) {
          if (
            fanOut.kind === "objectsByLocation" &&
            fanOut.organizationId !== generation.organizationId
          )
            continue;
          await enqueueFanOut(ctx, generation, {
            kind: fanOut.kind,
            targetId: fanOut.id,
          });
        }
      }
    }
    await maintainHealth(ctx, organizationId);
  }
}

/**
 * Keeps metrics health current as records change, so nobody has to start
 * jobs by hand: an unavailable or outdated projection starts a rebuild unless
 * one is already running or awaiting retry, and a ready one schedules a
 * reconciliation.
 */
async function maintainHealth(ctx: Ctx, organizationId: Id<"organizations">) {
  const state = await getProjectionState(ctx, organizationId);
  // No state: never initialized or being purged; the rollout command builds it.
  if (!state || state.buildingGenerationId) return;
  if (
    state.availability !== "ready" ||
    state.definitionVersion !== PROJECTION_DEFINITION_VERSION
  ) {
    await startGeneration(ctx, organizationId, "rebuild");
    return;
  }
  await scheduleReconcile(ctx, state);
}

/**
 * Schedules one automatic reconciliation after a quiet period, and no sooner
 * than `RECONCILE_INTERVAL_MS` after the previous one finished. Changes made
 * while one is scheduled or running are covered by it.
 */
async function scheduleReconcile(
  ctx: Ctx,
  state: Doc<"organizationProjectionStates">,
) {
  if (state.reconcilingGenerationId || state.reconcileScheduledAt) return;
  const last = state.lastReconciliationId
    ? await ctx.db.get(state.lastReconciliationId)
    : null;
  const now = Date.now();
  const due = Math.max(
    now + RECONCILE_SETTLE_MS,
    (last?.finishedAt ?? 0) + RECONCILE_INTERVAL_MS,
  );
  await ctx.db.patch(state._id, { reconcileScheduledAt: due });
  await ctx.scheduler.runAfter(
    due - now,
    internal.projections.runScheduledReconcile,
    { organizationId: state.organizationId },
  );
}

/** Starts the scheduled reconciliation when the projection is still ready. */
export async function runScheduledReconcile(
  ctx: Ctx,
  organizationId: Id<"organizations">,
) {
  const state = await getProjectionState(ctx, organizationId);
  if (!state?.reconcileScheduledAt) return null;
  const blocked =
    !state.activeGenerationId ||
    state.availability !== "ready" ||
    state.definitionVersion !== PROJECTION_DEFINITION_VERSION ||
    state.buildingGenerationId !== undefined ||
    state.reconcilingGenerationId !== undefined;
  await ctx.db.patch(state._id, { reconcileScheduledAt: undefined });
  return blocked
    ? null
    : await startGeneration(ctx, organizationId, "reconcile");
}

type FanOutKind = Doc<"projectionFanOuts">["kind"];

/** Pending wide refreshes mean current values are served while still updating. */
export async function isProjectionUpdating(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  return (
    (await ctx.db
      .query("projectionFanOuts")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first()) !== null
  );
}

/**
 * Queues one wide refresh for a generation. Re-queuing the same refresh
 * restarts it from the beginning, because rows already visited may have been
 * computed from an older source state; the running continuation picks it up.
 */
async function enqueueFanOut(
  ctx: Ctx,
  generation: ProjectionGeneration,
  work: { kind: FanOutKind; targetId: string; sourceTable?: string },
) {
  const existing = await ctx.db
    .query("projectionFanOuts")
    .withIndex("by_generationId_and_kind_and_targetId", (q) =>
      q
        .eq("generationId", generation._id)
        .eq("kind", work.kind)
        .eq("targetId", work.targetId),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { step: 0, cursor: null });
    return;
  }
  const fanOutId = await ctx.db.insert("projectionFanOuts", {
    organizationId: generation.organizationId,
    generationId: generation._id,
    ...work,
    step: 0,
    cursor: null,
    enqueuedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.projections.continueFanOut, {
    fanOutId,
  });
}

const OBJECT_RELATION_TABLES = [
  "loanItems",
  "collectionGroupItems",
  "accessions",
  "deaccessions",
] as const;

/**
 * Refreshes one bounded page of a queued wide refresh. Every row is
 * recomputed from its current source with its own budget, so replaying a page
 * is harmless. Returns whether another page remains.
 */
export async function continueFanOutPage(
  ctx: Ctx,
  fanOutId: Id<"projectionFanOuts">,
) {
  const job = await ctx.db.get(fanOutId);
  if (!job) return "done" as const;
  const generation = await ctx.db.get(job.generationId);
  const maintained =
    generation !== null &&
    (await maintainedGenerations(ctx, job.organizationId)).some(
      (candidate) => candidate._id === generation._id,
    );
  if (!generation || !maintained) {
    await ctx.db.delete(job._id);
    return "done" as const;
  }
  const pageOptions = { numItems: PROJECTION_PAGE_SIZE, cursor: job.cursor };
  const refreshRow = async (table: ProjectionSource, id: string) =>
    await refreshSource(
      ctx,
      generation,
      table,
      id,
      { remaining: PROJECTION_FANOUT_LIMIT },
      1,
      true,
    );
  let next: { step: number; cursor: string | null } | null = null;
  try {
    switch (job.kind) {
      case "source": {
        if (phaseIndexOf(job.sourceTable ?? "") >= 0)
          await refreshSource(
            ctx,
            generation,
            job.sourceTable as ProjectionSource,
            job.targetId,
            { remaining: PROJECTION_FANOUT_LIMIT },
            0,
            true,
          );
        break;
      }
      case "loanItemsByLoan": {
        const loanId = ctx.db.normalizeId("loans", job.targetId);
        if (!loanId) break;
        const page = await ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", loanId))
          .paginate(pageOptions);
        for (const row of page.page) await refreshRow("loanItems", row._id);
        if (!page.isDone) next = { step: 0, cursor: page.continueCursor };
        break;
      }
      case "groupItemsByGroup": {
        const groupId = ctx.db.normalizeId("collectionGroups", job.targetId);
        if (!groupId) break;
        const page = await ctx.db
          .query("collectionGroupItems")
          .withIndex("by_collectionGroup", (q) =>
            q.eq("collectionGroupId", groupId),
          )
          .paginate(pageOptions);
        for (const row of page.page)
          await refreshRow("collectionGroupItems", row._id);
        if (!page.isDone) next = { step: 0, cursor: page.continueCursor };
        break;
      }
      case "objectsByLocation": {
        const locationId = ctx.db.normalizeId("locations", job.targetId);
        if (!locationId) break;
        const page = await ctx.db
          .query("collections")
          .withIndex("by_organization_and_location", (q) =>
            q
              .eq("organizationId", job.organizationId)
              .eq("currentLocationId", locationId),
          )
          .paginate(pageOptions);
        for (const row of page.page) {
          await refreshRow("collections", row._id);
          try {
            await refreshObjectRelations(ctx, generation, row._id, {
              remaining: PROJECTION_FANOUT_LIMIT,
            });
          } catch (error) {
            if (!(error instanceof ProjectionFanOutExceeded)) throw error;
            await enqueueFanOut(ctx, generation, {
              kind: "objectRelations",
              targetId: row._id,
            });
          }
        }
        if (!page.isDone) next = { step: 0, cursor: page.continueCursor };
        break;
      }
      case "objectRelations": {
        const collectionId = ctx.db.normalizeId("collections", job.targetId);
        const table = OBJECT_RELATION_TABLES[job.step];
        if (!collectionId || !table) break;
        const page = await ctx.db
          .query(table)
          .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
          .paginate(pageOptions);
        for (const row of page.page) await refreshRow(table, row._id);
        if (!page.isDone)
          next = { step: job.step, cursor: page.continueCursor };
        else if (job.step + 1 < OBJECT_RELATION_TABLES.length)
          next = { step: job.step + 1, cursor: null };
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof ProjectionFanOutExceeded)) throw error;
    await ctx.db.delete(job._id);
    await invalidateProjection(ctx, job.organizationId);
    return "done" as const;
  }
  if (!next) {
    await ctx.db.delete(job._id);
    return "done" as const;
  }
  await ctx.db.patch(job._id, next);
  return "continue" as const;
}

type TopLevelSource = Exclude<
  ProjectionSource,
  "loanItems" | "collectionGroupItems"
>;
type Scanner = (
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  after: number | null,
  limit: number,
) => Promise<ScanRow[]>;

function byOrganization<T extends TopLevelSource>(table: T): Scanner {
  return async (ctx, organizationId, after, limit) => {
    if (table === "organizationMoveRequests") {
      return await ctx.db
        .query("organizationMoveRequests")
        .withIndex("by_source_organization", (q) => {
          const base = q.eq("sourceOrganizationId", organizationId);
          return after === null ? base : base.gt("_creationTime", after);
        })
        .take(limit);
    }
    if (table === "exportJobs") {
      return await ctx.db
        .query("exportJobs")
        .withIndex("by_organizationId", (q) => {
          const base = q.eq("organizationId", organizationId);
          return after === null ? base : base.gt("_creationTime", after);
        })
        .take(limit);
    }
    return await ctx.db
      .query(
        table as Exclude<
          TopLevelSource,
          "organizationMoveRequests" | "exportJobs"
        >,
      )
      .withIndex("by_organization", (q) => {
        const base = q.eq("organizationId", organizationId);
        return after === null ? base : base.gt("_creationTime", after);
      })
      .take(limit);
  };
}

async function scanChildren(
  ctx: ReadCtx,
  table: "loanItems" | "collectionGroupItems",
  parentId: string,
  after: number | null,
  limit: number,
): Promise<ScanRow[]> {
  if (table === "loanItems") {
    const loanId = ctx.db.normalizeId("loans", parentId);
    if (!loanId) return [];
    return await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => {
        const base = q.eq("loanId", loanId);
        return after === null ? base : base.gt("_creationTime", after);
      })
      .take(limit);
  }
  const groupId = ctx.db.normalizeId("collectionGroups", parentId);
  if (!groupId) return [];
  return await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collectionGroup", (q) => {
      const base = q.eq("collectionGroupId", groupId);
      return after === null ? base : base.gt("_creationTime", after);
    })
    .take(limit);
}

interface PageStats {
  /** Source rows this page may scan; shrinks when a page hits a platform limit. */
  pageSize: number;
  rows: number;
  writes: number;
  discrepancies: number;
  mismatches: number;
}

async function recordDiscrepancy(
  ctx: Ctx,
  generation: ProjectionGeneration,
  stats: PageStats,
  entry: Omit<
    Doc<"projectionDiscrepancies">,
    "_id" | "_creationTime" | "organizationId" | "generationId" | "recordedAt"
  >,
) {
  const index = generation.discrepancyCount + stats.discrepancies;
  stats.discrepancies += 1;
  if (
    entry.category !== "source_quality" &&
    entry.category !== "legacy_counter_mismatch"
  ) {
    stats.mismatches += 1;
  }
  if (index >= PROJECTION_DISCREPANCY_ROW_LIMIT) return;
  await ctx.db.insert("projectionDiscrepancies", {
    ...entry,
    organizationId: generation.organizationId,
    generationId: generation._id,
    recordedAt: Date.now(),
  });
}

async function scanRow(
  ctx: Ctx,
  generation: ProjectionGeneration,
  table: ProjectionSource,
  row: ScanRow,
  stats: PageStats,
) {
  const result = await refreshSource(
    ctx,
    generation,
    table,
    row._id,
    { remaining: PROJECTION_FANOUT_LIMIT },
    0,
  );
  stats.rows += 1;
  stats.writes += result.writes;
  if (generation.mode !== "reconcile") return;
  for (const metric of new Set(
    result.facts.flatMap((fact) =>
      fact.metric.startsWith("quality.") ? [fact.metric] : [],
    ),
  )) {
    await recordDiscrepancy(ctx, generation, stats, {
      category: "source_quality",
      metric,
      expected: null,
      actual: null,
      sourceTable: table,
      sourceId: row._id,
      ...(generation.baselineGenerationId
        ? { baselineGenerationId: generation.baselineGenerationId }
        : {}),
    });
  }
}

type Progress = Pick<
  ProjectionGeneration,
  "phaseIndex" | "cursor" | "childParentId" | "childCursor"
>;

async function scanPhase(
  ctx: Ctx,
  generation: ProjectionGeneration,
  stats: PageStats,
): Promise<Progress> {
  const table = PROJECTION_PHASES[generation.phaseIndex] as ProjectionSource;
  const nextPhase = { phaseIndex: generation.phaseIndex + 1, cursor: null };
  const child = CHILD_PHASES[table];
  if (!child) {
    const rows = await byOrganization(table as TopLevelSource)(
      ctx,
      generation.organizationId,
      generation.cursor,
      stats.pageSize,
    );
    for (const row of rows) await scanRow(ctx, generation, table, row, stats);
    const last = rows.at(-1);
    return rows.length < stats.pageSize || !last
      ? nextPhase
      : { phaseIndex: generation.phaseIndex, cursor: last._creationTime };
  }

  let remaining = stats.pageSize;
  let cursor = generation.cursor;
  let parentId = generation.childParentId;
  let childCursor = generation.childCursor ?? null;
  const parentScanner = byOrganization(child.parent);
  while (remaining > 0) {
    if (!parentId) {
      const [parent] = await parentScanner(
        ctx,
        generation.organizationId,
        cursor,
        1,
      );
      if (!parent) return nextPhase;
      parentId = parent._id;
      cursor = parent._creationTime;
      childCursor = null;
      remaining -= 1;
    }
    const children = await scanChildren(
      ctx,
      child.table,
      parentId,
      childCursor,
      Math.max(remaining, 1),
    );
    for (const row of children) {
      await scanRow(ctx, generation, table, row, stats);
    }
    if (children.length < Math.max(remaining, 1)) {
      parentId = undefined;
      childCursor = null;
      remaining -= children.length;
    } else {
      childCursor = children.at(-1)?._creationTime ?? null;
      return {
        phaseIndex: generation.phaseIndex,
        cursor,
        childParentId: parentId,
        childCursor,
      };
    }
  }
  return {
    phaseIndex: generation.phaseIndex,
    cursor,
    childParentId: undefined,
    childCursor: undefined,
  };
}

function firstVectorDifference(
  expected: ProjectionFact[],
  actual: ProjectionFact[],
) {
  const sums = (facts: ProjectionFact[]) => {
    const values = new Map<string, number>();
    for (const fact of facts) {
      const key = `${fact.at === undefined ? "" : "@"}${fact.metric}\u0000${fact.scope}`;
      values.set(key, (values.get(key) ?? 0) + fact.value);
    }
    return values;
  };
  const left = sums(expected);
  const right = sums(actual);
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    if ((left.get(key) ?? 0) === (right.get(key) ?? 0)) continue;
    const [metric, scope] = key.split("\u0000");
    return {
      metric: metric ?? "",
      scope: scope ?? "",
      expected: left.get(key) ?? 0,
      actual: right.get(key) ?? 0,
    };
  }
  return { metric: "dated_order", scope: "all", expected: null, actual: null };
}

async function compareStep(
  ctx: Ctx,
  generation: ProjectionGeneration,
  stats: PageStats,
): Promise<Progress> {
  const step = COMPARE_STEPS[generation.phaseIndex - PROJECTION_PHASES.length];
  const baselineId = generation.baselineGenerationId;
  const nextStep = { phaseIndex: generation.phaseIndex + 1, cursor: null };
  if (!baselineId) return nextStep;
  const baseline = { baselineGenerationId: baselineId };
  const after = generation.cursor;
  const contributionPage = async (generationId: Id<"projectionGenerations">) =>
    await ctx.db
      .query("projectionContributions")
      .withIndex("by_generationId", (q) => {
        const base = q.eq("generationId", generationId);
        return after === null ? base : base.gt("_creationTime", after);
      })
      .take(stats.pageSize);
  const totalsPage = async (generationId: Id<"projectionGenerations">) =>
    await ctx.db
      .query("projectionTotals")
      .withIndex("by_generationId", (q) => {
        const base = q.eq("generationId", generationId);
        return after === null ? base : base.gt("_creationTime", after);
      })
      .take(stats.pageSize);
  const advance = (rows: ScanRow[]): Progress => {
    const last = rows.at(-1);
    return rows.length < stats.pageSize || !last
      ? nextStep
      : { phaseIndex: generation.phaseIndex, cursor: last._creationTime };
  };

  switch (step) {
    case "compare_source_vectors": {
      const rows = await contributionPage(generation._id);
      for (const row of rows) {
        stats.rows += 1;
        const projected = await getContribution(
          ctx,
          baselineId,
          row.sourceTable,
          row.sourceId,
        );
        if (!projected) {
          const first = row.facts[0];
          await recordDiscrepancy(ctx, generation, stats, {
            ...baseline,
            category: "missing_from_projection",
            metric: first?.metric,
            scope: first?.scope,
            expected: first?.value ?? null,
            actual: null,
            sourceTable: row.sourceTable,
            sourceId: row.sourceId,
          });
        } else if (!sameFacts(row.facts, projected.facts)) {
          await recordDiscrepancy(ctx, generation, stats, {
            ...baseline,
            category: "contribution_mismatch",
            ...firstVectorDifference(row.facts, projected.facts),
            sourceTable: row.sourceTable,
            sourceId: row.sourceId,
          });
        }
      }
      return advance(rows);
    }
    case "compare_projected_vectors": {
      const rows = await contributionPage(baselineId);
      for (const row of rows) {
        stats.rows += 1;
        if (
          await getContribution(
            ctx,
            generation._id,
            row.sourceTable,
            row.sourceId,
          )
        )
          continue;
        const first = row.facts[0];
        await recordDiscrepancy(ctx, generation, stats, {
          ...baseline,
          category: "stale_projection_entry",
          metric: first?.metric,
          scope: first?.scope,
          expected: null,
          actual: first?.value ?? null,
          sourceTable: row.sourceTable,
          sourceId: row.sourceId,
        });
      }
      return advance(rows);
    }
    case "compare_source_totals": {
      const rows = await totalsPage(generation._id);
      for (const row of rows) {
        stats.rows += 1;
        const projected = await ctx.db
          .query("projectionTotals")
          .withIndex("by_generationId_and_scope_and_partition", (q) =>
            q
              .eq("generationId", baselineId)
              .eq("scope", row.scope)
              .eq("partition", row.partition),
          )
          .unique();
        const keys = new Set([
          ...Object.keys(row.counts),
          ...Object.keys(projected?.counts ?? {}),
        ]);
        for (const key of keys) {
          const expected = row.counts[key] ?? 0;
          let actual = projected?.counts[key] ?? 0;
          if (key.startsWith("@") && expected === actual) {
            const baselineGeneration = await ctx.db.get(baselineId);
            actual = baselineGeneration
              ? await metricTree.sum(ctx, {
                  namespace: metricNamespace(
                    baselineGeneration,
                    row.scope,
                    key.slice(1),
                  ),
                })
              : 0;
          }
          if (expected === actual) continue;
          await recordDiscrepancy(ctx, generation, stats, {
            ...baseline,
            category: "counter_mismatch",
            metric: key,
            scope: row.scope,
            expected,
            actual,
          });
        }
      }
      return advance(rows);
    }
    case "compare_projected_totals": {
      const rows = await totalsPage(baselineId);
      for (const row of rows) {
        stats.rows += 1;
        const source = await ctx.db
          .query("projectionTotals")
          .withIndex("by_generationId_and_scope_and_partition", (q) =>
            q
              .eq("generationId", generation._id)
              .eq("scope", row.scope)
              .eq("partition", row.partition),
          )
          .unique();
        if (source) continue;
        for (const [key, actual] of Object.entries(row.counts)) {
          await recordDiscrepancy(ctx, generation, stats, {
            ...baseline,
            category: "counter_mismatch",
            metric: key,
            scope: row.scope,
            expected: 0,
            actual,
          });
        }
      }
      return advance(rows);
    }
    case "compare_legacy_usage": {
      const legacy = await getUsageCounter(ctx, generation.organizationId);
      if (legacy) {
        const totals = await readTotals(ctx, generation._id, "all");
        const pairs = [
          ["usage.objectCount", legacy.objectCount],
          ["usage.mediaFileCount", legacy.mediaFileCount],
          ["usage.mediaVersionCount", legacy.mediaVersionCount],
          ["usage.storageBytes", legacy.storageBytes],
        ] as const;
        for (const [metric, actual] of pairs) {
          const expected = totals[metric] ?? 0;
          if (expected === actual) continue;
          await recordDiscrepancy(ctx, generation, stats, {
            ...baseline,
            category: "legacy_counter_mismatch",
            metric,
            scope: "all",
            expected,
            actual,
            sourceTable: "organizationUsageCounters",
            sourceId: legacy._id,
          });
        }
      }
      return nextStep;
    }
    default:
      return nextStep;
  }
}

async function finishGeneration(ctx: Ctx, generation: ProjectionGeneration) {
  const state = await getProjectionState(ctx, generation.organizationId);
  if (!state) return;
  const now = Date.now();
  if (generation.mode === "reconcile") {
    await ctx.db.patch(generation._id, {
      status: "completed",
      finishedAt: now,
    });
    await ctx.db.patch(state._id, {
      reconcilingGenerationId: undefined,
      lastReconciliationId: generation._id,
      ...(generation.mismatchCount === 0 ? { lastVerifiedAt: now } : {}),
    });
    await ctx.scheduler.runAfter(0, internal.projections.collectGeneration, {
      generationId: generation._id,
    });
    return;
  }
  const previous = state.activeGenerationId
    ? await ctx.db.get(state.activeGenerationId)
    : null;
  if (previous && previous._id !== generation._id) {
    await stopGeneration(ctx, previous, "superseded");
  }
  const reconciling = state.reconcilingGenerationId
    ? await ctx.db.get(state.reconcilingGenerationId)
    : null;
  if (reconciling) {
    await stopGeneration(
      ctx,
      reconciling,
      "cancelled",
      "Baseline was replaced",
    );
  }
  await ctx.db.patch(generation._id, { status: "completed", finishedAt: now });
  await ctx.db.patch(state._id, {
    activeGenerationId: generation._id,
    buildingGenerationId: undefined,
    reconcilingGenerationId: undefined,
    availability: "ready",
    reason: undefined,
    definitionVersion: generation.definitionVersion,
    lastBuiltAt: now,
  });
}

/**
 * Applies one checkpoint page. A stale or replayed continuation (wrong
 * checkpoint, not building, or superseded revision) is a no-op.
 */
export async function applyGenerationPage(
  ctx: Ctx,
  generationId: Id<"projectionGenerations">,
  expectedCheckpoint: number,
  pageSize = PROJECTION_PAGE_SIZE,
) {
  const generation = await ctx.db.get(generationId);
  if (
    !generation ||
    generation.status !== "building" ||
    generation.checkpoint !== expectedCheckpoint
  ) {
    return "noop" as const;
  }
  const state = await getProjectionState(ctx, generation.organizationId);
  const pointer =
    generation.mode === "rebuild"
      ? state?.buildingGenerationId
      : state?.reconcilingGenerationId;
  const baselineMoved =
    generation.mode === "reconcile" &&
    (state?.availability !== "ready" ||
      state.activeGenerationId !== generation.baselineGenerationId);
  if (
    !state ||
    pointer !== generation._id ||
    state.revision !== generation.revision ||
    baselineMoved
  ) {
    await stopGeneration(
      ctx,
      generation,
      "cancelled",
      "Superseded continuation",
    );
    if (state && pointer === generation._id) {
      await ctx.db.patch(
        state._id,
        generation.mode === "rebuild"
          ? { buildingGenerationId: undefined }
          : { reconcilingGenerationId: undefined },
      );
    }
    return "noop" as const;
  }

  const lastStep =
    generation.mode === "reconcile"
      ? PROJECTION_STEPS.length
      : PROJECTION_PHASES.length;
  if (generation.phaseIndex >= lastStep) {
    await finishGeneration(ctx, generation);
    return "done" as const;
  }

  if (
    generation.phaseIndex >= PROJECTION_PHASES.length &&
    (await isProjectionUpdating(ctx, generation.organizationId))
  ) {
    // Comparing while wide refreshes are pending would report their
    // in-flight rows as discrepancies; retry the same checkpoint later.
    await ctx.scheduler.runAfter(
      FAN_OUT_WAIT_MS,
      internal.projections.advanceGeneration,
      { generationId, expectedCheckpoint },
    );
    return "continue" as const;
  }
  const stats: PageStats = {
    pageSize,
    rows: 0,
    writes: 0,
    discrepancies: 0,
    mismatches: 0,
  };
  const progress =
    generation.phaseIndex < PROJECTION_PHASES.length
      ? await scanPhase(ctx, generation, stats)
      : await compareStep(ctx, generation, stats);
  const checkpoint = generation.checkpoint + 1;
  await ctx.db.patch(generation._id, {
    phaseIndex: progress.phaseIndex,
    cursor: progress.cursor,
    childParentId: progress.childParentId,
    childCursor: progress.childCursor,
    checkpoint,
    processedRows: generation.processedRows + stats.rows,
    maxPageRows: Math.max(generation.maxPageRows, stats.rows),
    maxPageWrites: Math.max(generation.maxPageWrites, stats.writes),
    totalWrites: generation.totalWrites + stats.writes,
    discrepancyCount: generation.discrepancyCount + stats.discrepancies,
    mismatchCount: generation.mismatchCount + stats.mismatches,
  });
  await ctx.scheduler.runAfter(0, internal.projections.advanceGeneration, {
    generationId,
    expectedCheckpoint: checkpoint,
  });
  return "continue" as const;
}

export async function markGenerationFailed(
  ctx: Ctx,
  generationId: Id<"projectionGenerations">,
  expectedCheckpoint: number,
  failure: string,
) {
  const generation = await ctx.db.get(generationId);
  if (
    !generation ||
    generation.status !== "building" ||
    generation.checkpoint !== expectedCheckpoint
  ) {
    return;
  }
  await ctx.db.patch(generationId, {
    status: "failed",
    failure: failure.slice(0, 500),
    finishedAt: Date.now(),
  });
  if (generation.attempts < PROJECTION_AUTO_ATTEMPTS) {
    await ctx.scheduler.runAfter(
      RETRY_BASE_DELAY_MS * 2 ** (generation.attempts - 1),
      internal.projections.autoRetryGeneration,
      { generationId, attempts: generation.attempts },
    );
  }
  const state = await getProjectionState(ctx, generation.organizationId);
  if (
    state &&
    state.availability === "unavailable" &&
    generation.mode === "rebuild"
  ) {
    await ctx.db.patch(state._id, {
      reason: state.reason === "invalidated" ? "invalidated" : "rebuild_failed",
    });
  }
}

export async function retryGeneration(
  ctx: Ctx,
  generation: ProjectionGeneration,
) {
  await ctx.db.patch(generation._id, {
    status: "building",
    failure: undefined,
    finishedAt: undefined,
    attempts: generation.attempts + 1,
  });
  const state = await getProjectionState(ctx, generation.organizationId);
  if (state?.reason === "rebuild_failed") {
    await ctx.db.patch(state._id, { reason: "building" });
  }
  await ctx.scheduler.runAfter(0, internal.projections.advanceGeneration, {
    generationId: generation._id,
    expectedCheckpoint: generation.checkpoint,
  });
}

export async function cancelGeneration(
  ctx: Ctx,
  generation: ProjectionGeneration,
) {
  const state = await getProjectionState(ctx, generation.organizationId);
  await stopGeneration(
    ctx,
    generation,
    "cancelled",
    "Cancelled by an administrator",
  );
  if (!state) return;
  if (state.buildingGenerationId === generation._id) {
    await ctx.db.patch(state._id, {
      buildingGenerationId: undefined,
      ...(state.availability === "unavailable" &&
      (state.reason === "building" || state.reason === "rebuild_failed")
        ? { reason: state.activeGenerationId ? "invalidated" : "not_built" }
        : {}),
    });
  }
  if (state.reconcilingGenerationId === generation._id) {
    await ctx.db.patch(state._id, { reconcilingGenerationId: undefined });
  }
}

/**
 * Deletes one bounded page of a retired generation's projection data. The
 * generation document and its discrepancies remain as review evidence.
 */
export async function collectGenerationPage(
  ctx: Ctx,
  generationId: Id<"projectionGenerations">,
) {
  const generation = await ctx.db.get(generationId);
  if (!generation || generation.collectedAt !== undefined)
    return "done" as const;
  const retired =
    generation.status === "superseded" ||
    generation.status === "cancelled" ||
    (generation.status === "completed" && generation.mode === "reconcile");
  const state = await getProjectionState(ctx, generation.organizationId);
  const referenced =
    state?.activeGenerationId === generationId ||
    state?.buildingGenerationId === generationId ||
    state?.reconcilingGenerationId === generationId;
  if (!retired || referenced) return "done" as const;

  const contributions = await ctx.db
    .query("projectionContributions")
    .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
    .take(PROJECTION_PAGE_SIZE);
  for (const contribution of contributions) {
    for (const entry of datedEntries(
      generation,
      contribution.sourceTable,
      contribution.sourceId,
      contribution.facts,
    ).values()) {
      await metricTree.deleteIfExists(ctx, {
        namespace: entry.namespace,
        key: entry.key,
        id: entry.id,
      });
    }
    await ctx.db.delete(contribution._id);
  }
  if (contributions.length > 0) return "continue" as const;

  const totals = await ctx.db
    .query("projectionTotals")
    .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
    .take(PROJECTION_PAGE_SIZE);
  for (const row of totals) await ctx.db.delete(row._id);
  if (totals.length > 0) return "continue" as const;
  await ctx.db.patch(generationId, { collectedAt: Date.now() });
  if (state && generation.metricSlot !== undefined)
    await ctx.db.patch(state._id, {
      metricSlotsInUse: (state.metricSlotsInUse ?? []).filter(
        (slot) => slot !== generation.metricSlot,
      ),
    });
  return "done" as const;
}
