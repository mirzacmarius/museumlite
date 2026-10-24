import { getAuthUserId } from "@convex-dev/auth/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

/** What a key may be granted; the public API reads only `read` today. */
export const API_KEY_PERMISSIONS = ["read", "write"] as const;
const apiKeyPermissionValidator = v.union(
  v.literal("read"),
  v.literal("write"),
);

/** Requests one key may make: a steady rate with room for a short burst. */
export const API_REQUESTS_PER_MINUTE = 60;
export const API_REQUEST_BURST = 120;
const apiLimiter = new RateLimiter(components.rateLimiter, {
  apiKeyRequests: {
    kind: "token bucket",
    rate: API_REQUESTS_PER_MINUTE,
    period: MINUTE,
    capacity: API_REQUEST_BURST,
  },
});

/** `lastUsedAt` is kept to the minute, so most requests write nothing to the key. */
export const LAST_USED_RESOLUTION_MS = MINUTE;

function generateApiKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const alphabetLength = chars.length;
  const limit = Math.floor(256 / alphabetLength) * alphabetLength;
  const bodyLength = 37;

  let body = "";
  const randomBytes = new Uint8Array(bodyLength * 2);

  while (body.length < bodyLength) {
    crypto.getRandomValues(randomBytes);
    for (const byte of randomBytes) {
      if (byte >= limit) continue;
      body += chars.charAt(byte % alphabetLength);
      if (body.length === bodyLength) break;
    }
  }

  return `ml_${body}`;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexDigestToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i]! ^ b[i]!;
  }

  return diff === 0;
}

function compareHashDigests(
  storedHash: string,
  candidateHash: string,
): boolean {
  if (storedHash.length !== candidateHash.length) {
    return false;
  }

  const storedBytes = hexDigestToBytes(storedHash);
  const candidateBytes = hexDigestToBytes(candidateHash);

  if (storedBytes.length !== candidateBytes.length) {
    return false;
  }

  return timingSafeEqual(storedBytes, candidateBytes);
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
    permissions: v.array(apiKeyPermissionValidator),
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

    const permissions = API_KEY_PERMISSIONS.filter((permission) =>
      args.permissions.includes(permission),
    );
    if (permissions.length === 0) {
      throw new Error("An API key needs at least one permission");
    }

    const apiKey = generateApiKey();
    const keyHash = await hashKey(apiKey);
    const prefix = apiKey.substring(0, 10);

    const id = await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      name: args.name,
      prefix,
      keyHash,
      permissions,
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
        permissions,
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
    // `retryAfter` (ms) is set only when the key is over its request limit.
    v.object({
      valid: v.literal(false),
      retryAfter: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const keyHash = await hashKey(args.apiKey);
    const prefix = args.apiKey.substring(0, 10);

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
      .collect();

    let matchingKey: Doc<"apiKeys"> | undefined;
    for (const key of keys) {
      if (compareHashDigests(key.keyHash, keyHash)) {
        matchingKey = key;
        break;
      }
    }

    if (!matchingKey) {
      return { valid: false as const };
    }

    if (matchingKey.isRevoked) {
      return { valid: false as const };
    }

    const now = Date.now();
    if (matchingKey.expiresAt && matchingKey.expiresAt < now) {
      return { valid: false as const };
    }

    const quota = await apiLimiter.limit(ctx, "apiKeyRequests", {
      key: matchingKey._id,
    });
    if (!quota.ok) {
      return {
        valid: false as const,
        retryAfter: quota.retryAfter,
      };
    }

    if (
      matchingKey.lastUsedAt === undefined ||
      now - matchingKey.lastUsedAt >= LAST_USED_RESOLUTION_MS
    ) {
      await ctx.db.patch(matchingKey._id, { lastUsedAt: now });
    }

    return {
      valid: true as const,
      organizationId: matchingKey.organizationId,
      permissions: matchingKey.permissions,
      keyId: matchingKey._id,
    };
  },
});
