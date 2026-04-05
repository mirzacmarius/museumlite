import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export interface MediaTypeUsage {
  bytes: number;
  count: number;
}

export interface UsageCounterDelta {
  mediaFileCount?: number;
  mediaTypeDeltas?: Array<{
    bytesDelta: number;
    countDelta: number;
    type: string;
  }>;
  mediaVersionCount?: number;
  objectCount?: number;
  storageBytes?: number;
}

type CounterCtx = MutationCtx | QueryCtx;
type MediaByType = Record<string, MediaTypeUsage>;

function clampToNonNegative(value: number) {
  return value < 0 ? 0 : value;
}

function cloneMediaByType(
  mediaByType?: Doc<"organizationUsageCounters">["mediaByType"],
): MediaByType {
  return Object.fromEntries(
    Object.entries(mediaByType ?? {}).map(([type, usage]) => [
      type,
      {
        bytes: usage.bytes,
        count: usage.count,
      },
    ]),
  );
}

function applyMediaTypeDeltas(
  mediaByType: MediaByType,
  deltas: UsageCounterDelta["mediaTypeDeltas"],
) {
  if (!deltas) {
    return mediaByType;
  }

  for (const delta of deltas) {
    const current = mediaByType[delta.type] ?? { bytes: 0, count: 0 };
    const next = {
      bytes: clampToNonNegative(current.bytes + delta.bytesDelta),
      count: clampToNonNegative(current.count + delta.countDelta),
    };

    if (next.bytes === 0 && next.count === 0) {
      delete mediaByType[delta.type];
      continue;
    }

    mediaByType[delta.type] = next;
  }

  return mediaByType;
}

export function createEmptyUsageCounter(
  organizationId: Id<"organizations">,
): Omit<Doc<"organizationUsageCounters">, "_creationTime" | "_id"> {
  return {
    organizationId,
    objectCount: 0,
    mediaFileCount: 0,
    mediaVersionCount: 0,
    storageBytes: 0,
    mediaByType: {},
    lastUpdatedAt: Date.now(),
  };
}

export async function getUsageCounter(
  ctx: CounterCtx,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("organizationUsageCounters")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
}

export async function ensureUsageCounter(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const existing = await getUsageCounter(ctx, organizationId);
  if (existing) {
    return existing;
  }

  const counterId = await ctx.db.insert(
    "organizationUsageCounters",
    createEmptyUsageCounter(organizationId),
  );

  const created = await ctx.db.get(counterId);
  if (!created) {
    throw new Error("Failed to create organization usage counter");
  }

  return created;
}

export async function applyUsageCounterDelta(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  delta: UsageCounterDelta,
) {
  const counter = await ensureUsageCounter(ctx, organizationId);
  const mediaByType = applyMediaTypeDeltas(
    cloneMediaByType(counter.mediaByType),
    delta.mediaTypeDeltas,
  );

  await ctx.db.patch(counter._id, {
    objectCount: clampToNonNegative(counter.objectCount + (delta.objectCount ?? 0)),
    mediaFileCount: clampToNonNegative(
      counter.mediaFileCount + (delta.mediaFileCount ?? 0),
    ),
    mediaVersionCount: clampToNonNegative(
      counter.mediaVersionCount + (delta.mediaVersionCount ?? 0),
    ),
    storageBytes: clampToNonNegative(
      counter.storageBytes + (delta.storageBytes ?? 0),
    ),
    mediaByType,
    lastUpdatedAt: Date.now(),
  });
}

export async function getStorageBytes(
  ctx: CounterCtx,
  storageId: Id<"_storage">,
) {
  const storageDoc = await ctx.db.system.get(storageId);
  return storageDoc?.size ?? 0;
}

export async function getMediaStorageBytes(
  ctx: CounterCtx,
  media: Pick<Doc<"mediaFiles">, "storageId" | "thumbnailStorageId">,
) {
  const [storageBytes, thumbnailBytes] = await Promise.all([
    getStorageBytes(ctx, media.storageId),
    media.thumbnailStorageId
      ? getStorageBytes(ctx, media.thumbnailStorageId)
      : Promise.resolve(0),
  ]);

  return storageBytes + thumbnailBytes;
}

export async function getMediaVersionStorageBytes(
  ctx: CounterCtx,
  version: Pick<Doc<"mediaVersions">, "storageId">,
) {
  return await getStorageBytes(ctx, version.storageId);
}
