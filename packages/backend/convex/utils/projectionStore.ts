import { DirectAggregate } from "@convex-dev/aggregate";
import type { Infer } from "convex/values";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { projectionFact } from "./projectionValidators";

export const PROJECTION_DEFINITION_VERSION = 1;

export type ProjectionFact = Infer<typeof projectionFact>;
export type ProjectionGeneration = Doc<"projectionGenerations">;
export type MetricKey = [number, number];

type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;
type WriteCtx = Pick<MutationCtx, "db" | "runQuery" | "runMutation">;

export const metricTree = new DirectAggregate<{
  Key: MetricKey;
  Id: string;
  Namespace: string;
}>(components.metrics);

export function metricNamespace(
  generationId: Id<"projectionGenerations">,
  scope: string,
  metric: string,
) {
  return `${generationId}|${scope}|${metric}`;
}

/**
 * Scopes that receive writes from many source tables are partitioned by
 * source table so unrelated writers do not contend on one document.
 */
export function totalsPartition(scope: string, sourceTable: string) {
  return scope === "all" || scope.startsWith("site:") ? sourceTable : "";
}

function scopeCategory(scope: string) {
  if (scope.startsWith("d|")) return "distinct";
  const separator = scope.indexOf(":");
  return separator === -1 ? scope : scope.slice(0, separator);
}

function scopeRank(category: string, counts: Record<string, number>) {
  if (category === "location") {
    const capacity = counts.capacity ?? 0;
    return capacity > 0 ? (counts.occupied ?? 0) / capacity : -1;
  }
  if (category === "auditType" || category === "auditUser") {
    return counts.total ?? 0;
  }
  return 0;
}

/**
 * A distinct scope is `d|<parentScope>|<metric>=<value>,...|<memberId>`.
 * The parent receives the payload once while at least one reference exists.
 */
export function distinctScope(
  parentScope: string,
  payload: Record<string, number>,
  memberId: string,
) {
  const encoded = Object.entries(payload)
    .map(([metric, value]) => `${metric}=${value}`)
    .join(",");
  return `d|${parentScope}|${encoded}|${memberId}`;
}

function parseDistinctScope(scope: string) {
  const [, parentScope, encoded] = scope.split("|");
  if (parentScope === undefined || encoded === undefined) return null;
  const payload: Record<string, number> = {};
  for (const part of encoded.split(",")) {
    const separator = part.lastIndexOf("=");
    if (separator <= 0) continue;
    payload[part.slice(0, separator)] = Number(part.slice(separator + 1));
  }
  return { parentScope, payload };
}

export async function readTotals(
  ctx: Pick<QueryCtx, "db">,
  generationId: Id<"projectionGenerations">,
  scope: string,
) {
  const docs = await ctx.db
    .query("projectionTotals")
    .withIndex("by_generationId_and_scope_and_partition", (q) =>
      q.eq("generationId", generationId).eq("scope", scope),
    )
    .take(64);
  const counts: Record<string, number> = {};
  for (const doc of docs) {
    for (const [metric, value] of Object.entries(doc.counts)) {
      counts[metric] = (counts[metric] ?? 0) + value;
    }
  }
  return counts;
}

async function applyTotalsDelta(
  ctx: WriteCtx,
  generation: ProjectionGeneration,
  scope: string,
  partition: string,
  deltas: Record<string, number>,
): Promise<number> {
  const existing = await ctx.db
    .query("projectionTotals")
    .withIndex("by_generationId_and_scope_and_partition", (q) =>
      q
        .eq("generationId", generation._id)
        .eq("scope", scope)
        .eq("partition", partition),
    )
    .unique();
  const counts = { ...(existing?.counts ?? {}) };
  for (const [metric, delta] of Object.entries(deltas)) {
    const next = (counts[metric] ?? 0) + delta;
    if (next === 0) delete counts[metric];
    else counts[metric] = next;
  }
  const category = scopeCategory(scope);
  let writes = 1;
  if (Object.keys(counts).length === 0) {
    if (existing) await ctx.db.delete(existing._id);
  } else if (existing) {
    await ctx.db.patch(existing._id, {
      counts,
      rank: scopeRank(category, counts),
    });
  } else {
    await ctx.db.insert("projectionTotals", {
      organizationId: generation.organizationId,
      generationId: generation._id,
      scope,
      partition,
      category,
      rank: scopeRank(category, counts),
      counts,
    });
  }

  if (category === "distinct") {
    const before = existing?.counts.refs ?? 0;
    const after = counts.refs ?? 0;
    const parsed = parseDistinctScope(scope);
    if (parsed && before > 0 !== after > 0) {
      const sign = after > 0 ? 1 : -1;
      const parentDeltas: Record<string, number> = {};
      for (const [metric, value] of Object.entries(parsed.payload)) {
        parentDeltas[metric] = sign * value;
      }
      writes += await applyTotalsDelta(
        ctx,
        generation,
        parsed.parentScope,
        totalsPartition(parsed.parentScope, "distinct"),
        parentDeltas,
      );
    }
  }
  return writes;
}

interface DatedEntry {
  namespace: string;
  id: string;
  key: MetricKey;
  value: number;
}

export function datedEntries(
  generationId: Id<"projectionGenerations">,
  sourceTable: string,
  sourceId: string,
  facts: ProjectionFact[],
) {
  const entries = new Map<string, DatedEntry>();
  const occurrences = new Map<string, number>();
  for (const fact of facts) {
    if (fact.at === undefined) continue;
    const namespace = metricNamespace(generationId, fact.scope, fact.metric);
    const occurrence = occurrences.get(namespace) ?? 0;
    occurrences.set(namespace, occurrence + 1);
    const id = `${sourceTable}:${sourceId}:${occurrence}`;
    entries.set(`${namespace}#${id}`, {
      namespace,
      id,
      key: [fact.at, fact.order ?? 0],
      value: fact.value,
    });
  }
  return entries;
}

function totalsDeltas(
  sourceTable: string,
  facts: ProjectionFact[],
  sign: 1 | -1,
  into: Map<string, Record<string, number>>,
) {
  for (const fact of facts) {
    const partition = totalsPartition(fact.scope, sourceTable);
    const key = `${partition}\u0000${fact.scope}`;
    const deltas = into.get(key) ?? {};
    const metric = fact.at === undefined ? fact.metric : `@${fact.metric}`;
    deltas[metric] = (deltas[metric] ?? 0) + sign * fact.value;
    into.set(key, deltas);
  }
}

export async function getContribution(
  ctx: Pick<QueryCtx, "db">,
  generationId: Id<"projectionGenerations">,
  sourceTable: string,
  sourceId: string,
) {
  return await ctx.db
    .query("projectionContributions")
    .withIndex("by_generationId_and_sourceTable_and_sourceId", (q) =>
      q
        .eq("generationId", generationId)
        .eq("sourceTable", sourceTable)
        .eq("sourceId", sourceId),
    )
    .unique();
}

export function sameFacts(left: ProjectionFact[], right: ProjectionFact[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Atomically replaces the contribution vector of one source row in one
 * generation. Replaying the same vector is a no-op.
 */
export async function replaceContribution(
  ctx: WriteCtx,
  generation: ProjectionGeneration,
  sourceTable: string,
  sourceId: string,
  facts: ProjectionFact[],
) {
  const previous = await getContribution(
    ctx,
    generation._id,
    sourceTable,
    sourceId,
  );
  const previousFacts = previous?.facts ?? [];
  if (sameFacts(previousFacts, facts)) {
    return { changed: false, previousFacts, writes: 0 };
  }

  let writes = 1;
  const oldEntries = datedEntries(
    generation._id,
    sourceTable,
    sourceId,
    previousFacts,
  );
  const newEntries = datedEntries(generation._id, sourceTable, sourceId, facts);
  for (const [entryKey, entry] of oldEntries) {
    const replacement = newEntries.get(entryKey);
    if (
      replacement &&
      replacement.key[0] === entry.key[0] &&
      replacement.key[1] === entry.key[1] &&
      replacement.value === entry.value
    ) {
      newEntries.delete(entryKey);
      continue;
    }
    await metricTree.deleteIfExists(ctx, {
      namespace: entry.namespace,
      key: entry.key,
      id: entry.id,
    });
    writes += 1;
  }
  for (const entry of newEntries.values()) {
    await metricTree.insertIfDoesNotExist(ctx, {
      namespace: entry.namespace,
      key: entry.key,
      id: entry.id,
      sumValue: entry.value,
    });
    writes += 1;
  }

  const deltas = new Map<string, Record<string, number>>();
  totalsDeltas(sourceTable, previousFacts, -1, deltas);
  totalsDeltas(sourceTable, facts, 1, deltas);
  for (const [key, delta] of deltas) {
    const separator = key.indexOf("\u0000");
    const partition = key.slice(0, separator);
    const scope = key.slice(separator + 1);
    if (Object.values(delta).every((value) => value === 0)) continue;
    writes += await applyTotalsDelta(ctx, generation, scope, partition, delta);
  }

  if (facts.length === 0) {
    if (previous) await ctx.db.delete(previous._id);
  } else if (previous) {
    await ctx.db.patch(previous._id, { facts });
  } else {
    await ctx.db.insert("projectionContributions", {
      organizationId: generation.organizationId,
      generationId: generation._id,
      sourceTable,
      sourceId,
      facts,
    });
  }
  return { changed: true, previousFacts, writes };
}

export interface MetricRange {
  lower?: { key: MetricKey; inclusive: boolean };
  upper?: { key: MetricKey; inclusive: boolean };
}

export async function sumMetricRanges(
  ctx: ReadCtx,
  generationId: Id<"projectionGenerations">,
  scope: string,
  metric: string,
  ranges: MetricRange[],
) {
  if (ranges.length === 0) return [];
  const namespace = metricNamespace(generationId, scope, metric);
  return await metricTree.sumBatch(
    ctx,
    ranges.map((bounds) => ({ namespace, bounds })),
  );
}
