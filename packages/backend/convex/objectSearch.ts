import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import type { OptionUsageKind } from "./utils/collectionOptionUsages";
import { internalMutation } from "./utils/mutationBuilders";
import {
  OBJECT_SEARCH_DOCUMENT_VERSION,
  syncObjectSearchDocument,
} from "./utils/objectSearchDocuments";
import { requirePermission } from "./utils/permissions";

/** Objects written per backfill page. */
const BACKFILL_PAGE_SIZE = 50;
/** Organizations considered per page of a cron run. */
const ORGANIZATIONS_PER_PAGE = 200;
/** A backfill that reported nothing for this long is started again. */
const BACKFILL_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
/**
 * A run in progress reports at most this often: every searching list reads
 * the backfill row for readiness, so each write re-runs them all.
 */
const BACKFILL_HEARTBEAT_MS = 10 * 60 * 1000;
/** Distinct values offered per facet; each costs one indexed read. */
const FACET_VALUE_LIMIT = 100;
/** Option list rows read to label facet values as staff spelled them. */
const OPTION_ROWS_READ = 500;

const facetValueValidator = v.object({
  /** The value as filtered: trimmed and case-folded. */
  value: v.string(),
  /** The value as staff recorded it. */
  label: v.string(),
});

type FacetValue = Infer<typeof facetValueValidator>;

/**
 * The distinct values of an indexed field, one indexed read per value: each
 * read asks for the first row after the last value seen.
 */
async function distinctValues(
  nextAfter: (after: string) => Promise<FacetValue | null>,
): Promise<FacetValue[]> {
  const values: FacetValue[] = [];
  let after = "";
  while (values.length < FACET_VALUE_LIMIT) {
    const next = await nextAfter(after);
    if (!next) break;
    values.push(next);
    after = next.value;
  }
  return values;
}

function documentFacet(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  field: "culture" | "period",
) {
  const index =
    field === "culture"
      ? "by_organization_and_culture"
      : "by_organization_and_period";
  return distinctValues(async (after) => {
    const row = await ctx.db
      .query("objectSearchDocuments")
      .withIndex(index, (q) =>
        q.eq("organizationId", organizationId).gt(field, after),
      )
      .first();
    const value = row?.[field];
    if (!row || value === undefined) return null;
    const label =
      field === "culture"
        ? (row.cultureLabel ?? value)
        : (row.periodLabel ?? value);
    return { value, label };
  });
}

/**
 * Values used on records, labelled from the Organization's option list when
 * one spells the value; otherwise as folded.
 */
async function usageFacet(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  kind: Exclude<OptionUsageKind, "donor">,
) {
  const table =
    kind === "condition"
      ? "conditionOptions"
      : kind === "material"
        ? "materialOptions"
        : "typeOptions";
  const options: Array<{ name: string }> = await ctx.db
    .query(table)
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(OPTION_ROWS_READ);
  const labels = new Map(
    options.map((option) => [option.name.trim().toLowerCase(), option.name]),
  );
  return distinctValues(async (after) => {
    const row = await ctx.db
      .query("collectionOptionUsages")
      .withIndex("by_organization_kind_and_value", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("kind", kind)
          .gt("value", after),
      )
      .first();
    if (!row) return null;
    return { value: row.value, label: labels.get(row.value) ?? row.value };
  });
}

/** The values the Object Catalog's facet filters offer, from the records. */
export const facetValues = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    cultures: v.array(facetValueValidator),
    periods: v.array(facetValueValidator),
    conditions: v.array(facetValueValidator),
    materials: v.array(facetValueValidator),
    objectTypes: v.array(facetValueValidator),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const [cultures, periods, conditions, materials, objectTypes] =
      await Promise.all([
        documentFacet(ctx, args.organizationId, "culture"),
        documentFacet(ctx, args.organizationId, "period"),
        usageFacet(ctx, args.organizationId, "condition"),
        usageFacet(ctx, args.organizationId, "material"),
        usageFacet(ctx, args.organizationId, "type"),
      ]);
    return { cultures, periods, conditions, materials, objectTypes };
  },
});

async function backfillState(
  ctx: Pick<MutationCtx, "db">,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("objectSearchBackfills")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
}

/** Writes one page of an Organization's documents and schedules the next. */
export const backfillPage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // A purge may remove the Organization while a run is in flight.
    if ((await ctx.db.get(args.organizationId)) === null) return null;
    const state = await backfillState(ctx, args.organizationId);
    const now = Date.now();
    if (state && state.version !== OBJECT_SEARCH_DOCUMENT_VERSION) {
      // Begun under an older document version, so its earlier pages hold old
      // documents: the run starts again from the first page.
      await ctx.db.replace(state._id, {
        organizationId: args.organizationId,
        version: OBJECT_SEARCH_DOCUMENT_VERSION,
        startedAt: now,
        completedAt: undefined,
      });
      await ctx.scheduler.runAfter(0, internal.objectSearch.backfillPage, {
        organizationId: args.organizationId,
        cursor: null,
      });
      return null;
    }
    const page = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({ numItems: BACKFILL_PAGE_SIZE, cursor: args.cursor });
    for (const collection of page.page) {
      await syncObjectSearchDocument(ctx, collection);
    }
    if (page.isDone) {
      const completed = {
        organizationId: args.organizationId,
        version: OBJECT_SEARCH_DOCUMENT_VERSION,
        startedAt: state?.startedAt ?? now,
        completedAt: now,
      };
      if (state) {
        await ctx.db.replace(state._id, completed);
      } else {
        await ctx.db.insert("objectSearchBackfills", completed);
      }
      return null;
    }
    if (state && state.startedAt < now - BACKFILL_HEARTBEAT_MS)
      await ctx.db.patch(state._id, { startedAt: now });
    await ctx.scheduler.runAfter(0, internal.objectSearch.backfillPage, {
      organizationId: args.organizationId,
      cursor: page.continueCursor,
    });
    return null;
  },
});

function needsBackfill(
  state: Doc<"objectSearchBackfills"> | null,
  now: number,
) {
  if (!state) return true;
  // Complete documents of an older version are rebuilt at once.
  if (state.completedAt !== undefined)
    return state.version !== OBJECT_SEARCH_DOCUMENT_VERSION;
  // A run in progress reports every few minutes; a silent one was lost. A run
  // begun under an older version restarts itself (see `backfillPage`).
  return state.startedAt < now - BACKFILL_STALE_AFTER_MS;
}

/**
 * Starts a backfill for every Organization without complete, current
 * documents, a page of Organizations at a time until all are seen.
 */
export const startOutdatedBackfills = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const organizations = await ctx.db.query("organizations").paginate({
      numItems: ORGANIZATIONS_PER_PAGE,
      cursor: args.cursor ?? null,
    });
    if (!organizations.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.objectSearch.startOutdatedBackfills,
        { cursor: organizations.continueCursor },
      );
    }
    const now = Date.now();
    let started = 0;
    for (const organization of organizations.page) {
      const state = await backfillState(ctx, organization._id);
      if (!needsBackfill(state, now)) continue;
      const running = {
        organizationId: organization._id,
        version: OBJECT_SEARCH_DOCUMENT_VERSION,
        startedAt: now,
        completedAt: undefined,
      };
      if (state) {
        await ctx.db.replace(state._id, running);
      } else {
        await ctx.db.insert("objectSearchBackfills", running);
      }
      await ctx.scheduler.runAfter(0, internal.objectSearch.backfillPage, {
        organizationId: organization._id,
        cursor: null,
      });
      started += 1;
    }
    return started;
  },
});
