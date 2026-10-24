import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { webhookErrorCodeFromError } from "../convex/utils/webhookErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

type FetchCall = [string, RequestInit | undefined];

function hmacHex(secret: string, content: string) {
  return createHmac("sha256", secret).update(content).digest("hex");
}

function requestOf(call: FetchCall | undefined) {
  if (!call) throw new Error("Expected a webhook request");
  const [url, init] = call;
  return { url, headers: new Headers(init?.headers), body: String(init?.body) };
}

async function webhookErrorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return webhookErrorCodeFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

async function addMemberWithoutPermissions(
  t: ConvexTest,
  organizationId: Id<"organizations">,
) {
  return await t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        name: "Cataloguer",
        email: `member-${Math.random().toString(36).slice(2, 8)}@example.com`,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "Cataloguer",
        isSystemRole: false,
      }),
    ]);
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
}

async function setupIntegration(t: ConvexTest, events: string[]) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["organization.manage_settings", "collections.create"],
    { subscriptionTier: "pro" },
  );
  const admin = authedForUser(t, userId, "session-webhook-admin");
  const { id: webhookId, secret } = await admin.mutation(api.webhooks.create, {
    organizationId,
    name: "Collection system",
    url: "https://receiver.example.test/hooks",
    events,
  });
  return { organizationId, userId, admin, webhookId, secret };
}

async function createObject(
  admin: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
  title = "Delivered Object",
) {
  return await admin.mutation(api.collections.create, {
    organizationId,
    accessionNumber: `WH-${Math.random().toString(36).slice(2, 8)}`,
    title,
  });
}

async function drain(t: ConvexTest) {
  await t.finishAllScheduledFunctions(() => {
    vi.runAllTimers();
  });
}

describe("durable webhook deliveries", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("an emitted event is delivered once with verifiable signatures and logged as succeeded", async () => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId, secret } = await setupIntegration(
      t,
      ["collection.created"],
    );
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const collectionId = await createObject(admin, organizationId);
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requestOf(fetchMock.mock.calls[0] as FetchCall | undefined);
    expect(request.url).toBe("https://receiver.example.test/hooks");
    expect(request.headers.get("X-ML-Event")).toBe("collection.created");
    expect(request.headers.get("X-ML-Signature")).toBe(
      `sha256=${hmacHex(secret, request.body)}`,
    );

    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page).toHaveLength(1);
    const [delivery] = page;
    expect(delivery).toMatchObject({
      webhookId,
      webhookName: "Collection system",
      eventType: "collection.created",
      status: "succeeded",
      attemptCount: 1,
      lastResponseStatus: 200,
    });

    const deliveryId = request.headers.get("X-ML-Delivery");
    expect(deliveryId).toBe(delivery?._id);
    const timestamp = request.headers.get("X-ML-Timestamp");
    expect(timestamp).toMatch(/^\d+$/);
    expect(request.headers.get("X-ML-Signature-V2")).toBe(
      `v2=${hmacHex(secret, `${deliveryId}.${timestamp}.${request.body}`)}`,
    );

    const body = JSON.parse(request.body) as {
      id: string;
      event: string;
      version: number;
      timestamp: number;
      data: { collectionId: string; title: string };
    };
    expect(body).toMatchObject({
      event: "collection.created",
      version: 1,
      data: { collectionId, title: "Delivered Object" },
    });
    expect(body.id).toMatch(/^evt_[a-f0-9]{24}$/);

    const webhooks = await admin.query(api.webhooks.list, { organizationId });
    expect(webhooks[0]?.lastTriggeredAt).toBeTypeOf("number");
  });

  test("a transient failure is retried with the same delivery id and body until it succeeds", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestOf(fetchMock.mock.calls[0] as FetchCall | undefined);
    const second = requestOf(fetchMock.mock.calls[1] as FetchCall | undefined);
    expect(second.headers.get("X-ML-Delivery")).toBe(
      first.headers.get("X-ML-Delivery"),
    );
    expect(second.body).toBe(first.body);

    const deliveryId = first.headers.get(
      "X-ML-Delivery",
    ) as Id<"webhookDeliveries">;
    const details = await admin.query(api.webhookDeliveries.get, {
      organizationId,
      deliveryId,
    });
    expect(details?.delivery).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
      lastResponseStatus: 202,
    });
    expect(details?.delivery.lastErrorCode).toBeUndefined();
    expect(details?.event.body).toBe(first.body);
    expect(details?.event.payloadVersion).toBe(1);
    expect(
      details?.attempts.map(({ attemptNumber, outcome, responseStatus }) => ({
        attemptNumber,
        outcome,
        responseStatus,
      })),
    ).toEqual([
      { attemptNumber: 2, outcome: "succeeded", responseStatus: 202 },
      { attemptNumber: 1, outcome: "failed_transient", responseStatus: 503 },
    ]);
  });

  test("a receiver refusal ends the delivery as a permanent failure without retrying", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(async () => new Response("bad", { status: 410 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      status: "failed_permanent",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page).toHaveLength(1);
    expect(page[0]).toMatchObject({
      attemptCount: 1,
      lastResponseStatus: 410,
      lastErrorCode: "http_error",
    });
  });

  test("retryable failures back off between a bounded number of attempts", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(
      async () => new Response("slow down", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    const sentAt: number[] = [];
    fetchMock.mockImplementation(async () => {
      sentAt.push(Date.now());
      return new Response("slow down", { status: 429 });
    });
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const gaps = sentAt.slice(1).map((time, index) => time - sentAt[index]!);
    expect(gaps[0]).toBeGreaterThanOrEqual(24_000);
    for (let index = 1; index < gaps.length; index++) {
      expect(gaps[index]).toBeGreaterThan(gaps[index - 1]!);
    }

    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({
      status: "failed_transient",
      attemptCount: 6,
      maxAttempts: 6,
      lastResponseStatus: 429,
    });
    expect(page[0]?.nextAttemptAt).toBeUndefined();
  });

  test("a request that exceeds the timeout is aborted and retried", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      )
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(10_000);
    await drain(t);

    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const details = await admin.query(api.webhookDeliveries.get, {
      organizationId,
      deliveryId: page[0]!._id,
    });
    expect(details?.delivery.status).toBe("succeeded");
    expect(
      details?.attempts.map(({ outcome, errorCode }) => ({
        outcome,
        errorCode,
      })),
    ).toEqual([
      { outcome: "succeeded", errorCode: undefined },
      { outcome: "failed_transient", errorCode: "network_error" },
      { outcome: "failed_transient", errorCode: "timeout" },
    ]);
  });

  test.each([
    {
      revocation: "disabled",
      expectedCode: "endpoint_disabled",
      expectedName: "Collection system",
    },
    {
      revocation: "unsubscribed",
      expectedCode: "endpoint_unsubscribed",
      expectedName: "Collection system",
    },
    {
      revocation: "deleted",
      expectedCode: "endpoint_deleted",
      expectedName: null,
    },
  ] as const)("an endpoint $revocation before the attempt is cancelled without sending", async ({
    revocation,
    expectedCode,
    expectedName,
  }) => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId } = await setupIntegration(t, [
      "collection.created",
      "media.uploaded",
    ]);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    if (revocation === "disabled") {
      await admin.mutation(api.webhooks.update, {
        webhookId,
        isActive: false,
      });
    } else if (revocation === "unsubscribed") {
      await admin.mutation(api.webhooks.update, {
        webhookId,
        events: ["media.uploaded"],
      });
    } else {
      await admin.mutation(api.webhooks.deleteWebhook, { webhookId });
    }
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({
      status: "cancelled",
      attemptCount: 0,
      lastErrorCode: expectedCode,
      webhookName: expectedName,
    });
  });

  test("an administrator retry resends a failed delivery under the same delivery id", async () => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("gone", { status: 404 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await drain(t);
    const failed = requestOf(fetchMock.mock.calls[0] as FetchCall | undefined);
    const deliveryId = failed.headers.get(
      "X-ML-Delivery",
    ) as Id<"webhookDeliveries">;

    await admin.mutation(api.webhooks.update, { webhookId, isActive: false });
    expect(
      await webhookErrorCodeOf(
        admin.mutation(api.webhookDeliveries.retry, {
          organizationId,
          deliveryId,
        }),
      ),
    ).toBe("WEBHOOK_DISABLED");
    await admin.mutation(api.webhooks.update, { webhookId, isActive: true });

    await admin.mutation(api.webhookDeliveries.retry, {
      organizationId,
      deliveryId,
    });
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retried = requestOf(fetchMock.mock.calls[1] as FetchCall | undefined);
    expect(retried.headers.get("X-ML-Delivery")).toBe(deliveryId);
    expect(retried.body).toBe(failed.body);
    const details = await admin.query(api.webhookDeliveries.get, {
      organizationId,
      deliveryId,
    });
    expect(details?.delivery).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
      seriesAttempts: 1,
      retryCount: 1,
    });
    expect(details?.attempts.map((attempt) => attempt.outcome)).toEqual([
      "succeeded",
      "failed_permanent",
    ]);

    expect(
      await webhookErrorCodeOf(
        admin.mutation(api.webhookDeliveries.retry, {
          organizationId,
          deliveryId,
        }),
      ),
    ).toBe("DELIVERY_NOT_RETRYABLE");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("payloads and retries are visible only to settings managers of the owning organization", async () => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId } = await setupIntegration(t, [
      "collection.created",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 400 })),
    );
    vi.useFakeTimers();
    await createObject(admin, organizationId);
    await drain(t);
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const deliveryId = page[0]!._id;

    const foreign = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const foreignAdmin = authedForUser(t, foreign.userId, "session-foreign");
    expect(
      await foreignAdmin.query(api.webhookDeliveries.get, {
        organizationId: foreign.organizationId,
        deliveryId,
      }),
    ).toBeNull();
    expect(
      await webhookErrorCodeOf(
        foreignAdmin.mutation(api.webhookDeliveries.retry, {
          organizationId: foreign.organizationId,
          deliveryId,
        }),
      ),
    ).toBe("DELIVERY_NOT_FOUND");
    const foreignFiltered = await foreignAdmin.query(
      api.webhookDeliveries.list,
      {
        organizationId: foreign.organizationId,
        webhookId,
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(foreignFiltered.page).toEqual([]);
    await expect(
      foreignAdmin.query(api.webhookDeliveries.get, {
        organizationId,
        deliveryId,
      }),
    ).rejects.toThrow(/Permission denied/);

    const memberId = await addMemberWithoutPermissions(t, organizationId);
    const member = authedForUser(t, memberId, "session-member");
    await expect(
      member.query(api.webhookDeliveries.list, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow(/Permission denied/);
    await expect(
      member.mutation(api.webhookDeliveries.retry, {
        organizationId,
        deliveryId,
      }),
    ).rejects.toThrow(/Permission denied/);
  });

  test("a replayed or stale scheduled attempt does not send again", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    await createObject(admin, organizationId);
    await drain(t);
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const deliveryId = page[0]!._id;

    await t.action(internal.webhooksActions.attemptDelivery, {
      deliveryId,
      attempt: 1,
    });
    await t.action(internal.webhooksActions.attemptDelivery, {
      deliveryId,
      attempt: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const details = await admin.query(api.webhookDeliveries.get, {
      organizationId,
      deliveryId,
    });
    expect(details?.delivery).toMatchObject({
      status: "succeeded",
      attemptCount: 1,
    });
    expect(details?.attempts).toHaveLength(1);
  });

  test("the sweep reschedules a pending delivery whose scheduled attempt was lost", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await t.run(async (ctx) => {
      const scheduled = await ctx.db.system
        .query("_scheduled_functions")
        .collect();
      for (const job of scheduled) {
        if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
      }
    });
    await drain(t);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60_000);
    await t.mutation(internal.webhookDeliveries.sweep, {});
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({ status: "succeeded", attemptCount: 1 });
  });

  test("an attempt that never reported back is recorded as lost and retried after its lease", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const deliveryId = page[0]!._id;
    // The worker claims attempt 1 and its process dies before reporting.
    await t.mutation(internal.webhookDeliveries.claimAttempt, {
      deliveryId,
      attempt: 1,
    });
    await drain(t);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60_000);
    await t.mutation(internal.webhookDeliveries.sweep, {});
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const details = await admin.query(api.webhookDeliveries.get, {
      organizationId,
      deliveryId,
    });
    expect(details?.delivery).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
    expect(
      details?.attempts.map(({ attemptNumber, outcome, errorCode }) => ({
        attemptNumber,
        outcome,
        errorCode,
      })),
    ).toEqual([
      { attemptNumber: 2, outcome: "succeeded", errorCode: undefined },
      {
        attemptNumber: 1,
        outcome: "failed_transient",
        errorCode: "attempt_lost",
      },
    ]);
  });

  test("the sweep purges deliveries older than the 30-day retention window", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
    vi.useFakeTimers();

    await createObject(admin, organizationId, "Old Object");
    await drain(t);
    const old = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const oldDeliveryId = old.page[0]!._id;

    vi.advanceTimersByTime(29 * 24 * 60 * 60_000);
    await createObject(admin, organizationId, "Recent Object");
    await drain(t);
    vi.advanceTimersByTime(2 * 24 * 60 * 60_000);
    await t.mutation(internal.webhookDeliveries.sweep, {});
    await drain(t);

    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page).toHaveLength(1);
    expect(page[0]?._id).not.toBe(oldDeliveryId);
    expect(
      await admin.query(api.webhookDeliveries.get, {
        organizationId,
        deliveryId: oldDeliveryId,
      }),
    ).toBeNull();
  });

  test("attempts after a secret rotation are signed with the new secret", async () => {
    const t = createConvexTest();
    const {
      organizationId,
      admin,
      webhookId,
      secret: oldSecret,
    } = await setupIntegration(t, ["collection.created"]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 502 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await t.finishInProgressScheduledFunctions();
    const { secret: newSecret } = await admin.mutation(
      api.webhooks.rotateSecret,
      { webhookId },
    );
    await drain(t);

    expect(newSecret).not.toBe(oldSecret);
    const before = requestOf(fetchMock.mock.calls[0] as FetchCall | undefined);
    const after = requestOf(fetchMock.mock.calls[1] as FetchCall | undefined);
    expect(before.headers.get("X-ML-Signature")).toBe(
      `sha256=${hmacHex(oldSecret, before.body)}`,
    );
    expect(after.headers.get("X-ML-Signature")).toBe(
      `sha256=${hmacHex(newSecret, after.body)}`,
    );
  });

  test("a test send posts a fixture payload only to the chosen endpoint and is logged", async () => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId, secret } = await setupIntegration(
      t,
      ["collection.created"],
    );
    await admin.mutation(api.webhooks.create, {
      organizationId,
      name: "Other system",
      url: "https://other.example.test/hooks",
      events: ["collection.created"],
    });
    const fetchMock = vi.fn(async () => new Response("down", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const deliveryId = await admin.mutation(api.webhookDeliveries.sendTest, {
      organizationId,
      webhookId,
    });
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requestOf(fetchMock.mock.calls[0] as FetchCall | undefined);
    expect(request.url).toBe("https://receiver.example.test/hooks");
    expect(request.headers.get("X-ML-Event")).toBe("test");
    expect(request.headers.get("X-ML-Delivery")).toBe(deliveryId);
    expect(request.headers.get("X-ML-Signature")).toBe(
      `sha256=${hmacHex(secret, request.body)}`,
    );
    expect(JSON.parse(request.body)).toMatchObject({
      event: "test",
      version: 1,
      data: { message: "This is a test webhook delivery from MuseumLite" },
    });

    const details = await admin.query(api.webhookDeliveries.get, {
      organizationId,
      deliveryId,
    });
    expect(details?.delivery).toMatchObject({
      eventType: "test",
      status: "failed_transient",
      attemptCount: 1,
      maxAttempts: 1,
      lastResponseStatus: 500,
    });

    await admin.mutation(api.webhooks.update, { webhookId, isActive: false });
    expect(
      await webhookErrorCodeOf(
        admin.mutation(api.webhookDeliveries.sendTest, {
          organizationId,
          webhookId,
        }),
      ),
    ).toBe("WEBHOOK_DISABLED");

    const foreign = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    expect(
      await webhookErrorCodeOf(
        authedForUser(t, foreign.userId, "session-foreign").mutation(
          api.webhookDeliveries.sendTest,
          { organizationId: foreign.organizationId, webhookId },
        ),
      ),
    ).toBe("WEBHOOK_NOT_FOUND");

    const memberId = await addMemberWithoutPermissions(t, organizationId);
    await expect(
      authedForUser(t, memberId, "session-member").mutation(
        api.webhookDeliveries.sendTest,
        { organizationId, webhookId },
      ),
    ).rejects.toThrow(/Permission denied/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("each subscribed endpoint gets its own delivery of the same captured body", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    await admin.mutation(api.webhooks.create, {
      organizationId,
      name: "Second system",
      url: "https://second.example.test/hooks",
      events: ["collection.created"],
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map((call) =>
      requestOf(call as FetchCall),
    );
    expect(requests.map((request) => request.url).sort()).toEqual([
      "https://receiver.example.test/hooks",
      "https://second.example.test/hooks",
    ]);
    expect(requests[0]?.body).toBe(requests[1]?.body);
    expect(requests[0]?.headers.get("X-ML-Delivery")).not.toBe(
      requests[1]?.headers.get("X-ML-Delivery"),
    );
  });

  test("an endpoint saved earlier on a private address is never called", async () => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId } = await setupIntegration(t, [
      "collection.created",
    ]);
    // Saved before private addresses were refused when an endpoint is saved.
    await t.run(async (ctx) => {
      await ctx.db.patch(webhookId, { url: "https://10.0.0.5/hooks" });
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page).toHaveLength(1);
    expect(page[0]).toMatchObject({
      status: "failed_permanent",
      lastErrorCode: "endpoint_insecure",
    });
  });

  test("a redirect is not followed and fails the delivery permanently", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://elsewhere.example.test/" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as FetchCall;
    expect(init?.redirect).toBe("manual");
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({
      status: "failed_permanent",
      lastResponseStatus: 302,
      lastErrorCode: "http_error",
    });
  });

  test("a delivery whose event snapshot is gone is cancelled and cannot be retried", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await createObject(admin, organizationId);
    await t.run(async (ctx) => {
      for (const event of await ctx.db.query("webhookEvents").take(10)) {
        await ctx.db.delete(event._id);
      }
    });
    await drain(t);
    vi.advanceTimersByTime(10 * 60_000);
    await t.mutation(internal.webhookDeliveries.sweep, {});
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({
      status: "cancelled",
      lastErrorCode: "event_expired",
    });
    expect(
      await webhookErrorCodeOf(
        admin.mutation(api.webhookDeliveries.retry, {
          organizationId,
          deliveryId: page[0]!._id,
        }),
      ),
    ).toBe("DELIVERY_NOT_FOUND");
  });

  test("a delivery job queued by the previous emitter is recorded and delivered", async () => {
    const t = createConvexTest();
    const { organizationId, admin } = await setupIntegration(t, [
      "collection.created",
    ]);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await t.action(internal.webhooksActions.deliver, {
      organizationId,
      event: "collection.created",
      data: { title: "Queued before deploy" },
    });
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requestOf(fetchMock.mock.calls[0] as FetchCall | undefined);
    expect(JSON.parse(request.body)).toMatchObject({
      event: "collection.created",
      data: { title: "Queued before deploy" },
    });
    const { page } = await admin.query(api.webhookDeliveries.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]?.status).toBe("succeeded");
  });

  test("purging a library organization removes its delivery logs", async () => {
    const t = createConvexTest();
    const { organizationId, admin, webhookId } = await setupIntegration(t, [
      "collection.created",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    vi.useFakeTimers();
    await admin.mutation(api.webhookDeliveries.sendTest, {
      organizationId,
      webhookId,
    });
    await drain(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
      for (const entry of await ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(10)) {
        await ctx.db.delete(entry._id);
      }
    });

    await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
      organizationIds: [organizationId],
      dryRun: false,
    });

    const remaining = await t.run(async (ctx) => ({
      events: await ctx.db
        .query("webhookEvents")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
      deliveries: await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
      attempts: await ctx.db
        .query("webhookDeliveryAttempts")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
    }));
    expect(remaining).toEqual({ events: [], deliveries: [], attempts: [] });
  });
});
