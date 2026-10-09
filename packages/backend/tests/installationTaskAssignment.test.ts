import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { workErrorFromError } from "../convex/utils/workErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

vi.mock("../convex/env", () => ({
  env: {
    RESEND_API_KEY: "test-resend-key",
    RESEND_SENDER_EMAIL_AUTH: "auth@example.test",
    SITE_URL: "https://museum.example.test",
    CONVEX_SITE_URL: "https://museum.convex.site",
  },
}));

const sent = vi.hoisted(() => ({
  emails: [] as Array<{ to: string | string[]; html: string }>,
}));

vi.mock("../convex/email", () => ({
  sendEmail: vi.fn(async (message: { to: string | string[]; html: string }) => {
    sent.emails.push(message);
    return { status: "success" };
  }),
}));

beforeEach(() => {
  sent.emails = [];
});

afterEach(() => {
  vi.useRealTimers();
});

const INSTALLER_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
];

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  email: string,
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: email, email });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: `${email} role`,
      isSystemRole: false,
    });
    for (const name of INSTALLER_PERMISSIONS) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: 1,
    });
    return userId;
  });
}

async function setup() {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    INSTALLER_PERMISSIONS,
    { subscriptionTier: "pro", slugPrefix: "install-assign" },
  );
  const manager = authedForUser(t, userId);
  const exhibitionId = await t.run((ctx) =>
    ctx.db.insert("exhibitions", {
      organizationId,
      title: "Summer Show",
      startDate: 1,
      isCurrent: false,
      status: "approved",
    }),
  );
  const taskId = await manager.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Hang the confidential loan piece",
    taskType: "mounts",
    priority: "high",
  });
  const installerId = await addMember(
    t,
    organizationId,
    "installer@example.test",
  );
  const foreign = await createOrgUserWithPermissions(t, INSTALLER_PERMISSIONS, {
    subscriptionTier: "pro",
    slugPrefix: "install-foreign",
  });
  const outsiderId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Outsider",
      email: "outsider@example.test",
    }),
  );
  return {
    t,
    manager,
    organizationId,
    exhibitionId,
    taskId,
    installerId,
    foreignUserId: foreign.userId,
    foreignOrganizationId: foreign.organizationId,
    outsiderId,
  };
}

async function errorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    const data = workErrorFromError(error);
    if (!data) throw error;
    return data.code;
  }
  throw new Error("Expected the call to be rejected");
}

test("installation tasks cannot be assigned to people outside the organization", async () => {
  const { t, manager, organizationId, taskId, foreignUserId, outsiderId } =
    await setup();

  for (const assigneeId of [foreignUserId, outsiderId]) {
    expect(
      await errorCodeOf(
        manager.mutation(api.installations.assignTask, { taskId, assigneeId }),
      ),
    ).toBe("ASSIGNEE_NOT_ELIGIBLE");
    const inbox = await authedForUser(t, assigneeId).query(
      api.notifications.getNotificationCenter,
      { organizationId },
    );
    expect(inbox.notifications).toEqual([]);
  }
  const task = await manager.query(api.installations.getTask, { taskId });
  expect(task?.assigneeId).toBeUndefined();
});

test("installation tasks reject assignees and dependencies from another organization at creation", async () => {
  const home = await setup();
  const foreignExhibitionId = await home.t.run((ctx) =>
    ctx.db.insert("exhibitions", {
      organizationId: home.foreignOrganizationId,
      title: "Other show",
      startDate: 1,
      isCurrent: false,
    }),
  );
  const foreignTaskId = await authedForUser(
    home.t,
    home.foreignUserId,
  ).mutation(api.installations.createTask, {
    organizationId: home.foreignOrganizationId,
    exhibitionId: foreignExhibitionId,
    title: "Foreign task",
    taskType: "other",
    priority: "low",
  });

  expect(
    await errorCodeOf(
      home.manager.mutation(api.installations.createTask, {
        organizationId: home.organizationId,
        exhibitionId: home.exhibitionId,
        title: "Secret install",
        taskType: "other",
        priority: "low",
        assigneeId: home.outsiderId,
      }),
    ),
  ).toBe("ASSIGNEE_NOT_ELIGIBLE");
  expect(
    await errorCodeOf(
      home.manager.mutation(api.installations.createTask, {
        organizationId: home.organizationId,
        exhibitionId: home.exhibitionId,
        title: "Depends on foreign work",
        taskType: "other",
        priority: "low",
        dependsOnTaskIds: [home.taskId, foreignTaskId],
      }),
    ),
  ).toBe("DEPENDENCY_INVALID");
  expect(
    await errorCodeOf(
      home.manager.mutation(api.installations.updateTask, {
        taskId: home.taskId,
        dependsOnTaskIds: [foreignTaskId],
      }),
    ),
  ).toBe("DEPENDENCY_INVALID");
  const inbox = await authedForUser(home.t, home.outsiderId).query(
    api.notifications.getNotificationCenter,
    { organizationId: home.organizationId },
  );
  expect(inbox.notifications).toEqual([]);
});

test("the assignment email links to the exhibition the task belongs to", async () => {
  vi.useFakeTimers();
  const { t, manager, organizationId, exhibitionId, taskId, installerId } =
    await setup();
  await authedForUser(t, installerId).mutation(
    api.notifications.updatePreferences,
    { organizationId, emailEnabled: true, emailDigestFrequency: "instant" },
  );

  await manager.mutation(api.installations.assignTask, {
    taskId,
    assigneeId: installerId,
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());

  expect(sent.emails.map((email) => email.to)).toEqual([
    "installer@example.test",
  ]);
  expect(sent.emails[0]?.html).toContain(
    `https://museum.example.test/en/exhibitions/${exhibitionId}`,
  );
  expect(sent.emails[0]?.html).not.toContain("/tasks");
  const task = await manager.query(api.installations.getTask, { taskId });
  expect(task?.assigneeId).toBe(installerId);
});
