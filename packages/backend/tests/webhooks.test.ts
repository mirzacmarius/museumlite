import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import {
  authedForUser,
  createOrgUserWithPermissions,
} from "./testHarness";
import { modules } from "./testSetup";

describe("webhook secret generation", () => {
  test("create returns a whsec_ secret with expected length and hides it from list", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const authed = authedForUser(t, userId, "session-webhook-secret");

    const { id, secret } = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Secret shape hook",
      url: "https://example.com/webhooks/secret",
      events: ["collection.created"],
    });

    expect(secret.startsWith("whsec_")).toBe(true);
    expect(secret).toMatch(/^whsec_[A-Za-z0-9]{32}$/);
    expect(secret.length).toBe(38);

    const listed = await authed.query(api.webhooks.list, { organizationId });
    expect(listed).toHaveLength(1);
    expect(listed[0]?._id).toBe(id);
    expect(listed[0]).not.toHaveProperty("secret");

    const fetched = await authed.query(api.webhooks.get, { webhookId: id });
    expect(fetched?.secret).toBe(secret);
  });
});

describe("webhook delivery", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("getActiveForEvent returns only active webhooks subscribed to the event", async () => {
    const t = convexTest(schema, modules);

    const { organizationId, userId } = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Webhook Museum",
        slug: `webhook-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      const userId = await ctx.db.insert("users", {
        name: "Webhook User",
        email: `webhook-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });

      await ctx.db.insert("webhooks", {
        organizationId,
        name: "Active collection hook",
        url: "https://example.com/collection",
        secret: "whsec_active",
        events: ["collection.created"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("webhooks", {
        organizationId,
        name: "Inactive hook",
        url: "https://example.com/inactive",
        secret: "whsec_inactive",
        events: ["collection.created"],
        isActive: false,
        createdBy: userId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("webhooks", {
        organizationId,
        name: "Different event hook",
        url: "https://example.com/loan",
        secret: "whsec_loan",
        events: ["loan.approved"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });

      return { organizationId, userId };
    });

    const hooks = await t.query(internal.webhooks.getActiveForEvent, {
      organizationId,
      event: "collection.created",
    });

    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.url).toBe("https://example.com/collection");
    expect(hooks[0]?.secret).toBe("whsec_active");
    expect(userId).toBeDefined();
  });

  test("creating a collection schedules webhook delivery with signed payload", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["collections.create"],
      { subscriptionTier: "pro" },
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("webhooks", {
        organizationId,
        name: "Collection hook",
        url: "https://example.com/webhook",
        secret: "whsec_test_delivery",
        events: ["collection.created"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const authed = authedForUser(t, userId);
    const collectionId = await authed.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "WEBHOOK-001",
      title: "Webhook Test Object",
    });

    await t.finishAllScheduledFunctions(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toBe("https://example.com/webhook");
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("X-ML-Event")).toBe("collection.created");
    expect(headers.get("X-ML-Signature")).toMatch(/^sha256=[a-f0-9]+$/);

    const body = JSON.parse(String(init?.body)) as {
      event: string;
      data: { collectionId: Id<"collections">; title: string };
    };
    expect(body.event).toBe("collection.created");
    expect(body.data.collectionId).toBe(collectionId);
    expect(body.data.title).toBe("Webhook Test Object");
  });
});
