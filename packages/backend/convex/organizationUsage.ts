import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import {
  createEmptyUsageCounter,
  getMediaStorageBytes,
  getMediaVersionStorageBytes,
} from "./utils/organizationUsageCounters";

const mediaTypeUsageValidator = v.record(
  v.string(),
  v.object({
    count: v.number(),
    bytes: v.number(),
  }),
);

const usageCounterSnapshotValidator = v.object({
  organizationId: v.id("organizations"),
  objectCount: v.number(),
  mediaFileCount: v.number(),
  mediaVersionCount: v.number(),
  storageBytes: v.number(),
  mediaByType: mediaTypeUsageValidator,
  lastUpdatedAt: v.number(),
});

async function buildUsageCounterSnapshot(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const [collections, mediaFiles, mediaVersions] = await Promise.all([
    ctx.db
      .query("collections")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("mediaFiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("mediaVersions")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
  ]);

  const mediaByType: Record<string, { bytes: number; count: number }> = {};
  let storageBytes = 0;

  for (const media of mediaFiles) {
    const mediaBytes = await getMediaStorageBytes(ctx, media);
    storageBytes += mediaBytes;

    const current = mediaByType[media.fileType] ?? { bytes: 0, count: 0 };
    mediaByType[media.fileType] = {
      bytes: current.bytes + mediaBytes,
      count: current.count + 1,
    };
  }

  for (const version of mediaVersions) {
    storageBytes += await getMediaVersionStorageBytes(ctx, version);
  }

  return {
    ...createEmptyUsageCounter(organizationId),
    organizationId,
    objectCount: collections.length,
    mediaFileCount: mediaFiles.length,
    mediaVersionCount: mediaVersions.length,
    storageBytes,
    mediaByType,
    lastUpdatedAt: Date.now(),
  };
}

export const recomputeOrganizationUsageCounter = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: usageCounterSnapshotValidator,
  handler: async (ctx, args) => {
    const snapshot = await buildUsageCounterSnapshot(ctx, args.organizationId);
    const existing = await ctx.db
      .query("organizationUsageCounters")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, snapshot);
    } else {
      await ctx.db.insert("organizationUsageCounters", snapshot);
    }

    return snapshot;
  },
});

export const recomputeAllOrganizationUsageCounters = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const organizations = await ctx.runQuery(
      internal.organizationUsage.listOrganizationIdsForUsageRebuild,
      {},
    );

    for (const organizationId of organizations) {
      await ctx.runMutation(
        internal.organizationUsage.recomputeOrganizationUsageCounter,
        { organizationId },
      );
    }

    return organizations.length;
  },
});

export const listOrganizationIdsForUsageRebuild = internalQuery({
  args: {},
  returns: v.array(v.id("organizations")),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    return organizations.map((organization) => organization._id);
  },
});
