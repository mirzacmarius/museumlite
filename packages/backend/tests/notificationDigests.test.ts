import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { EmailSchedule } from "../convex/utils/notificationPreferences";
import type { NotificationCategory } from "../convex/utils/notificationTypes";
import { addMember, emailChoices } from "./notificationFixtures";
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

const accepted = () => Response.json({ id: "email-fixture" }, { status: 200 });

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
});
