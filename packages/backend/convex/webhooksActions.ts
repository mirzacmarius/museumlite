import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

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
