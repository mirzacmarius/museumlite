"use node";

import { getAuthUserId } from "@convex-dev/auth/server";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requirePermission } from "./utils/permissions";

const WEBHOOK_EVENTS = [
  "collection.created",
  "collection.updated",
  "collection.deleted",
  "loan.created",
  "loan.approved",
  "loan.dispatched",
  "loan.returned",
  "accession.created",
  "accession.approved",
  "accession.cataloged",
  "media.uploaded",
] as const;

function generateSecret(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "whsec_";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

export const listEvents = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return [...WEBHOOK_EVENTS];
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("webhooks"),
      name: v.string(),
      url: v.string(),
      events: v.array(v.string()),
      isActive: v.boolean(),
      lastTriggeredAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return webhooks.map((wh) => ({
      _id: wh._id,
      name: wh.name,
      url: wh.url,
      events: wh.events,
      isActive: wh.isActive,
      lastTriggeredAt: wh.lastTriggeredAt,
      createdAt: wh.createdAt,
    }));
  },
});

export const get = query({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.union(
    v.object({
      _id: v.id("webhooks"),
      name: v.string(),
      url: v.string(),
      secret: v.string(),
      events: v.array(v.string()),
      isActive: v.boolean(),
      lastTriggeredAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) return null;

    await requirePermission(
      ctx,
      webhook.organizationId,
      "organization.manage_settings",
    );

    return {
      _id: webhook._id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      isActive: webhook.isActive,
      lastTriggeredAt: webhook.lastTriggeredAt,
      createdAt: webhook.createdAt,
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    url: v.string(),
    events: v.array(v.string()),
  },
  returns: v.object({
    id: v.id("webhooks"),
    secret: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    if (!args.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    const invalidEvents = args.events.filter(
      (e) => !WEBHOOK_EVENTS.includes(e as (typeof WEBHOOK_EVENTS)[number]),
    );
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(", ")}`);
    }

    const secret = generateSecret();

    const id = await ctx.db.insert("webhooks", {
      organizationId: args.organizationId,
      name: args.name,
      url: args.url,
      secret,
      events: args.events,
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_webhook",
      entityType: "webhook",
      entityId: id,
      changes: {
        name: args.name,
        url: args.url,
        events: args.events,
      },
    });

    return { id, secret };
  },
});

export const update = mutation({
  args: {
    webhookId: v.id("webhooks"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requirePermission(
      ctx,
      webhook.organizationId,
      "organization.manage_settings",
    );

    if (args.url && !args.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    if (args.events) {
      const invalidEvents = args.events.filter(
        (e) => !WEBHOOK_EVENTS.includes(e as (typeof WEBHOOK_EVENTS)[number]),
      );
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(", ")}`);
      }
    }

    await ctx.db.patch(args.webhookId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.url !== undefined && { url: args.url }),
      ...(args.events !== undefined && { events: args.events }),
      ...(args.isActive !== undefined && { isActive: args.isActive }),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: webhook.organizationId,
      userId,
      action: "updated_webhook",
      entityType: "webhook",
      entityId: args.webhookId,
      changes: {
        name: args.name,
        url: args.url,
        events: args.events,
        isActive: args.isActive,
      },
    });

    return null;
  },
});

export const rotateSecret = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.object({
    secret: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requirePermission(
      ctx,
      webhook.organizationId,
      "organization.manage_settings",
    );

    const secret = generateSecret();
    await ctx.db.patch(args.webhookId, { secret });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: webhook.organizationId,
      userId,
      action: "rotated_webhook_secret",
      entityType: "webhook",
      entityId: args.webhookId,
      changes: {
        name: webhook.name,
      },
    });

    return { secret };
  },
});

export const deleteWebhook = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requirePermission(
      ctx,
      webhook.organizationId,
      "organization.manage_settings",
    );

    await ctx.db.delete(args.webhookId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: webhook.organizationId,
      userId,
      action: "deleted_webhook",
      entityType: "webhook",
      entityId: args.webhookId,
      changes: {
        name: webhook.name,
        url: webhook.url,
      },
    });

    return null;
  },
});

export const getInternal = internalQuery({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.union(
    v.object({
      url: v.string(),
      secret: v.string(),
      events: v.array(v.string()),
      isActive: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) return null;

    return {
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      isActive: webhook.isActive,
    };
  },
});

export const updateLastTriggered = internalMutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookId, { lastTriggeredAt: Date.now() });
    return null;
  },
});

export const test = action({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.object({
    success: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
  }> => {
    const webhook: {
      url: string;
      secret: string;
      events: string[];
      isActive: boolean;
    } | null = await ctx.runQuery(internal.webhooks.getInternal, {
      webhookId: args.webhookId,
    });

    if (!webhook) {
      return { success: false, error: "Webhook not found" };
    }

    const payload = {
      event: "test",
      timestamp: Date.now(),
      data: {
        message: "This is a test webhook delivery from MuseumLite",
      },
    };

    const signature = await signPayload(
      JSON.stringify(payload),
      webhook.secret,
    );

    try {
      const response: Response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ML-Signature": signature,
          "X-ML-Event": "test",
        },
        body: JSON.stringify(payload),
      });

      await ctx.runMutation(internal.webhooks.updateLastTriggered, {
        webhookId: args.webhookId,
      });

      return {
        success: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  const hashArray = Array.from(new Uint8Array(signature));
  return (
    "sha256=" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}
