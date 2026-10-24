import { v } from "convex/values";

export const projectionAvailability = v.union(
  v.literal("ready"),
  v.literal("unavailable"),
);

export const projectionUnavailableReason = v.union(
  v.literal("not_built"),
  v.literal("building"),
  v.literal("invalidated"),
  v.literal("definition_changed"),
  v.literal("rebuild_failed"),
);

export const projectionGenerationStatus = v.union(
  v.literal("building"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("completed"),
  v.literal("superseded"),
);

export const projectionFanOutKind = v.union(
  v.literal("source"),
  v.literal("loanItemsByLoan"),
  v.literal("objectRelations"),
  v.literal("objectsByLocation"),
  v.literal("groupItemsByGroup"),
);

export const projectionMode = v.union(
  v.literal("rebuild"),
  v.literal("reconcile"),
);

export const projectionFact = v.object({
  metric: v.string(),
  scope: v.string(),
  value: v.number(),
  at: v.optional(v.number()),
  order: v.optional(v.number()),
});

export const projectionGenerationFields = {
  organizationId: v.id("organizations"),
  mode: projectionMode,
  status: projectionGenerationStatus,
  definitionVersion: v.number(),
  revision: v.number(),
  phaseIndex: v.number(),
  cursor: v.union(v.number(), v.null()),
  childParentId: v.optional(v.string()),
  childCursor: v.optional(v.union(v.number(), v.null())),
  checkpoint: v.number(),
  attempts: v.number(),
  processedRows: v.number(),
  maxPageRows: v.number(),
  maxPageWrites: v.number(),
  totalWrites: v.number(),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  failure: v.optional(v.string()),
  requestedBy: v.optional(v.id("users")),
  baselineGenerationId: v.optional(v.id("projectionGenerations")),
  discrepancyCount: v.number(),
  mismatchCount: v.number(),
  collectedAt: v.optional(v.number()),
  metricSlot: v.optional(v.number()),
  skipsMetricTree: v.optional(v.boolean()),
};

export const projectionDiscrepancyCategory = v.union(
  v.literal("contribution_mismatch"),
  v.literal("missing_from_projection"),
  v.literal("stale_projection_entry"),
  v.literal("counter_mismatch"),
  v.literal("legacy_counter_mismatch"),
  v.literal("source_quality"),
);

export const projectionDiscrepancyFields = {
  organizationId: v.id("organizations"),
  generationId: v.id("projectionGenerations"),
  baselineGenerationId: v.optional(v.id("projectionGenerations")),
  category: projectionDiscrepancyCategory,
  metric: v.optional(v.string()),
  scope: v.optional(v.string()),
  expected: v.union(v.number(), v.null()),
  actual: v.union(v.number(), v.null()),
  sourceTable: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  recordedAt: v.number(),
};

export const projectionUnavailableResult = v.object({
  availability: v.literal("unavailable"),
  reason: projectionUnavailableReason,
  definitionVersion: v.number(),
});
