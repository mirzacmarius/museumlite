import { getAuthUserId } from "@convex-dev/auth/server";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { polar } from "./subscriptions";
import { username } from "./utils/validators";

/**
 * Valid image types for user avatars
 */
const AVATAR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const AVATAR_IMAGE_TYPE_SET = new Set<string>(AVATAR_IMAGE_TYPES);

/**
 * Validate avatar file type
 */
function validateAvatarFileType(mimeType: string): boolean {
  return AVATAR_IMAGE_TYPE_SET.has(mimeType);
}

export const getUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      username: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      imageId: v.optional(v.id("_storage")),
      emailVerificationTime: v.optional(v.number()),
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      subscription: v.any(),
      avatarUrl: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    const avatarUrl = user.imageId
      ? await ctx.storage.getUrl(user.imageId)
      : null;
    return {
      ...user,
      name: user.name || user.username,
      subscription: null,
      avatarUrl: avatarUrl ?? undefined,
    };
  },
});

export const updateUsername = mutation({
  args: {
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const validatedUsername = username.safeParse(args.username);

    if (!validatedUsername.success) {
      throw new Error(validatedUsername.error.message);
    }
    await ctx.db.patch(userId, { username: validatedUsername.data });
    return null;
  },
});

export const updateName = mutation({
  args: {
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 64) {
      throw new Error("Name must be between 1 and 64 characters");
    }
    await ctx.db.patch(userId, { name: trimmedName });
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {
    mimeType: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    // Validate file type
    if (!validateAvatarFileType(args.mimeType)) {
      throw new Error(`Unsupported file type: ${args.mimeType}`);
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateUserImage = mutation({
  args: {
    imageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await ctx.db.patch(userId, { imageId: args.imageId });
    return null;
  },
});

export const removeUserImage = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await ctx.db.patch(userId, { imageId: undefined });
    return null;
  },
});

export const deleteCurrentUserAccount = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const customer = await polar.getCustomerByUserId(ctx, userId);
    if (!customer) {
      console.error("No subscription found");
    } else {
      const subscriptions = await polar.sdk.subscriptions.list({
        customerId: customer.id,
        active: true,
        limit: 100,
      });
      const activeSubscription = subscriptions.result.items[0];

      if (!activeSubscription) {
        console.error("No subscription found");
      } else {
        await polar.sdk.subscriptions.revoke({
          id: activeSubscription.id,
        });
      }
    }
    await ctx.runMutation(internal.usersMutations.deleteUserAccount, {
      userId,
    });
    return null;
  },
});
