import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

/**
 * Track an edit operation applied to a media file
 * Records the edit in the mediaEditHistory table for audit trail
 */
export const trackEdit = mutation({
  args: {
    mediaId: v.id("mediaFiles"),
    versionId: v.optional(v.id("mediaVersions")),
    operation: v.union(
      v.literal("crop"),
      v.literal("rotate"),
      v.literal("adjust"),
      v.literal("watermark"),
    ),
    parameters: v.optional(v.any()), // Operation-specific parameters (crop coords, rotation degrees, brightness/contrast values, watermark settings)
  },
  returns: v.id("mediaEditHistory"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the media file to verify it exists and get organization ID
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media file not found");
    }

    // Check permission
    await requirePermission(ctx, media.organizationId, "media.upload");

    // If versionId is provided, verify it exists
    if (args.versionId) {
      const version = await ctx.db.get(args.versionId);
      if (!version) {
        throw new Error("Version not found");
      }
    }

    // Create edit history record
    const editHistoryId = await ctx.db.insert("mediaEditHistory", {
      mediaId: args.mediaId,
      versionId: args.versionId,
      organizationId: media.organizationId,
      operation: args.operation,
      parameters: args.parameters,
      appliedBy: userId,
      appliedAt: Date.now(),
    });

    return editHistoryId;
  },
});

/**
 * Get edit history for a media file
 * Returns all edit operations applied to the media file, ordered by most recent first
 */
export const getEditHistory = query({
  args: {
    mediaId: v.id("mediaFiles"),
  },
  returns: v.array(
    v.object({
      _id: v.id("mediaEditHistory"),
      _creationTime: v.number(),
      mediaId: v.id("mediaFiles"),
      versionId: v.optional(v.id("mediaVersions")),
      organizationId: v.id("organizations"),
      operation: v.union(
        v.literal("crop"),
        v.literal("rotate"),
        v.literal("adjust"),
        v.literal("watermark"),
      ),
      parameters: v.optional(v.any()),
      appliedBy: v.id("users"),
      appliedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the media file to verify it exists and get organization ID
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media file not found");
    }

    // Check permission
    const [, editHistory] = await Promise.all([
      requirePermission(ctx, media.organizationId, "media.upload"),
      ctx.db
        .query("mediaEditHistory")
        .withIndex("by_media", (q) => q.eq("mediaId", args.mediaId))
        .order("desc")
        .collect(),
    ] as const);

    return editHistory;
  },
});
