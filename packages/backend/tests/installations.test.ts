import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

interface InstallationFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  exhibitionId: Id<"exhibitions">;
  authed: ReturnType<typeof authedForUser>;
}

async function setupInstallationFixture(
  t: ConvexTest,
): Promise<InstallationFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
    {
      subscriptionTier: "pro",
      slugPrefix: "install-test",
    },
  );

  const authed = authedForUser(t, userId);

  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `EXH-${Math.random().toString(36).slice(2, 8)}`,
      title: "Exhibition Anchor Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Summer Show",
    startDate: Date.now(),
    endDate: Date.now() + 90 * 24 * 60 * 60 * 1000,
    isCurrent: false,
  });

  return {
    organizationId,
    userId,
    exhibitionId,
    authed,
  };
}

test("should create installation task linked to exhibition", async () => {
  const t = createConvexTest();
  const { organizationId, exhibitionId, authed } =
    await setupInstallationFixture(t);

  const taskId = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Install lighting for main gallery",
    taskType: "lighting",
    priority: "high",
  });

  const task = await authed.query(api.installations.getTask, { taskId });

  expect(task?.title).toBe("Install lighting for main gallery");
  expect(task?.status).toBe("todo");
  expect(task?.taskType).toBe("lighting");
});

test("should move task through status workflow", async () => {
  const t = createConvexTest();
  const { organizationId, exhibitionId, authed } =
    await setupInstallationFixture(t);

  const taskId = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Install signage",
    taskType: "signage",
    priority: "medium",
  });

  await authed.mutation(api.installations.moveTask, {
    taskId,
    status: "in_progress",
  });

  const inProgress = await authed.query(api.installations.getTask, { taskId });
  expect(inProgress?.status).toBe("in_progress");

  await authed.mutation(api.installations.completeTask, { taskId });

  const completed = await authed.query(api.installations.getTask, { taskId });
  expect(completed?.status).toBe("completed");
  expect(completed?.completedAt).toBeDefined();
});

test("should create task from template", async () => {
  const t = createConvexTest();
  const { organizationId, exhibitionId, authed } =
    await setupInstallationFixture(t);

  const templateId = await authed.mutation(api.installations.createTemplate, {
    organizationId,
    name: "Standard Lighting Setup",
    taskType: "lighting",
    defaultPriority: "medium",
    defaultEstimatedHours: 4,
    checklist: [
      { item: "Check fixture inventory", required: true },
      { item: "Test all bulbs", required: true },
      { item: "Document final positions", required: false },
    ],
  });

  const taskId = await authed.mutation(api.installations.applyTemplate, {
    templateId,
    exhibitionId,
  });

  const task = await authed.query(api.installations.getTask, { taskId });
  expect(task?.taskType).toBe("lighting");
  expect(task?.priority).toBe("medium");
  expect(task?.checklistItems.length).toBe(3);
});

test("should manage task dependencies", async () => {
  const t = createConvexTest();
  const { organizationId, exhibitionId, authed } =
    await setupInstallationFixture(t);

  const task1Id = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Lighting setup",
    taskType: "lighting",
    priority: "high",
  });

  const task2Id = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Signage install",
    taskType: "signage",
    priority: "medium",
  });

  await authed.mutation(api.installations.addDependency, {
    taskId: task2Id,
    dependsOnTaskId: task1Id,
  });

  const chain = await authed.query(api.installations.getDependencyChain, {
    taskId: task2Id,
  });
  expect(chain.length).toBe(1);
  expect(chain[0]?._id).toBe(task1Id);

  await authed.mutation(api.installations.removeDependency, {
    taskId: task2Id,
    dependsOnTaskId: task1Id,
  });

  const emptyChain = await authed.query(api.installations.getDependencyChain, {
    taskId: task2Id,
  });
  expect(emptyChain).toHaveLength(0);
});

test("should block task with reason and unblock", async () => {
  const t = createConvexTest();
  const { organizationId, exhibitionId, authed } =
    await setupInstallationFixture(t);

  const taskId = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "AV setup",
    taskType: "av",
    priority: "medium",
  });

  await authed.mutation(api.installations.blockTask, {
    taskId,
    reason: "Waiting for equipment delivery",
  });

  const blocked = await authed.query(api.installations.getTask, { taskId });
  expect(blocked?.status).toBe("blocked");
  expect(blocked?.blockedReason).toBe("Waiting for equipment delivery");

  await authed.mutation(api.installations.unblockTask, { taskId });

  const unblocked = await authed.query(api.installations.getTask, { taskId });
  expect(unblocked?.status).toBe("todo");
  expect(unblocked?.blockedReason).toBeUndefined();
});

test("should get tasks grouped by status for board view", async () => {
  const t = createConvexTest();
  const { organizationId, exhibitionId, authed } =
    await setupInstallationFixture(t);

  await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Todo task",
    taskType: "labeling",
    priority: "low",
  });

  const inProgressTaskId = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "In progress task",
    taskType: "mounts",
    priority: "medium",
  });
  await authed.mutation(api.installations.moveTask, {
    taskId: inProgressTaskId,
    status: "in_progress",
  });

  const completedTaskId = await authed.mutation(api.installations.createTask, {
    organizationId,
    exhibitionId,
    title: "Completed task",
    taskType: "security",
    priority: "high",
  });
  await authed.mutation(api.installations.completeTask, {
    taskId: completedTaskId,
  });

  const board = await authed.query(api.installations.getTasksForBoard, {
    organizationId,
    exhibitionId,
  });

  expect(board.todo.length).toBeGreaterThanOrEqual(1);
  expect(board.in_progress.length).toBe(1);
  expect(board.completed.length).toBe(1);
});
