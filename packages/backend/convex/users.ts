import { getAuthUserId } from "@convex-dev/auth/server";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery, query } from "./_generated/server";
import { PASSWORD_PROVIDERS } from "./accountConstants";
import {
  type AccountErrorResult,
  accountErrorResultValidator,
} from "./accountErrors";
import { polar } from "./subscriptions";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import {
  claimStorageOwnership,
  createAuthorizedUploadUrl,
} from "./utils/uploadOwnership";
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
      accountEmailOverride: v.optional(v.string()),
      accountNameOverride: v.optional(v.string()),
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
    if (!user || user.deactivatedAt !== undefined) {
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
    await ctx.db.patch(userId, {
      name: trimmedName,
      accountNameOverride: trimmedName,
    });
    return null;
  },
});

export const updatePhone = mutation({
  args: { phone: v.string() },
  returns: v.union(
    v.object({ status: v.literal("saved") }),
    accountErrorResultValidator,
  ),
  handler: async (
    ctx,
    { phone },
  ): Promise<{ status: "saved" } | AccountErrorResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "error", code: "UNAUTHENTICATED" };
    const normalized = phone.trim();
    const digitCount = normalized.replace(/\D/g, "").length;
    if (
      normalized.length > 32 ||
      (normalized &&
        (!/^\+?[0-9 ()-]+$/.test(normalized) ||
          digitCount < 7 ||
          digitCount > 15))
    ) {
      return { status: "error", code: "INVALID_PHONE" };
    }
    await ctx.db.patch(userId, {
      phone: normalized || undefined,
      phoneVerificationTime: undefined,
    });
    return { status: "saved" };
  },
});

export const getAccountCapabilities = query({
  args: {},
  returns: v.object({
    hasPassword: v.boolean(),
    pendingEmailChange: v.union(
      v.object({
        email: v.string(),
        expiresAt: v.number(),
        resendAt: v.number(),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { hasPassword: false, pendingEmailChange: null };
    }
    const [accounts, pending] = await Promise.all([
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .take(32),
      ctx.db
        .query("accountEmailChanges")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
    ]);
    return {
      hasPassword: accounts.some(
        (account) =>
          PASSWORD_PROVIDERS.includes(account.provider) &&
          Boolean(account.secret),
      ),
      pendingEmailChange:
        pending && !pending.cancelled && pending.attemptsLeft > 0
          ? {
              email: pending.email,
              expiresAt: pending.expiresAt,
              resendAt: pending.lastSentAt + 60_000,
            }
          : null,
    };
  },
});

export const cancelEmailChange = mutation({
  args: {},
  returns: v.union(
    v.object({ status: v.literal("cancelled") }),
    accountErrorResultValidator,
  ),
  handler: async (
    ctx,
  ): Promise<{ status: "cancelled" } | AccountErrorResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "error", code: "UNAUTHENTICATED" };
    const pending = await ctx.db
      .query("accountEmailChanges")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (pending) await ctx.db.patch(pending._id, { cancelled: true });
    return { status: "cancelled" };
  },
});

export const generateUploadUrl = mutation({
  args: {
    mimeType: v.string(),
    organizationId: v.optional(v.id("organizations")),
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

    if (args.organizationId) {
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", args.organizationId!),
        )
        .unique();
      if (!membership) throw new Error("Organization access required");
    }
    return await createAuthorizedUploadUrl(ctx, userId, args.organizationId);
  },
});

export const checkUploadIntent = internalQuery({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const intent = await ctx.db
      .query("uploadIntents")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    return Boolean(intent && !intent.usedAt && intent.expiresAt > Date.now());
  },
});

export const completeOwnedUpload = internalMutation({
  args: { token: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db
      .query("uploadIntents")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!intent || intent.usedAt || intent.expiresAt <= Date.now())
      throw new Error("Upload session expired or already used");
    if (!(await ctx.db.system.get("_storage", args.storageId)))
      throw new Error("Uploaded file missing");
    const existing = await ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) throw new Error("File already bound");
    await ctx.db.insert("storageOwnership", {
      storageId: args.storageId,
      uploadedBy: intent.uploadedBy,
      organizationId: intent.organizationId,
      uploadedAt: Date.now(),
    });
    await ctx.db.patch(intent._id, { usedAt: Date.now() });
    return null;
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
    await claimStorageOwnership(ctx, {
      storageId: args.imageId,
      uploadedBy: userId,
      ownerType: "userAvatar",
      ownerId: userId,
    });
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
