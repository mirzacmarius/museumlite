import { getAuthUserId } from "@convex-dev/auth/server";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
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

    const [, webhooks] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
      ctx.db
        .query("webhooks")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ] as const);

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

    if (!args.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    const invalidEvents = args.events.filter(
      (e) => !WEBHOOK_EVENTS.includes(e as (typeof WEBHOOK_EVENTS)[number]),
    );
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(", ")}`);
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

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

    await requirePermission(
      ctx,
      webhook.organizationId,
      "organization.manage_settings",
    );

    await Promise.all([
      ctx.db.patch(args.webhookId, {
        ...(args.name !== undefined && { name: args.name }),
        ...(args.url !== undefined && { url: args.url }),
        ...(args.events !== undefined && { events: args.events }),
        ...(args.isActive !== undefined && { isActive: args.isActive }),
      }),
      ctx.runMutation(internal.audit.logAction, {
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
      }),
    ]);

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
    await Promise.all([
      ctx.db.patch(args.webhookId, { secret }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: webhook.organizationId,
        userId,
        action: "rotated_webhook_secret",
        entityType: "webhook",
        entityId: args.webhookId,
        changes: {
          name: webhook.name,
        },
      }),
    ]);

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

    await Promise.all([
      ctx.db.delete(args.webhookId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: webhook.organizationId,
        userId,
        action: "deleted_webhook",
        entityType: "webhook",
        entityId: args.webhookId,
        changes: {
          name: webhook.name,
          url: webhook.url,
        },
      }),
    ]);

    return null;
  },
});

export const getWebhookOrgId = internalQuery({
  args: {
    webhookId: v.id("webhooks"),
  },
  returns: v.union(v.id("organizations"), v.null()),
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    return webhook?.organizationId ?? null;
  },
});

export const getActiveForEvent = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    event: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("webhooks"),
      url: v.string(),
      secret: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const active: Array<{
      _id: (typeof webhooks)[number]["_id"];
      url: string;
      secret: string;
    }> = [];
    for (const webhook of webhooks) {
      if (!webhook.isActive) {
        continue;
      }
      let isSubscribed = false;
      for (const subscribedEvent of webhook.events) {
        if (subscribedEvent === args.event) {
          isSubscribed = true;
          break;
        }
      }
      if (!isSubscribed) {
        continue;
      }
      active.push({
        _id: webhook._id,
        url: webhook.url,
        secret: webhook.secret,
      });
    }
    return active;
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
