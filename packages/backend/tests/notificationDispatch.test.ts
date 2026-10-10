import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  addMember,
  categoryChoices,
  notificationErrorOf,
} from "./notificationFixtures";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 17, 12);

async function setupCommentThread(t: ConvexTest) {
  const author = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
    "collections.update",
  ]);
  const [registrarId, curatorId] = await Promise.all([
    addMember(t, author.organizationId, "registrar", ["collections.read"]),
    addMember(t, author.organizationId, "curator", ["collections.read"]),
  ]);
  return {
    ...author,
    authorClient: authedForUser(t, author.userId),
    registrarId,
    curatorId,
  };
}

async function notificationTypesFor(
  t: ConvexTest,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
) {
  const center = await authedForUser(t, userId).query(
    api.notifications.getNotificationCenter,
    { organizationId },
  );
  return center.notifications.map((notification) => notification.type);
}

describe("notification preferences decide delivery", () => {
  test("a recipient who turns a category off receives nothing from it while others still do", async () => {
    const t = createConvexTest();
    const thread = await setupCommentThread(t);
    await authedForUser(t, thread.registrarId).mutation(
      api.notifications.updatePreferences,
      {
        organizationId: thread.organizationId,
        categories: categoryChoices({
          assignments: { enabled: false, email: false },
        }),
      },
    );

    await thread.authorClient.mutation(api.objectComments.create, {
      objectId: thread.collectionId,
      content: "Please check the frame, @registrar and @curator",
    });

    expect(
      await notificationTypesFor(t, thread.registrarId, thread.organizationId),
    ).toEqual([]);
    expect(
      await notificationTypesFor(t, thread.curatorId, thread.organizationId),
    ).toEqual(["comment_mention"]);
  });
});

describe("recipients must be members who may read the content", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a mentioned member without read access to objects is not told about the object", async () => {
    const t = createConvexTest();
    const thread = await setupCommentThread(t);
    const lenderLiaisonId = await addMember(
      t,
      thread.organizationId,
      "liaison",
      ["loans.read"],
    );

    await thread.authorClient.mutation(api.objectComments.create, {
      objectId: thread.collectionId,
      content: "@liaison and @curator, the lender asked about this one",
    });

    expect(
      await notificationTypesFor(t, lenderLiaisonId, thread.organizationId),
    ).toEqual([]);
    expect(
      await notificationTypesFor(t, thread.curatorId, thread.organizationId),
    ).toEqual(["comment_mention"]);
  });

  test("someone who left the organization is not notified about its work", async () => {
    const t = createConvexTest();
    vi.useFakeTimers();
    const stayer = await createOrgUserCollectionWithPermissions(t, [
      "collections.read",
      "collections.update",
    ]);
    const leaverId = await addMember(t, stayer.organizationId, "leaver", [
      "collections.read",
      "collections.update",
    ]);
    for (const userId of [stayer.userId, leaverId]) {
      await authedForUser(t, userId).mutation(
        api.batchOperations.createBulkEditJob,
        {
          organizationId: stayer.organizationId,
          collectionIds: [stayer.collectionId],
          updates: { condition: "good" },
        },
      );
    }
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", leaverId).eq("organizationId", stayer.organizationId),
        )
        .unique();
      if (membership) await ctx.db.delete(membership._id);
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(
      await notificationTypesFor(t, leaverId, stayer.organizationId),
    ).toEqual([]);
    expect(
      await notificationTypesFor(t, stayer.userId, stayer.organizationId),
    ).toEqual(["batch_job_completed"]);
  });
});

describe("each logical event notifies once", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("rerunning the daily insurance expiry check on the same day does not repeat its reminder", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "pro" },
    );
    await authedForUser(t, userId).mutation(api.insurance.createPolicy, {
      organizationId,
      policyNumber: "POL-ONCE",
      carrier: "Fine Art Underwriters",
      policyType: "scheduled",
      coverageAmount: 1_000_000,
      currency: "EUR",
      effectiveDate: NOW - 100 * DAY,
      expirationDate: NOW + 7 * DAY,
    });

    await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
    await t.mutation(internal.insurance.checkExpiringPoliciesInternal, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await notificationTypesFor(t, userId, organizationId)).toEqual([
      "insurance_expiry",
    ]);
  });

  test("rerunning the service-level check does not repeat a breach it already reported", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTest();
    const { organizationId, userId, roleId } =
      await createOrgUserWithPermissions(t, ["loans.read", "loans.approve"], {
        subscriptionTier: "pro",
      });
    await t.run(async (ctx) => {
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "LN-SLA-1",
        type: "outgoing",
        lenderBorrowerName: "Harbour Museum",
        startDate: NOW - 10 * DAY,
        status: "pending",
      });
      await ctx.db.insert("workflowSlaConfigs", {
        organizationId,
        workflowType: "loan",
        slaDays: 5,
        escalateToRoleId: roleId,
        isActive: true,
        createdBy: userId,
        createdAt: NOW - 20 * DAY,
      });
    });

    await t.mutation(internal.workflowSla.checkSlaBreaches, { organizationId });
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    await t.mutation(internal.workflowSla.checkSlaBreaches, { organizationId });

    expect(await notificationTypesFor(t, userId, organizationId)).toEqual([
      "sla_breach_loan",
    ]);
  });
});

describe("notification preferences belong to members", () => {
  test("someone outside the organization can neither read nor change its preferences", async () => {
    const t = createConvexTest();
    const home = await createOrgUserWithPermissions(t, ["collections.read"]);
    const outsider = await createOrgUserWithPermissions(
      t,
      ["collections.read"],
      { slugPrefix: "other-museum" },
    );
    const client = authedForUser(t, outsider.userId);

    expect(
      await client.query(api.notifications.getPreferences, {
        organizationId: home.organizationId,
      }),
    ).toBeNull();
    expect(
      await notificationErrorOf(
        client.mutation(api.notifications.updatePreferences, {
          organizationId: home.organizationId,
          categories: categoryChoices(),
        }),
      ),
    ).toBe("NOT_ORGANIZATION_MEMBER");
  });
});
