"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const processRendition = internalAction({
  args: {
    mediaId: v.id("mediaFiles"),
    requestId: v.string(),
    sourceStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const sourceUrl = await ctx.storage.getUrl(args.sourceStorageId);
      if (!sourceUrl) throw new Error("Source image missing");
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Source image unavailable");
      const sharp = (await import("sharp")).default;
      const image = sharp(Buffer.from(await response.arrayBuffer()), {
        limitInputPixels: 100_000_000,
      });
      const rendition = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      const renditionStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(rendition)], { type: "image/jpeg" }),
      );
      const accepted = await ctx.runMutation(
        internal.mediaPublications.completeRendition,
        {
          ...args,
          renditionStorageId,
        },
      );
      if (!accepted) {
        await ctx.storage.delete(renditionStorageId);
        await ctx.runMutation(internal.mediaPublications.failRendition, {
          mediaId: args.mediaId,
          requestId: args.requestId,
        });
      }
    } catch (error) {
      console.error("Public rendition generation failed", error);
      await ctx.runMutation(internal.mediaPublications.failRendition, {
        mediaId: args.mediaId,
        requestId: args.requestId,
      });
    }
    return null;
  },
});
