import { ConvexError, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getProjectionState } from "./projectionMaintenance";
import {
  type MetricKey,
  type MetricRange,
  metricNamespace,
  metricTree,
  PROJECTION_DEFINITION_VERSION,
  readTotals,
  sumMetricRanges,
} from "./projectionStore";
import type { projectionUnavailableResult } from "./projectionValidators";

/** Maximum time buckets one trend read may request. */
export const PROJECTION_MAX_BUCKETS = 400;

export type ProjectionUnavailable = Infer<typeof projectionUnavailableResult>;
type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;

export interface RankedScope {
  scope: string;
  id: string;
  rank: number;
  counts: Record<string, number>;
}

export interface ProjectionReader {
  generationId: Id<"projectionGenerations">;
  totals: (scope?: string) => Promise<Record<string, number>>;
  sums: (
    metric: string,
    ranges: MetricRange[],
    scope?: string,
  ) => Promise<number[]>;
  /** Sums one dated metric over the same range in each scope. */
  sumsAcross: (
    metric: string,
    scopes: string[],
    range: MetricRange,
  ) => Promise<number[]>;
  /**
   * Single-partition scopes of one category ordered by rank. Returns at most
   * `limit` rows and reports whether more exist.
   */
  ranked: (
    category: string,
    options: {
      order: "asc" | "desc";
      limit: number;
      lower?: number;
      upperExclusive?: number;
    },
  ) => Promise<{ rows: RankedScope[]; complete: boolean }>;
}

export type ProjectionOpenResult =
  | { ok: true; reader: ProjectionReader }
  | { ok: false; unavailable: ProjectionUnavailable };

/**
 * Opens the organization's active projection. A missing, building, invalidated
 * or outdated projection is reported as unavailable; readers never fall back
 * to scanning sources or report partial data as zero.
 */
export async function openProjection(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
): Promise<ProjectionOpenResult> {
  const state = await getProjectionState(ctx, organizationId);
  const unavailable = (reason: ProjectionUnavailable["reason"]) => ({
    ok: false as const,
    unavailable: {
      availability: "unavailable" as const,
      reason,
      definitionVersion: PROJECTION_DEFINITION_VERSION,
    },
  });
  if (!state) return unavailable("not_built");
  if (state.definitionVersion !== PROJECTION_DEFINITION_VERSION) {
    return unavailable("definition_changed");
  }
  if (state.availability !== "ready" || !state.activeGenerationId) {
    return unavailable(state.reason ?? "not_built");
  }
  const generationId = state.activeGenerationId;
  const generation = await ctx.db.get(generationId);
  if (!generation) return unavailable("not_built");
  return {
    ok: true,
    reader: {
      generationId,
      totals: (scope = "all") => readTotals(ctx, generationId, scope),
      sums: (metric, ranges, scope = "all") =>
        sumMetricRanges(ctx, generation, scope, metric, ranges),
      sumsAcross: async (metric, scopes, range) =>
        scopes.length === 0
          ? []
          : await metricTree.sumBatch(
              ctx,
              scopes.map((scope) => ({
                namespace: metricNamespace(generation, scope, metric),
                bounds: range,
              })),
            ),
      ranked: async (category, options) => {
        const docs = await ctx.db
          .query("projectionTotals")
          .withIndex("by_generationId_and_category_and_rank", (q) => {
            const base = q
              .eq("generationId", generationId)
              .eq("category", category);
            if (
              options.lower !== undefined &&
              options.upperExclusive !== undefined
            ) {
              return base
                .gte("rank", options.lower)
                .lt("rank", options.upperExclusive);
            }
            if (options.lower !== undefined)
              return base.gte("rank", options.lower);
            if (options.upperExclusive !== undefined) {
              return base.lt("rank", options.upperExclusive);
            }
            return base;
          })
          .order(options.order)
          .take(options.limit + 1);
        return {
          complete: docs.length <= options.limit,
          rows: docs.slice(0, options.limit).map((doc) => ({
            scope: doc.scope,
            id: doc.scope.slice(category.length + 1),
            rank: doc.rank,
            counts: doc.counts,
          })),
        };
      },
    },
  };
}

/** Throws a structured error for callers whose contract has no unavailable value. */
export async function requireProjection(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  const result = await openProjection(ctx, organizationId);
  if (!result.ok) {
    throw new ConvexError({
      code: "PROJECTION_UNAVAILABLE",
      reason: result.unavailable.reason,
      message:
        "Organization metrics are unavailable until the projection is rebuilt",
    });
  }
  return result.reader;
}

const key = (at: number, order: 0 | 1): MetricKey => [at, order];

/** Entries with `at < time`. */
export const before = (time: number): MetricRange => ({
  upper: { key: key(time, 0), inclusive: false },
});

/** Entries with `at <= time`. */
export const atOrBefore = (time: number): MetricRange => ({
  upper: { key: key(time, 1), inclusive: true },
});

/** Entries with `start <= at < end`. */
export const between = (start: number, end: number): MetricRange => ({
  lower: { key: key(start, 0), inclusive: true },
  upper: { key: key(end, 0), inclusive: false },
});

/** Entries with `start <= at <= end`. */
export const inclusive = (start: number, end: number): MetricRange => ({
  lower: { key: key(start, 0), inclusive: true },
  upper: { key: key(end, 1), inclusive: true },
});

/** Entries with `at >= time`. */
export const atOrAfter = (time: number): MetricRange => ({
  lower: { key: key(time, 0), inclusive: true },
});

/** Entries keyed at or before `[time, 0]`; used by signed interval series. */
export const throughStartOf = (time: number): MetricRange => ({
  upper: { key: key(time, 0), inclusive: true },
});

export const ALL_TIME: MetricRange = {};

export function assertBucketCount(count: number) {
  if (count > PROJECTION_MAX_BUCKETS) {
    throw new ConvexError(
      `Requested ${count} buckets; narrow the range to at most ${PROJECTION_MAX_BUCKETS}`,
    );
  }
}

export function metric(totals: Record<string, number>, name: string) {
  return totals[name] ?? 0;
}
