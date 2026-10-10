import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
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
  return {
    organizationId: author.organizationId,
    curatorId,
    curator: authedForUser(t, curatorId),
    harbourMap,
    bronzeBell,
    mentionCurator: (objectId: Id<"collections">) =>
      authorClient.mutation(api.objectComments.create, {
        objectId,
        content: "@curator please check this one",
      }),
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
    await thread.curator.mutation(api.notifications.updatePreferences, {
      organizationId: thread.organizationId,
      categories: emailChoices(["assignments"]),
      emailSchedule: { cadence: "daily", time: "08:00", timezone: NEW_YORK },
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
    const center = await thread.curator.query(
      api.notifications.getNotificationCenter,
      { organizationId: thread.organizationId },
    );
    expect(
      center.notifications.map((notification) => notification.email),
    ).toMatchObject([
      { status: "succeeded", digest: { cadence: "daily" } },
      { status: "succeeded", digest: { cadence: "daily" } },
    ]);
  });
});
