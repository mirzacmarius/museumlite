import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

function generateApiKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "ml_";
  const randomValues = new Uint32Array(37);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 37; i++) {
    const randomValue = randomValues[i];
    if (randomValue !== undefined) {
      key += chars.charAt(randomValue % chars.length);
    }
  }
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("apiKeys"),
      name: v.string(),
      prefix: v.string(),
      permissions: v.array(v.string()),
      expiresAt: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
      isRevoked: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const [, keys] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
      ctx.db
        .query("apiKeys")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ] as const);

    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      prefix: key.prefix,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      isRevoked: key.isRevoked,
      createdAt: key.createdAt,
    }));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    id: v.id("apiKeys"),
    key: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const apiKey = generateApiKey();
    const keyHash = await hashKey(apiKey);
    const prefix = apiKey.substring(0, 10);

    const id = await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      name: args.name,
      prefix,
      keyHash,
      permissions: args.permissions,
      expiresAt: args.expiresAt,
      lastUsedAt: undefined,
      isRevoked: false,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_api_key",
      entityType: "apiKey",
      entityId: id,
      changes: {
        name: args.name,
        prefix,
        permissions: args.permissions,
        expiresAt: args.expiresAt,
      },
    });

    return { id, key: apiKey };
  },
});

export const revoke = mutation({
  args: {
    organizationId: v.id("organizations"),
    keyId: v.id("apiKeys"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const key = await ctx.db.get(args.keyId);
    if (!key || key.organizationId !== args.organizationId) {
      throw new Error("API key not found");
    }

    await Promise.all([
      ctx.db.patch(args.keyId, { isRevoked: true }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "revoked_api_key",
        entityType: "apiKey",
        entityId: args.keyId,
        changes: {
          name: key.name,
          prefix: key.prefix,
        },
      }),
    ]);

    return null;
  },
});

export const deleteKey = mutation({
  args: {
    organizationId: v.id("organizations"),
    keyId: v.id("apiKeys"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const key = await ctx.db.get(args.keyId);
    if (!key || key.organizationId !== args.organizationId) {
      throw new Error("API key not found");
    }

    await Promise.all([
      ctx.db.delete(args.keyId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "deleted_api_key",
        entityType: "apiKey",
        entityId: args.keyId,
        changes: {
          name: key.name,
          prefix: key.prefix,
        },
      }),
    ]);

    return null;
  },
});

export const validate = internalMutation({
  args: {
    apiKey: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      organizationId: v.id("organizations"),
      permissions: v.array(v.string()),
      keyId: v.id("apiKeys"),
    }),
    v.object({
      valid: v.literal(false),
    }),
  ),
  handler: async (ctx, args) => {
    const keyHash = await hashKey(args.apiKey);
    const prefix = args.apiKey.substring(0, 10);

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
      .collect();

    const matchingKey = keys.find((k) => k.keyHash === keyHash);

    if (!matchingKey) {
      return { valid: false as const };
    }

    if (matchingKey.isRevoked) {
      return { valid: false as const };
    }

    if (matchingKey.expiresAt && matchingKey.expiresAt < Date.now()) {
      return { valid: false as const };
    }

    await ctx.db.patch(matchingKey._id, { lastUsedAt: Date.now() });

    return {
      valid: true as const,
      organizationId: matchingKey.organizationId,
      permissions: matchingKey.permissions,
      keyId: matchingKey._id,
    };
  },
});
