import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";

/**
 * Test webhook action - sends a test payload to verify webhook configuration.
 * This is kept in a separate file because actions run in Node.js runtime,
 * while queries and mutations need to run in Convex's standard runtime.
 */
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    const orgId = await ctx.runQuery(internal.webhooks.getWebhookOrgId, {
      webhookId: args.webhookId,
    });
    if (!orgId) {
      return { success: false, error: "Webhook not found" };
    }

    const hasPermission = await ctx.runQuery(
      internal.utils.permissions.checkOrgPermission,
      {
        userId,
        organizationId: orgId,
        permissionName: "organization.manage_settings",
      },
    );
    if (!hasPermission) {
      return { success: false, error: "Not authorized" };
    }

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

export const deliver = internalAction({
  args: {
    organizationId: v.id("organizations"),
    event: v.string(),
    data: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const webhooks: Array<{
      _id: Id<"webhooks">;
      url: string;
      secret: string;
    }> = await ctx.runQuery(internal.webhooks.getActiveForEvent, {
      organizationId: args.organizationId,
      event: args.event,
    });

    const payload = {
      event: args.event,
      timestamp: Date.now(),
      data: args.data,
    };
    const body = JSON.stringify(payload);

    for (const webhook of webhooks) {
      if (!webhook.url.startsWith("https://")) {
        continue;
      }

      const signature = await signPayload(body, webhook.secret);

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ML-Signature": signature,
            "X-ML-Event": args.event,
          },
          body,
        });

        if (response.ok) {
          await ctx.runMutation(internal.webhooks.updateLastTriggered, {
            webhookId: webhook._id,
          });
        }
      } catch (error) {
        console.error("Webhook delivery failed:", {
          webhookId: webhook._id,
          event: args.event,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return null;
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
  return `sha256=${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
