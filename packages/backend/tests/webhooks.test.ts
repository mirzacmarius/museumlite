import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { webhookErrorCodeFromError } from "../convex/utils/webhookErrors";
import { authedForUser, createOrgUserWithPermissions } from "./testHarness";
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

async function errorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return webhookErrorCodeFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

describe("webhook endpoint configuration", () => {
  test("only events with a wired emit point are advertised and accepted", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const authed = authedForUser(t, userId, "session-webhook-events");

    expect(await authed.query(api.webhooks.listEvents, {})).toEqual([
      "collection.created",
      "loan.approved",
      "media.uploaded",
      "reproduction_request.decided",
      "reproduction_request.ended",
    ]);
    expect(
      await errorCodeOf(
        authed.mutation(api.webhooks.create, {
          organizationId,
          name: "Accessions",
          url: "https://example.com/accessions",
          events: ["accession.created"],
        }),
      ),
    ).toBe("WEBHOOK_EVENT_UNSUPPORTED");
  });

  test("an endpoint keeps legacy subscriptions it already has but cannot add new ones", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const authed = authedForUser(t, userId, "session-webhook-legacy");
    const webhookId = await t.run(async (ctx) =>
      ctx.db.insert("webhooks", {
        organizationId,
        name: "Legacy",
        url: "https://example.com/legacy",
        secret: "whsec_legacy",
        events: ["loan.created", "collection.created"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      }),
    );

    await authed.mutation(api.webhooks.update, {
      webhookId,
      events: ["loan.created", "collection.created", "media.uploaded"],
    });
    expect(
      (await authed.query(api.webhooks.get, { webhookId }))?.events,
    ).toEqual(["loan.created", "collection.created", "media.uploaded"]);
    expect(
      await errorCodeOf(
        authed.mutation(api.webhooks.update, {
          webhookId,
          events: ["loan.created", "loan.returned"],
        }),
      ),
    ).toBe("WEBHOOK_EVENT_UNSUPPORTED");
  });

  test("endpoints need a name and an https URL", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const authed = authedForUser(t, userId, "session-webhook-validation");

    for (const url of ["http://example.com/hook", "not a url", "https://"]) {
      expect(
        await errorCodeOf(
          authed.mutation(api.webhooks.create, {
            organizationId,
            name: "Insecure",
            url,
            events: ["collection.created"],
          }),
        ),
      ).toBe("WEBHOOK_URL_INVALID");
    }
    expect(
      await errorCodeOf(
        authed.mutation(api.webhooks.create, {
          organizationId,
          name: "   ",
          url: "https://example.com/hook",
          events: ["collection.created"],
        }),
      ),
    ).toBe("WEBHOOK_NAME_REQUIRED");

    const { id } = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Valid",
      url: "https://example.com/hook",
      events: ["collection.created"],
    });
    expect(
      await errorCodeOf(
        authed.mutation(api.webhooks.update, {
          webhookId: id,
          url: "http://example.com/hook",
        }),
      ),
    ).toBe("WEBHOOK_URL_INVALID");
  });
});

describe("webhook delivery", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("an event reaches only active endpoints subscribed to it", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["collections.create"],
      { subscriptionTier: "pro" },
    );

    await t.run(async (ctx) => {
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
    });

    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await authedForUser(t, userId).mutation(api.collections.create, {
      organizationId,
      accessionNumber: "WEBHOOK-ROUTE-001",
      title: "Routed Object",
    });
    await t.finishAllScheduledFunctions(() => {
      vi.runAllTimers();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.com/collection");
  });

  test("no event is recorded when no endpoint subscribes", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["collections.create", "organization.manage_settings"],
      { subscriptionTier: "pro" },
    );
    const authed = authedForUser(t, userId);
    await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Loans only",
      url: "https://example.com/loans",
      events: ["loan.approved"],
    });

    await authed.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "WEBHOOK-NONE-001",
      title: "Unrouted Object",
    });

    const { page } = await authed.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page).toEqual([]);
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
