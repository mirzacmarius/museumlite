"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { openDecodableImage } from "./utils/imageDecoding";

/**
 * Internal action: Process thumbnail using Node.js image processing
 * Uses "use node" to access sharp library for image resizing
 */
export const processThumbnail = internalAction({
  args: {
    mediaId: v.id("mediaFiles"),
    storageId: v.id("_storage"),
  },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    try {
      // Get the image URL from storage
      const imageUrl = await ctx.storage.getUrl(args.storageId);
      if (!imageUrl) {
        return null;
      }

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      // Only JPEG, PNG, WebP and TIFF bytes reach the image library; the
      // thumbnail is 300x300 at most, keeping the aspect ratio.
      const image = await openDecodableImage(await response.arrayBuffer());
      const thumbnailBuffer = await image
        .resize(300, 300, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload thumbnail to storage
      // Convert Buffer to Uint8Array for Blob compatibility
      const thumbnailStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(thumbnailBuffer)], { type: "image/jpeg" }),
      );

      const attached = await ctx.runMutation(internal.media.attachThumbnail, {
        mediaId: args.mediaId,
        sourceStorageId: args.storageId,
        thumbnailStorageId,
      });
      if (!attached) {
        await ctx.storage.delete(thumbnailStorageId);
        return null;
      }
      return thumbnailStorageId;
    } catch (error) {
      console.error("Error processing thumbnail:", error);
      return null;
    }
  },
});
