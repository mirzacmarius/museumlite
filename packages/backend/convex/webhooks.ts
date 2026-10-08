import { getAuthUserId } from "@convex-dev/auth/server";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";
import {
  isHttpsWebhookUrl,
  isSupportedWebhookEvent,
  MAX_WEBHOOKS_PER_ORGANIZATION,
  WEBHOOK_EVENT_TYPES,
} from "./utils/webhookDelivery";
import { webhookError } from "./utils/webhookErrors";

const MAX_NAME_LENGTH = 100;
const MAX_URL_LENGTH = 2048;

function validName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw webhookError("WEBHOOK_NAME_REQUIRED", "Webhook name is required");
  }
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

function validUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed.length > MAX_URL_LENGTH || !isHttpsWebhookUrl(trimmed)) {
    throw webhookError("WEBHOOK_URL_INVALID", "Webhook URL must use HTTPS");
  }
  return trimmed;
}

function validEvents(events: string[]) {
  const unsupported = events.filter((event) => !isSupportedWebhookEvent(event));
  if (unsupported.length > 0) {
    throw webhookError(
      "WEBHOOK_EVENT_UNSUPPORTED",
      `Unsupported events: ${unsupported.join(", ")}`,
    );
  }
  return [...new Set(events)];
}

async function requireManagedWebhook(
  ctx: MutationCtx,
  webhookId: Id<"webhooks">,
) {
  const webhook = await ctx.db.get(webhookId);
  if (!webhook) {
    throw webhookError("WEBHOOK_NOT_FOUND", "Webhook endpoint not found");
  }
  await requirePermission(
    ctx,
    webhook.organizationId,
    "organization.manage_settings",
  );
  return webhook;
}

function generateSecret(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const alphabetLength = chars.length;
  const limit = Math.floor(256 / alphabetLength) * alphabetLength;
  const bodyLength = 32;

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

  return `whsec_${body}`;
}

export const listEvents = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return [...WEBHOOK_EVENT_TYPES];
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
        .take(MAX_WEBHOOKS_PER_ORGANIZATION),
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

    const name = validName(args.name);
    const url = validUrl(args.url);
    const events = validEvents(args.events);

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const existing = await ctx.db
      .query("webhooks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(MAX_WEBHOOKS_PER_ORGANIZATION);
    if (existing.length >= MAX_WEBHOOKS_PER_ORGANIZATION) {
      throw webhookError(
        "WEBHOOK_LIMIT_REACHED",
        `An organization can have at most ${MAX_WEBHOOKS_PER_ORGANIZATION} webhook endpoints`,
      );
    }

    const secret = generateSecret();

    const id = await ctx.db.insert("webhooks", {
      organizationId: args.organizationId,
      name,
      url,
      secret,
      events,
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
      changes: { name, url, events },
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

    const name = args.name === undefined ? undefined : validName(args.name);
    const url = args.url === undefined ? undefined : validUrl(args.url);
    const events =
      args.events === undefined ? undefined : validEvents(args.events);
    const webhook = await requireManagedWebhook(ctx, args.webhookId);

    await Promise.all([
      ctx.db.patch(args.webhookId, {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(events !== undefined && { events }),
        ...(args.isActive !== undefined && { isActive: args.isActive }),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: webhook.organizationId,
        userId,
        action: "updated_webhook",
        entityType: "webhook",
        entityId: args.webhookId,
        changes: {
          name,
          url,
          events,
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

    const webhook = await requireManagedWebhook(ctx, args.webhookId);

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

    const webhook = await requireManagedWebhook(ctx, args.webhookId);

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
