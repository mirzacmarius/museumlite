import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("webhooksActions auth gate", () => {
  test("test action returns not-authenticated for unauthenticated caller", async () => {
    const t = convexTest(schema, modules);

    const webhookId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: `test-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      return await ctx.db.insert("webhooks", {
        organizationId: orgId,
        name: "Test Webhook",
        url: "https://example.com/webhook",
        secret: "whsec_test",
        events: ["collection.created"],
        isActive: true,
        createdBy: await ctx.db.insert("users", {
          name: "Creator",
          email: `creator-${Math.random().toString(36).slice(2, 8)}@example.com`,
        }),
        createdAt: Date.now(),
      });
    });

    // No identity set — caller is unauthenticated
    const result = await t.action(api.webhooksActions.test, { webhookId });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  test("test action returns not-authorized for non-member", async () => {
    const t = convexTest(schema, modules);

    const { webhookId, outsiderId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: `test-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      const creatorId = await ctx.db.insert("users", {
        name: "Creator",
        email: `creator-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      const wid = await ctx.db.insert("webhooks", {
        organizationId: orgId,
        name: "Test Webhook",
        url: "https://example.com/webhook",
        secret: "whsec_test",
        events: ["collection.created"],
        isActive: true,
        createdBy: creatorId,
        createdAt: Date.now(),
      });
      // outsider is a real user but NOT a member of the org
      const uid = await ctx.db.insert("users", {
        name: "Outsider",
        email: `outsider-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      return { webhookId: wid, outsiderId: uid };
    });

    const authed = t.withIdentity({
      subject: `${outsiderId}|session-outsider`,
      issuer: "https://example.test",
    });

    const result = await authed.action(api.webhooksActions.test, { webhookId });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authorized");
  });
});
