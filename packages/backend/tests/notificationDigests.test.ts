import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { EmailSchedule } from "../convex/utils/notificationPreferences";
import type { NotificationCategory } from "../convex/utils/notificationTypes";
import {
  addMember,
  emailChoices,
  notificationErrorOf,
} from "./notificationFixtures";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

const NEW_YORK = "America/New_York";

interface SentEmail {
  at: number;
  idempotencyKey: string | null;
  to: string[];
  subject: string;
  text: string;
}

const DAY = 24 * 60 * 60 * 1000;

const accepted = () => Response.json({ id: "email-fixture" }, { status: 200 });
const refused = () =>
  Response.json(
    { name: "validation_error", message: "Invalid `to` field" },
    { status: 422 },
  );
const unavailable = () =>
  Response.json(
    { name: "service_unavailable", message: "Try again later" },
    { status: 503 },
  );

/** Stands in for the email provider; replies in order, then accepts. */
function emailProvider(...replies: Array<() => Response>) {
  const sent: SentEmail[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Omit<SentEmail, "at">;
      sent.push({
        at: Date.now(),
        idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
        to: body.to,
        subject: body.subject,
        text: body.text,
      });
      return (replies.shift() ?? accepted)();
    }),
  );
  return sent;
}

/** Runs every scheduled function that is due now, and what they schedule now. */
async function runDueWork(t: ConvexTest) {
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
}

/** Moves the clock forward to `iso` and runs what became due. */
async function advanceTo(t: ConvexTest, iso: string) {
  vi.advanceTimersByTime(Date.parse(iso) - Date.now());
  await runDueWork(t);
}

const DAILY_AT_EIGHT: EmailSchedule = {
  cadence: "daily",
  time: "08:00",
  timezone: NEW_YORK,
};

async function revokePermission(
  t: ConvexTest,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  permissionName: string,
) {
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", organizationId),
      )
      .unique();
    if (!membership) throw new Error("Expected a membership");
    for (const grant of await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", membership.roleId))
      .collect()) {
      const permission = await ctx.db.get(grant.permissionId);
      if (permission?.name === permissionName) await ctx.db.delete(grant._id);
    }
  });
}

async function grantPermissions(
  t: ConvexTest,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  permissionNames: string[],
) {
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", organizationId),
      )
      .unique();
    if (!membership) throw new Error("Expected a membership");
    for (const name of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId: membership.roleId,
        permissionId,
      });
    }
  });
}

async function setupDigestThread(t: ConvexTest) {
  const author = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
    "collections.update",
  ]);
  const curatorId = await addMember(t, author.organizationId, "curator", [
    "collections.read",
    "collections.update",
  ]);
  const [harbourMap, bronzeBell] = await t.run(async (ctx) =>
    Promise.all(
      ["Harbour Map", "Bronze Bell"].map((title) =>
        ctx.db.insert("collections", {
          organizationId: author.organizationId,
          accessionNumber: `OBJ-${title}`,
          title,
          status: "active",
          catalogedBy: author.userId,
          catalogedAt: Date.now(),
        }),
      ),
    ),
  );
  const authorClient = authedForUser(t, author.userId);
  const curator = authedForUser(t, curatorId);
  return {
    organizationId: author.organizationId,
    author: authorClient,
    curatorId,
    curator,
    harbourMap,
    bronzeBell,
    mentionCurator: (objectId: Id<"collections">) =>
      authorClient.mutation(api.objectComments.create, {
        objectId,
        content: "@curator please check this one",
      }),
    /** A bulk edit the curator runs, which notifies them in System when done. */
    runBulkEdit: async () => {
      await curator.mutation(api.batchOperations.createBulkEditJob, {
        organizationId: author.organizationId,
        collectionIds: [harbourMap],
        updates: { condition: "good" },
      });
      await runDueWork(t);
    },
    chooseEmail: (
      emailed: NotificationCategory[],
      emailSchedule: EmailSchedule,
    ) =>
      curator.mutation(api.notifications.updatePreferences, {
        organizationId: author.organizationId,
        categories: emailChoices(emailed),
        emailSchedule,
      }),
    preferences: () =>
      curator.query(api.notifications.getPreferences, {
        organizationId: author.organizationId,
      }),
    /** The curator's notifications, newest first, with how each was emailed. */
    center: async () =>
      (
        await curator.query(api.notifications.getNotificationCenter, {
          organizationId: author.organizationId,
        })
      ).notifications,
  };
}

describe("daily and weekly digests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
    vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "notify@museum.example.test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("a recipient who chose a daily digest is emailed once at their local digest time with every notification since", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], {
      cadence: "daily",
      time: "08:00",
      timezone: NEW_YORK,
    });
    const sent = emailProvider();

    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-10-12T17:00:00Z");
    await thread.mentionCurator(thread.bronzeBell);
    await advanceTo(t, "2026-10-13T11:59:00Z");
    expect(sent).toEqual([]);

    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent).toHaveLength(1);
    const [digest] = sent;
    expect(digest?.at).toBe(Date.parse("2026-10-13T12:00:00Z"));
    expect(digest?.to).toEqual(["curator@example.test"]);
    expect(digest?.subject).toContain("daily digest");
    expect(digest?.text).toContain("Test User mentioned you on Harbour Map");
    expect(digest?.text).toContain("Test User mentioned you on Bronze Bell");
    expect(
      (await thread.center()).map((notification) => notification.email),
    ).toMatchObject([
      { status: "succeeded", digest: { cadence: "daily" } },
      { status: "succeeded", digest: { cadence: "daily" } },
    ]);
  });

  test("a weekly digest arrives on the chosen weekday at the local time in force after clocks change", async () => {
    vi.setSystemTime(new Date("2026-03-05T15:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], {
      cadence: "weekly",
      day: 1,
      time: "09:00",
      timezone: NEW_YORK,
    });
    const sent = emailProvider();

    await thread.mentionCurator(thread.harbourMap);

    expect((await thread.preferences())?.email).toMatchObject({
      schedule: {
        cadence: "weekly",
        day: 1,
        time: "09:00",
        timezone: NEW_YORK,
      },
      nextDigest: {
        scheduledFor: Date.parse("2026-03-09T13:00:00Z"),
        notificationCount: 1,
      },
    });
    await advanceTo(t, "2026-03-09T12:59:00Z");
    expect(sent).toEqual([]);
    await advanceTo(t, "2026-03-09T13:00:00Z");
    expect(sent.map(({ at, subject }) => ({ at, subject }))).toEqual([
      {
        at: Date.parse("2026-03-09T13:00:00Z"),
        subject: "Your weekly digest from Test Museum: 1 notification",
      },
    ]);
    expect((await thread.preferences())?.email.nextDigest).toBeNull();
  });

  test("a daily digest moves past a skipped local time and runs once on a repeated one", async () => {
    vi.setSystemTime(new Date("2026-03-07T12:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], {
      cadence: "daily",
      time: "02:30",
      timezone: NEW_YORK,
    });
    const sent = emailProvider();

    // 02:30 does not exist on 8 March in New York; the digest goes at 03:30.
    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-03-08T07:30:00Z");
    expect(sent.map(({ at }) => at)).toEqual([
      Date.parse("2026-03-08T07:30:00Z"),
    ]);

    await thread.chooseEmail(["assignments"], {
      cadence: "daily",
      time: "01:30",
      timezone: NEW_YORK,
    });
    await advanceTo(t, "2026-10-31T12:00:00Z");
    // 01:30 happens twice on 1 November; the digest goes at the first.
    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-11-01T05:30:00Z");
    await advanceTo(t, "2026-11-01T05:45:00Z");
    await thread.mentionCurator(thread.bronzeBell);
    await advanceTo(t, "2026-11-02T06:30:00Z");

    expect(sent.map(({ at }) => at)).toEqual([
      Date.parse("2026-03-08T07:30:00Z"),
      Date.parse("2026-11-01T05:30:00Z"),
      Date.parse("2026-11-02T06:30:00Z"),
    ]);
    expect(sent[2]?.text).toContain("Bronze Bell");
    expect(sent[2]?.text).not.toContain("Harbour Map");
  });

  test("a digest whose run was missed is sent once by the sweep, and later notifications keep their own digest", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], {
      cadence: "daily",
      time: "08:00",
      timezone: NEW_YORK,
    });
    const sent = emailProvider();
    await thread.mentionCurator(thread.harbourMap);
    await t.run(async (ctx) => {
      for (const job of await ctx.db.system
        .query("_scheduled_functions")
        .collect()) {
        if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
      }
    });

    await advanceTo(t, "2026-10-13T15:00:00Z");
    expect(sent).toEqual([]);
    await thread.mentionCurator(thread.bronzeBell);
    await advanceTo(t, "2026-10-13T16:00:00Z");
    await t.mutation(internal.notificationEmails.sweep, {});
    await runDueWork(t);
    await t.mutation(internal.notificationEmails.sweep, {});
    await advanceTo(t, "2026-10-14T12:00:00Z");

    expect(sent.map(({ at }) => at)).toEqual([
      Date.parse("2026-10-13T16:00:00Z"),
      Date.parse("2026-10-14T12:00:00Z"),
    ]);
    expect(sent[0]?.text).toContain("Harbour Map");
    expect(sent[0]?.text).not.toContain("Bronze Bell");
    expect(sent[1]?.text).toContain("Bronze Bell");
    expect(sent[1]?.text).not.toContain("Harbour Map");
  });

  test("categories that are not emailed stay out of the digest", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider();

    await thread.runBulkEdit();
    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("Harbour Map");
    expect(sent[0]?.text).not.toContain("Processed 1 of 1 items");
    expect(
      (await thread.center()).map(({ type, email }) => ({
        type,
        status: email?.status,
      })),
    ).toEqual([
      { type: "comment_mention", status: "succeeded" },
      { type: "batch_job_completed", status: undefined },
    ]);
  });

  test("a category whose email is turned off before the digest is left out of it", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments", "system"], DAILY_AT_EIGHT);
    const sent = emailProvider();

    await thread.runBulkEdit();
    await thread.mentionCurator(thread.harbourMap);
    await thread.chooseEmail(["system"], DAILY_AT_EIGHT);
    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("Processed 1 of 1 items");
    expect(sent[0]?.text).not.toContain("Harbour Map");
    expect(
      (await thread.center()).map(({ type, email }) => ({
        type,
        status: email?.status,
        excludedReason: email?.digest?.excludedReason,
      })),
    ).toEqual([
      {
        type: "comment_mention",
        status: "succeeded",
        excludedReason: "email_disabled",
      },
      {
        type: "batch_job_completed",
        status: "succeeded",
        excludedReason: undefined,
      },
    ]);
  });

  test("a recipient who can no longer read a record is not shown it in the digest", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments", "system"], DAILY_AT_EIGHT);
    const sent = emailProvider();

    await thread.runBulkEdit();
    await thread.mentionCurator(thread.harbourMap);
    await revokePermission(
      t,
      thread.curatorId,
      thread.organizationId,
      "collections.read",
    );
    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("Processed 1 of 1 items");
    expect(sent[0]?.text).not.toContain("Harbour Map");
    const [mention] = await thread.center();
    expect(mention?.email?.digest?.excludedReason).toBe("access_revoked");
  });

  test("a recipient who leaves the organization before the digest is not emailed", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider();
    await thread.mentionCurator(thread.harbourMap);
    const [pending] = await thread.center();
    const deliveryId = pending?.email?.deliveryId;
    if (!deliveryId) throw new Error("Expected a digest");

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
    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent).toEqual([]);
    expect(
      (await thread.curator.query(api.notificationEmails.get, { deliveryId }))
        ?.delivery,
    ).toMatchObject({
      status: "cancelled",
      lastErrorCode: "recipient_removed",
    });
  });

  test("replaying the job that notified and the digest's own run sends one digest listing the notification once", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await grantPermissions(t, thread.curatorId, thread.organizationId, [
      "organization.manage_settings",
      "loans.read",
    ]);
    await thread.chooseEmail(["reminders"], DAILY_AT_EIGHT);
    const sent = emailProvider();
    await t.run(async (ctx) => {
      await ctx.db.insert("insurancePolicies", {
        organizationId: thread.organizationId,
        policyNumber: "POL-DIGEST",
        carrier: "Fine Art Underwriters",
        policyType: "scheduled",
        coverageAmount: 1_000_000,
        currency: "EUR",
        effectiveDate: Date.now() - 100 * DAY,
        expirationDate: Date.now() + 7 * DAY,
        status: "active",
        createdBy: thread.curatorId,
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
    await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
    await advanceTo(t, "2026-10-13T12:00:00Z");
    const [reminder] = await thread.center();
    const deliveryId = reminder?.email?.deliveryId;
    if (!deliveryId) throw new Error("Expected a digest");
    await t.action(internal.notificationEmailsActions.attemptDelivery, {
      deliveryId,
      attempt: 1,
    });
    await t.mutation(internal.notificationEmails.sweep, {});
    await advanceTo(t, "2026-10-13T13:00:00Z");
    await t.mutation(internal.notificationEmails.sweep, {});
    await runDueWork(t);

    expect(sent).toHaveLength(1);
    expect(
      sent[0]?.text.match(/Insurance Policy Expiring in 7 Days/g),
    ).toHaveLength(1);
    expect(await thread.center()).toHaveLength(1);
  });

  test("a refused digest is reported on each of its notifications, and only its recipient can resend it", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider(refused);
    await thread.mentionCurator(thread.harbourMap);
    await thread.mentionCurator(thread.bronzeBell);

    await advanceTo(t, "2026-10-13T12:00:00Z");

    const failed = await thread.center();
    expect(failed.map(({ email }) => email)).toMatchObject([
      { status: "failed_permanent", lastResponseStatus: 422 },
      { status: "failed_permanent", lastResponseStatus: 422 },
    ]);
    const deliveryId = failed[0]?.email?.deliveryId;
    if (!deliveryId) throw new Error("Expected a digest");
    expect(failed[1]?.email?.deliveryId).toBe(deliveryId);
    expect(
      await notificationErrorOf(
        thread.author.mutation(api.notificationEmails.retry, { deliveryId }),
      ),
    ).toBe("EMAIL_DELIVERY_NOT_FOUND");
    expect(
      await thread.author.query(api.notificationEmails.get, { deliveryId }),
    ).toBeNull();

    await thread.curator.mutation(api.notificationEmails.retry, { deliveryId });
    await runDueWork(t);

    expect(sent).toHaveLength(2);
    expect(sent[0]?.idempotencyKey?.startsWith(`${deliveryId}:0:`)).toBe(true);
    expect(sent[1]?.idempotencyKey?.startsWith(`${deliveryId}:1:`)).toBe(true);
    expect(sent[1]?.text).toContain("Harbour Map");
    expect(sent[1]?.text).toContain("Bronze Bell");
    expect((await thread.center()).map(({ email }) => email)).toMatchObject([
      { status: "succeeded", attemptCount: 2 },
      { status: "succeeded", attemptCount: 2 },
    ]);
    const trace = await thread.curator.query(api.notificationEmails.get, {
      deliveryId,
    });
    expect(
      trace?.attempts.map(({ attemptNumber, outcome }) => ({
        attemptNumber,
        outcome,
      })),
    ).toEqual([
      { attemptNumber: 2, outcome: "succeeded" },
      { attemptNumber: 1, outcome: "failed_permanent" },
    ]);
    expect(
      await notificationErrorOf(
        thread.curator.mutation(api.notificationEmails.retry, { deliveryId }),
      ),
    ).toBe("EMAIL_DELIVERY_NOT_RETRYABLE");
  });

  test("a digest the provider cannot take yet is resent under the same key until it is accepted", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider(unavailable);
    await thread.mentionCurator(thread.harbourMap);

    await advanceTo(t, "2026-10-13T12:00:00Z");
    const [retrying] = await thread.center();
    expect(retrying?.email).toMatchObject({
      status: "pending",
      attemptCount: 1,
      lastResponseStatus: 503,
    });
    await advanceTo(t, "2026-10-13T12:01:00Z");

    expect(sent).toHaveLength(2);
    expect(sent[1]?.idempotencyKey).toBe(sent[0]?.idempotencyKey);
    const [delivered] = await thread.center();
    expect(delivered?.email).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
  });

  test("changing the digest time moves the waiting digest to the new time", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider();
    await thread.mentionCurator(thread.harbourMap);

    await thread.chooseEmail(["assignments"], {
      cadence: "daily",
      time: "18:00",
      timezone: NEW_YORK,
    });
    expect((await thread.preferences())?.email.nextDigest).toEqual({
      scheduledFor: Date.parse("2026-10-12T22:00:00Z"),
      notificationCount: 1,
    });
    await advanceTo(t, "2026-10-12T22:00:00Z");
    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent.map(({ at }) => at)).toEqual([
      Date.parse("2026-10-12T22:00:00Z"),
    ]);
  });

  test("switching to instant email sends the waiting digest right away and then emails each notification", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider();
    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-10-12T15:00:00Z");

    await thread.chooseEmail(["assignments"], { cadence: "instant" });
    await runDueWork(t);
    await thread.mentionCurator(thread.bronzeBell);
    await runDueWork(t);

    expect(sent.map(({ at, subject }) => ({ at, subject }))).toEqual([
      {
        at: Date.parse("2026-10-12T15:00:00Z"),
        subject: "Your daily digest from Test Museum: 1 notification",
      },
      { at: Date.parse("2026-10-12T15:00:00Z"), subject: "You were mentioned" },
    ]);
    expect((await thread.preferences())?.email.nextDigest).toBeNull();
  });

  test("a digest time, weekday or time zone that does not exist is refused", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    const invalid: EmailSchedule[] = [
      { cadence: "daily", time: "24:00", timezone: NEW_YORK },
      { cadence: "daily", time: "8:00", timezone: NEW_YORK },
      { cadence: "weekly", day: 7, time: "08:00", timezone: NEW_YORK },
      { cadence: "weekly", day: 1.5, time: "08:00", timezone: NEW_YORK },
      { cadence: "daily", time: "08:00", timezone: "Mars/Olympus" },
    ];
    for (const schedule of invalid) {
      expect(
        await notificationErrorOf(
          thread.chooseEmail(["assignments"], schedule),
        ),
      ).toBe("DIGEST_SCHEDULE_INVALID");
    }
    expect((await thread.preferences())?.email.schedule).toEqual({
      cadence: "instant",
    });
  });

  test("a digest chosen before digests had a time sends nothing until the recipient saves one", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationPreferences", {
        userId: thread.curatorId,
        organizationId: thread.organizationId,
        emailEnabled: true,
        emailDigestFrequency: "weekly",
      });
    });
    const sent = emailProvider();

    expect((await thread.preferences())?.email).toMatchObject({
      schedule: { cadence: "weekly", day: 1, time: "08:00" },
      digestUnscheduled: true,
      nextDigest: null,
    });
    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-10-20T12:00:00Z");
    expect(sent).toEqual([]);

    await thread.chooseEmail(["assignments"], {
      cadence: "weekly",
      day: 1,
      time: "09:00",
      timezone: NEW_YORK,
    });
    expect((await thread.preferences())?.email.digestUnscheduled).toBe(false);
    await thread.mentionCurator(thread.bronzeBell);
    await advanceTo(t, "2026-10-26T13:00:00Z");

    expect(sent.map(({ at }) => at)).toEqual([
      Date.parse("2026-10-26T13:00:00Z"),
    ]);
    expect(sent[0]?.text).toContain("Bronze Bell");
    expect(sent[0]?.text).not.toContain("Harbour Map");
  });

  test("more than one hundred notifications before one digest time are each emailed exactly once", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    const sent = emailProvider();

    for (let index = 0; index < 101; index++) {
      await thread.mentionCurator(thread.harbourMap);
    }
    expect((await thread.preferences())?.email.nextDigest).toEqual({
      scheduledFor: Date.parse("2026-10-13T12:00:00Z"),
      notificationCount: 101,
    });
    await advanceTo(t, "2026-10-13T12:00:00Z");

    expect(sent.map(({ subject }) => subject).sort()).toEqual([
      "Your daily digest from Test Museum: 1 notification",
      "Your daily digest from Test Museum: 100 notifications",
    ]);
    expect(
      sent.flatMap(
        ({ text }) => text.match(/mentioned you on Harbour Map/g) ?? [],
      ),
    ).toHaveLength(101);
    const center = await thread.curator.query(
      api.notifications.getNotificationCenter,
      { organizationId: thread.organizationId, limit: 200 },
    );
    expect(
      center.notifications.every(({ email }) => email?.status === "succeeded"),
    ).toBe(true);
  });

  test("digest logs older than 30 days are purged while the notifications stay", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    emailProvider();
    await thread.mentionCurator(thread.harbourMap);
    await advanceTo(t, "2026-10-13T12:00:00Z");
    expect((await thread.center())[0]?.email?.status).toBe("succeeded");

    await advanceTo(t, "2026-11-12T15:00:00Z");
    await t.mutation(internal.notificationEmails.sweep, {});
    await runDueWork(t);

    const notifications = await thread.center();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.email).toBeNull();
  });

  test("purging an organization removes its digests and their notification lists", async () => {
    vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
    const t = createConvexTest();
    const thread = await setupDigestThread(t);
    await thread.chooseEmail(["assignments"], DAILY_AT_EIGHT);
    emailProvider();
    await thread.mentionCurator(thread.harbourMap);
    await t.run(async (ctx) => {
      await ctx.db.patch(thread.organizationId, { type: "library" });
      for (const table of [
        "auditLog",
        "objectComments",
        "collections",
      ] as const) {
        for (const row of await ctx.db
          .query(table)
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", thread.organizationId),
          )
          .take(10)) {
          await ctx.db.delete(row._id);
        }
      }
    });

    await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
      organizationIds: [thread.organizationId],
      dryRun: false,
    });

    const remaining = await t.run(async (ctx) => ({
      deliveries: await ctx.db
        .query("notificationEmailDeliveries")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", thread.organizationId),
        )
        .take(1),
      items: await ctx.db
        .query("notificationDigestItems")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", thread.organizationId),
        )
        .take(1),
    }));
    expect(remaining).toEqual({ deliveries: [], items: [] });
  });
});
