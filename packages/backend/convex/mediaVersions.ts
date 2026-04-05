import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  applyUsageCounterDelta,
  getMediaVersionStorageBytes,
} from "./utils/organizationUsageCounters";
import { requirePermission } from "./utils/permissions";

/**
 * Create a new version of a media file with edits applied
 * Accepts the edited image blob (already uploaded to storage), edit type, and metadata
 */
export const createVersion = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    storageId: v.id("_storage"),
    editType: v.union(
      v.literal("crop"),
      v.literal("rotate"),
      v.literal("adjust"),
      v.literal("watermark"),
    ),
    editMetadata: v.optional(v.any()), // Crop coords, rotation angle, brightness/contrast values, watermark text
  },
  returns: v.id("mediaVersions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the original media file
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media file not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.upload");

    // Get the current version count (default to 0 if not set)
    const currentVersionCount = media.versionCount ?? 0;
    const newVersionNumber = currentVersionCount + 1;

    // Create new version record
    const versionId = await ctx.db.insert("mediaVersions", {
      originalMediaId: args.mediaId,
      organizationId: media.organizationId,
      storageId: args.storageId,
      versionNumber: newVersionNumber,
      editType: args.editType,
      editMetadata: args.editMetadata,
      createdBy: userId,
      createdAt: Date.now(),
    });

    // Update the media file with the new version info
    await ctx.db.patch(args.mediaId, {
      currentVersionId: versionId,
      versionCount: newVersionNumber,
    });

    const versionStorageBytes = await getMediaVersionStorageBytes(ctx, {
      storageId: args.storageId,
    });
    await applyUsageCounterDelta(ctx, media.organizationId, {
      mediaVersionCount: 1,
      storageBytes: versionStorageBytes,
    });

    return versionId;
  },
});

/**
 * Revert a media file to a specific version
 */
export const revertToVersion = mutation({
  args: {
    versionId: v.id("mediaVersions"),
  },
  returns: v.id("mediaFiles"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the version record
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }

    // Get the original media file
    const media = await ctx.db.get(version.originalMediaId);
    if (!media) {
      throw new Error("Media file not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.upload");

    // Update the media file to use this version
    await ctx.db.patch(version.originalMediaId, {
      currentVersionId: args.versionId,
    });

    return version.originalMediaId;
  },
});

/**
 * List all versions for a media file
 */
export const listVersions = query({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaVersions"),
      originalMediaId: v.id("mediaFiles"),
      organizationId: v.id("organizations"),
      storageId: v.id("_storage"),
      versionNumber: v.number(),
      editType: v.union(
        v.literal("crop"),
        v.literal("rotate"),
        v.literal("adjust"),
        v.literal("watermark"),
      ),
      editMetadata: v.optional(v.any()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the original media file
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media file not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.read");

    // Query all versions for this media file
    const versions = await ctx.db
      .query("mediaVersions")
      .withIndex("by_original_media", (q) =>
        q.eq("originalMediaId", args.mediaId),
      )
      .collect();

    // Get URLs for each version
    const versionsWithUrls = await Promise.all(
      versions.map(async (version) => {
        const url = await ctx.storage.getUrl(version.storageId);

        return {
          _id: version._id,
          originalMediaId: version.originalMediaId,
          organizationId: version.organizationId,
          storageId: version.storageId,
          versionNumber: version.versionNumber,
          editType: version.editType,
          editMetadata: version.editMetadata,
          createdBy: version.createdBy,
          createdAt: version.createdAt,
          url,
        };
      }),
    );

    // Sort by version number descending (newest first)
    versionsWithUrls.sort((a, b) => b.versionNumber - a.versionNumber);

    return versionsWithUrls;
  },
});
