"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

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
    // Import sharp dynamically (Node.js only)
    const sharp = (await import("sharp")).default;

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

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Process image with sharp - resize to 300x300, maintain aspect ratio
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload thumbnail to storage
      const thumbnailStorageId = await ctx.storage.store(
        new Blob([thumbnailBuffer], { type: "image/jpeg" }),
      );

      return thumbnailStorageId;
    } catch (error) {
      console.error("Error processing thumbnail:", error);
      return null;
    }
  },
});

