import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { notificationErrorCodeFromError } from "../convex/utils/notificationErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

const PROVIDER_URL = "https://api.resend.com/emails";

type FetchCall = [string, RequestInit | undefined];
type CategoryName =
  | "approvals"
  | "reminders"
  | "alerts"
  | "assignments"
  | "system";

function providerRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return (fetchMock.mock.calls as FetchCall[]).map(([url, init]) => ({
    url,
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    },
  }));
}

function emailChoices(emailed: CategoryName[]) {
  const categories = [
    "approvals",
    "reminders",
    "alerts",
    "assignments",
    "system",
  ] as const;
  return Object.fromEntries(
    categories.map((category) => [
      category,
      { enabled: true, email: emailed.includes(category) },
    ]),
  ) as Record<CategoryName, { enabled: boolean; email: boolean }>;
}

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  username: string,
  permissionNames: string[],
) {
  return await t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        name: username,
        username,
        email: `${username}@example.test`,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: `${username} role`,
        isSystemRole: false,
      }),
    ]);
    for (const name of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
}

async function setupMentions(t: ConvexTest) {
  const author = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
    "collections.update",
  ]);
  const curatorId = await addMember(t, author.organizationId, "curator", [
    "collections.read",
  ]);
  const curator = authedForUser(t, curatorId);
  return {
    ...author,
    author: authedForUser(t, author.userId),
    curatorId,
    curator,
    mentionCurator: (content = "@curator please check the frame") =>
      authedForUser(t, author.userId).mutation(api.objectComments.create, {
        objectId: author.collectionId,
        content,
      }),
  };
}

async function notificationErrorOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return notificationErrorCodeFromError(error) ?? error;
  }
  throw new Error("Expected the call to be rejected");
}

function providerReplies(...responses: Array<() => Response>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(async () => response());
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const accepted = () => Response.json({ id: "email-fixture" }, { status: 200 });
const unavailable = () =>
  Response.json(
    { name: "service_unavailable", message: "Try again later" },
    { status: 503 },
  );
const refused = () =>
  Response.json(
    { name: "validation_error", message: "Invalid `to` field" },
    { status: 422 },
  );

async function drain(t: ConvexTest) {
  await t.finishAllScheduledFunctions(() => {
    vi.runAllTimers();
  });
}

async function centerFor(
  client: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
) {
  const center = await client.query(api.notifications.getNotificationCenter, {
    organizationId,
  });
  return center.notifications;
}

describe("instant notification email", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
    vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "notify@museum.example.test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("a recipient who turned email on for a category is emailed once and the center shows it delivered", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "email-fixture-1" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    await thread.mentionCurator();
    await drain(t);

    const requests = providerRequests(fetchMock);
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe(PROVIDER_URL);
    expect(request?.headers.get("Authorization")).toBe("Bearer re_fixture_key");
    expect(request?.headers.get("Idempotency-Key")).toMatch(/^[^:]+:0$/);
    expect(request?.body.to).toEqual(["curator@example.test"]);
    expect(request?.body.from).toBe("notify@museum.example.test");
    expect(request?.body.subject).toBe("You were mentioned");
    expect(request?.body.text).toContain("Test User mentioned you on");

    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.email).toMatchObject({
      status: "succeeded",
      attemptCount: 1,
    });
  });

  test("a retryable provider failure is resent under the same idempotency key until it is accepted", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    const fetchMock = providerReplies(unavailable, accepted);
    vi.useFakeTimers();

    await thread.mentionCurator();
    await drain(t);

    const [first, second] = providerRequests(fetchMock);
    expect(providerRequests(fetchMock)).toHaveLength(2);
    expect(second?.headers.get("Idempotency-Key")).toBe(
      first?.headers.get("Idempotency-Key"),
    );
    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.email).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
  });

  test("a refused email is reported to its recipient, who alone can resend it", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    const fetchMock = providerReplies(refused, accepted);
    vi.useFakeTimers();

    await thread.mentionCurator();
    await drain(t);

    const [failed] = await centerFor(thread.curator, thread.organizationId);
    expect(failed?.email).toMatchObject({
      status: "failed_permanent",
      attemptCount: 1,
      lastErrorCode: "http_error",
      lastResponseStatus: 422,
    });
    const deliveryId = failed?.email?.deliveryId;
    if (!deliveryId) throw new Error("Expected an email delivery");
    expect(
      await notificationErrorOf(
        thread.author.mutation(api.notificationEmails.retry, { deliveryId }),
      ),
    ).toBe("EMAIL_DELIVERY_NOT_FOUND");
    expect(
      await thread.author.query(api.notificationEmails.get, { deliveryId }),
    ).toBeNull();

    await thread.curator.mutation(api.notificationEmails.retry, { deliveryId });
    await drain(t);

    const [first, second] = providerRequests(fetchMock);
    expect(first?.headers.get("Idempotency-Key")).toBe(`${deliveryId}:0`);
    expect(second?.headers.get("Idempotency-Key")).toBe(`${deliveryId}:1`);
    const trace = await thread.curator.query(api.notificationEmails.get, {
      deliveryId,
    });
    expect(trace?.delivery).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
    expect(
      trace?.attempts.map(({ attemptNumber, outcome, responseStatus }) => ({
        attemptNumber,
        outcome,
        responseStatus,
      })),
    ).toEqual([
      { attemptNumber: 2, outcome: "succeeded", responseStatus: 200 },
      { attemptNumber: 1, outcome: "failed_permanent", responseStatus: 422 },
    ]);
    expect(
      await notificationErrorOf(
        thread.curator.mutation(api.notificationEmails.retry, { deliveryId }),
      ),
    ).toBe("EMAIL_DELIVERY_NOT_RETRYABLE");
  });

  test("turning email off before the send cancels the email without sending it", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    const fetchMock = providerReplies(accepted);
    vi.useFakeTimers();

    await thread.mentionCurator();
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices([]),
    });
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.email).toMatchObject({
      status: "cancelled",
      lastErrorCode: "email_disabled",
    });
    expect(
      await notificationErrorOf(
        thread.curator.mutation(api.notificationEmails.retry, {
          deliveryId: notification?.email?.deliveryId as Id<"notificationEmailDeliveries">,
        }),
      ),
    ).toBe("EMAIL_OFF_FOR_CATEGORY");
  });

  test("a recipient who leaves the organization before the send is not emailed", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    const fetchMock = providerReplies(accepted);
    vi.useFakeTimers();

    await thread.mentionCurator();
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q
            .eq("userId", thread.curatorId)
            .eq("organizationId", thread.organizationId),
        )
        .unique();
      if (membership) await ctx.db.delete(membership._id);
    });
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.email).toMatchObject({
      status: "cancelled",
      lastErrorCode: "recipient_removed",
    });
  });

  test("a duplicate request still running at the provider is retried rather than failed", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    providerReplies(
      () =>
        Response.json(
          {
            name: "concurrent_idempotent_requests",
            message: "Same idempotency key in progress",
          },
          { status: 409 },
        ),
      accepted,
    );
    vi.useFakeTimers();

    await thread.mentionCurator();
    await drain(t);

    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.email).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
  });

  test("an attempt that never reported back is recorded as lost and resent under the same key", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    const fetchMock = providerReplies(accepted);
    vi.useFakeTimers();

    await thread.mentionCurator();
    const [pending] = await centerFor(thread.curator, thread.organizationId);
    const deliveryId = pending?.email?.deliveryId;
    if (!deliveryId) throw new Error("Expected an email delivery");
    // The worker claims attempt 1 and its process dies before reporting.
    await t.mutation(internal.notificationEmails.claimAttempt, {
      deliveryId,
      attempt: 1,
    });
    await drain(t);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60_000);
    await t.mutation(internal.notificationEmails.sweep, {});
    await drain(t);

    expect(providerRequests(fetchMock)[0]?.headers.get("Idempotency-Key")).toBe(
      `${deliveryId}:0`,
    );
    const trace = await thread.curator.query(api.notificationEmails.get, {
      deliveryId,
    });
    expect(
      trace?.attempts.map(({ attemptNumber, outcome, errorCode }) => ({
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

  test("email logs and intents older than 30 days are purged while notifications remain", async () => {
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
    });
    providerReplies(accepted, accepted);
    vi.useFakeTimers();

    await thread.mentionCurator("@curator first look");
    await drain(t);
    vi.advanceTimersByTime(29 * 24 * 60 * 60_000);
    await thread.mentionCurator("@curator second look");
    await drain(t);
    vi.advanceTimersByTime(2 * 24 * 60 * 60_000);
    await t.mutation(internal.notificationEmails.sweep, {});
    await drain(t);

    const notifications = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notifications).toHaveLength(2);
    expect(notifications.map((notification) => notification.email?.status)).toEqual([
      "succeeded",
      undefined,
    ]);
  });
});

describe("email is offered only when it can be delivered", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("a deployment without an email provider does not offer or send email", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "");
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationPreferences", {
        userId: thread.curatorId,
        organizationId: thread.organizationId,
        emailEnabled: true,
        emailDigestFrequency: "instant",
      });
    });
    const fetchMock = providerReplies(accepted);
    vi.useFakeTimers();

    const preferences = await thread.curator.query(
      api.notifications.getPreferences,
      { organizationId: thread.organizationId },
    );
    expect(preferences?.email.channel).toBe("unavailable");
    expect(
      await notificationErrorOf(
        thread.curator.mutation(api.notifications.updatePreferences, {
          organizationId: thread.organizationId,
          categories: emailChoices(["alerts"]),
        }),
      ),
    ).toBe("EMAIL_CHANNEL_UNAVAILABLE");

    await thread.mentionCurator();
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.email).toBeNull();
  });

  test("choices saved by the previous settings page keep emailing approvals and tasks only", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
    vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "notify@museum.example.test");
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationPreferences", {
        userId: thread.curatorId,
        organizationId: thread.organizationId,
        emailEnabled: true,
        emailDigestFrequency: "instant",
      });
    });
    const fetchMock = providerReplies(accepted);
    vi.useFakeTimers();

    const preferences = await thread.curator.query(
      api.notifications.getPreferences,
      { organizationId: thread.organizationId },
    );
    expect(preferences).toMatchObject({
      categories: {
        approvals: { enabled: true, email: true },
        reminders: { enabled: true, email: false },
        alerts: { enabled: true, email: false },
        assignments: { enabled: true, email: true },
        system: { enabled: true, email: false },
      },
      email: {
        channel: "provider",
        address: "curator@example.test",
        savedDigest: null,
      },
    });

    await thread.mentionCurator();
    await drain(t);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a saved daily digest sends nothing and is reported as not delivered", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
    vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "notify@museum.example.test");
    const t = createConvexTest();
    const thread = await setupMentions(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationPreferences", {
        userId: thread.curatorId,
        organizationId: thread.organizationId,
        emailEnabled: true,
        emailDigestFrequency: "daily",
      });
    });
    const fetchMock = providerReplies(accepted);
    vi.useFakeTimers();

    const preferences = await thread.curator.query(
      api.notifications.getPreferences,
      { organizationId: thread.organizationId },
    );
    expect(preferences?.email.savedDigest).toBe("daily");

    await thread.mentionCurator();
    await drain(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const [notification] = await centerFor(
      thread.curator,
      thread.organizationId,
    );
    expect(notification?.type).toBe("comment_mention");
    expect(notification?.email).toBeNull();
  });
});
