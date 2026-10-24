"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { openDecodableImage } from "./utils/imageDecoding";
import { derivativeSize } from "./utils/reproductionRequestValidators";

/**
 * Makes a request's Licensed copy: the verified source re-encoded as a
 * JPEG no larger than the chosen size, without the original's metadata.
 */
export const makeDerivative = internalAction({
  args: {
    derivativeId: v.id("reproductionDerivatives"),
    jobId: v.string(),
    sourceStorageId: v.id("_storage"),
    maxDimension: derivativeSize,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fail = () =>
      ctx.runMutation(internal.reproductionRequests.failDerivative, {
        derivativeId: args.derivativeId,
        jobId: args.jobId,
      });
    let rendered: { data: Buffer; width: number; height: number };
    try {
      const source = await ctx.storage.get(args.sourceStorageId);
      if (!source) {
        await fail();
        return null;
      }
      const image = await openDecodableImage(await source.arrayBuffer(), {
        limitInputPixels: 100_000_000,
      });
      const { data, info } = await image
        .rotate()
        .resize({
          width: args.maxDimension,
          height: args.maxDimension,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      rendered = { data, width: info.width, height: info.height };
    } catch (error) {
      console.error("Licensed copy generation failed", error);
      await fail();
      return null;
    }
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(rendered.data)], { type: "image/jpeg" }),
    );
    const accepted = await ctx.runMutation(
      internal.reproductionRequests.completeDerivative,
      {
        derivativeId: args.derivativeId,
        jobId: args.jobId,
        storageId,
        width: rendered.width,
        height: rendered.height,
      },
    );
    if (!accepted) {
      await ctx.storage.delete(storageId);
      await fail();
    }
    return null;
  },
});
