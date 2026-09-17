import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";

export type OptionUsageKind = "condition" | "material" | "type" | "donor";

const OPTION_USAGE_NAME_CAP = 20;
const OPTION_USAGE_COUNT_PROBE = 1001;
const BACKFILL_PAGE_SIZE = 50;

export const optionUsageResultValidator = v.object({
  isUsed: v.boolean(),
  usageCount: v.number(),
  collectionNames: v.array(v.string()),
  truncatedNames: v.boolean(),
});

export function unusedOptionUsage() {
  return {
    isUsed: false,
    usageCount: 0,
    collectionNames: [] as string[],
    truncatedNames: false,
  };
}

function foldOptionValue(value: string): string | undefined {
  const folded = value.trim().toLowerCase();
  if (folded.length === 0) return undefined;
  return folded;
}

function uniqueFoldedValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const folded = foldOptionValue(value);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    result.push(folded);
  }
  return result;
}

function parseJsonOrBareStringList(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return uniqueFoldedValues([raw]);
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const strings: string[] = [];
  for (const item of items) {
    if (typeof item === "string") strings.push(item);
  }
  return uniqueFoldedValues(strings);
}

export function occupancyRowsFromCollection(
  collection: Pick<
    Doc<"collections">,
    "condition" | "donated_by" | "materials" | "objectType"
  >,
): Array<{ kind: OptionUsageKind; value: string }> {
  const rows: Array<{ kind: OptionUsageKind; value: string }> = [];
  if (collection.condition !== undefined) {
    const value = foldOptionValue(collection.condition);
    if (value) rows.push({ kind: "condition", value });
  }
  if (collection.donated_by) {
    for (const value of uniqueFoldedValues(collection.donated_by)) {
      rows.push({ kind: "donor", value });
    }
  }
  for (const value of parseJsonOrBareStringList(collection.materials)) {
    rows.push({ kind: "material", value });
  }
  for (const value of parseJsonOrBareStringList(collection.objectType)) {
    rows.push({ kind: "type", value });
  }
  return rows;
}

function occupancyKey(kind: OptionUsageKind, value: string) {
  return `${kind}\0${value}`;
}

export async function replaceCollectionOptionUsages(
  ctx: MutationCtx,
  collection: Doc<"collections">,
) {
  const desired = occupancyRowsFromCollection(collection);
  const existing = await ctx.db
    .query("collectionOptionUsages")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  const desiredKeys = new Set(
    desired.map((row) => occupancyKey(row.kind, row.value)),
  );
  const existingByKey = new Map(
    existing.map((row) => [occupancyKey(row.kind, row.value), row] as const),
  );

  await Promise.all(
    existing.map(async (row) => {
      if (!desiredKeys.has(occupancyKey(row.kind, row.value))) {
        await ctx.db.delete(row._id);
      }
    }),
  );

  await Promise.all(
    desired.map(async (row) => {
      if (existingByKey.has(occupancyKey(row.kind, row.value))) return;
      await ctx.db.insert("collectionOptionUsages", {
        organizationId: collection.organizationId,
        collectionId: collection._id,
        kind: row.kind,
        value: row.value,
      });
    }),
  );
}

export async function syncCollectionOptionUsages(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const collection = await ctx.db.get(collectionId);
  if (!collection) return;
  await replaceCollectionOptionUsages(ctx, collection);
}

export async function clearCollectionOptionUsages(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const existing = await ctx.db
    .query("collectionOptionUsages")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
}

export async function markOptionUsageIndexReady(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const existing = await ctx.db
    .query("collectionOptionUsageBackfills")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (existing) return;
  await ctx.db.insert("collectionOptionUsageBackfills", {
    organizationId,
    completedAt: Date.now(),
  });
}

export async function assertOptionUsageIndexReady(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const flag = await ctx.db
    .query("collectionOptionUsageBackfills")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (!flag) {
    throw new Error("Usage index is backfilling");
  }
}

export async function loadOptionUsage(
  ctx: QueryCtx,
  args: {
    organizationId: Id<"organizations">;
    kind: OptionUsageKind;
    value: string;
    excludeCollectionId?: Id<"collections">;
  },
) {
  const foldedValue = foldOptionValue(args.value);
  if (!foldedValue) return unusedOptionUsage();

  const collectionNames: string[] = [];
  let usageCount = 0;
  const usageQuery = ctx.db
    .query("collectionOptionUsages")
    .withIndex("by_organization_kind_and_value", (q) =>
      q
        .eq("organizationId", args.organizationId)
        .eq("kind", args.kind)
        .eq("value", foldedValue),
    );

  for await (const row of usageQuery) {
    if (
      args.excludeCollectionId &&
      row.collectionId === args.excludeCollectionId
    ) {
      continue;
    }
    usageCount += 1;
    if (collectionNames.length < OPTION_USAGE_NAME_CAP) {
      const collection = await ctx.db.get(row.collectionId);
      if (collection) collectionNames.push(collection.accessionNumber);
    }
    if (usageCount >= OPTION_USAGE_COUNT_PROBE) break;
  }

  return {
    isUsed: usageCount > 0,
    usageCount,
    collectionNames,
    truncatedNames: usageCount > OPTION_USAGE_NAME_CAP,
  };
}

export async function processOptionUsageBackfillPage(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    cursor: string | null;
  },
): Promise<{ isDone: boolean; continueCursor: string }> {
  const page = await ctx.db
    .query("collections")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", args.organizationId),
    )
    .paginate({
      numItems: BACKFILL_PAGE_SIZE,
      cursor: args.cursor,
    });

  for (const collection of page.page) {
    await replaceCollectionOptionUsages(ctx, collection);
  }

  if (page.isDone) {
    await markOptionUsageIndexReady(ctx, args.organizationId);
  }

  return {
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  };
}

export const backfillPage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ isDone: boolean; continueCursor: string | null }> => {
    const result = await processOptionUsageBackfillPage(ctx, args);
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.utils.collectionOptionUsages.backfillPage,
        {
          organizationId: args.organizationId,
          cursor: result.continueCursor,
        },
      );
    }

    return result;
  },
});
