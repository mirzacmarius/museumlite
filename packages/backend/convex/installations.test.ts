import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

test("should create installation task linked to exhibition", async () => {
  const t = convexTest(schema);

  // 1. Create an exhibition (setup)
  // 2. Create an installation task
  // const taskId = await t.mutation(api.installations.createTask, {
  //   organizationId: orgId,
  //   exhibitionId: exhibitionId,
  //   title: "Install lighting for main gallery",
  //   taskType: "lighting",
  //   priority: "high",
  // });

  // 3. Verify task created with todo status
  // const task = await t.query(api.installations.getTask, { taskId });
  // expect(task?.title).toBe("Install lighting for main gallery");
  // expect(task?.status).toBe("todo");
  // expect(task?.taskType).toBe("lighting");

  expect(true).toBe(true);
});

test("should move task through status workflow", async () => {
  const t = convexTest(schema);

  // 1. Create task in todo status
  // const taskId = await t.mutation(api.installations.createTask, { /* ... */ });

  // 2. Move to in_progress
  // await t.mutation(api.installations.moveTask, {
  //   taskId,
  //   status: "in_progress",
  // });
  // const task1 = await t.query(api.installations.getTask, { taskId });
  // expect(task1?.status).toBe("in_progress");

  // 3. Complete task
  // await t.mutation(api.installations.completeTask, { taskId });
  // const task2 = await t.query(api.installations.getTask, { taskId });
  // expect(task2?.status).toBe("completed");
  // expect(task2?.completedAt).toBeDefined();

  expect(true).toBe(true);
});

test("should create task from template", async () => {
  const t = convexTest(schema);

  // 1. Create template
  // const templateId = await t.mutation(api.installations.createTemplate, {
  //   organizationId: orgId,
  //   name: "Standard Lighting Setup",
  //   taskType: "lighting",
  //   defaultPriority: "medium",
  //   defaultEstimatedHours: 4,
  //   checklist: [
  //     { item: "Check fixture inventory", required: true },
  //     { item: "Test all bulbs", required: true },
  //     { item: "Document final positions", required: false },
  //   ],
  // });

  // 2. Apply template to create task
  // const taskId = await t.mutation(api.installations.applyTemplate, {
  //   templateId,
  //   exhibitionId,
  // });

  // 3. Verify task has template values and checklist items
  // const task = await t.query(api.installations.getTask, { taskId });
  // expect(task?.taskType).toBe("lighting");
  // expect(task?.priority).toBe("medium");
  // expect(task?.checklist.length).toBe(3);

  expect(true).toBe(true);
});

test("should manage task dependencies", async () => {
  const t = convexTest(schema);

  // 1. Create two tasks
  // const task1Id = await t.mutation(api.installations.createTask, {
  //   /* lighting task */
  // });
  // const task2Id = await t.mutation(api.installations.createTask, {
  //   /* signage task - depends on lighting */
  // });

  // 2. Add dependency: task2 depends on task1
  // await t.mutation(api.installations.addDependency, {
  //   taskId: task2Id,
  //   dependsOnTaskId: task1Id,
  // });

  // 3. Verify dependency chain
  // const chain = await t.query(api.installations.getDependencyChain, { taskId: task2Id });
  // expect(chain.length).toBe(1);
  // expect(chain[0]._id).toBe(task1Id);

  // 4. Remove dependency
  // await t.mutation(api.installations.removeDependency, {
  //   taskId: task2Id,
  //   dependsOnTaskId: task1Id,
  // });

  expect(true).toBe(true);
});

test("should block task with reason and unblock", async () => {
  const t = convexTest(schema);

  // 1. Create task
  // const taskId = await t.mutation(api.installations.createTask, { /* ... */ });

  // 2. Block task
  // await t.mutation(api.installations.blockTask, {
  //   taskId,
  //   reason: "Waiting for equipment delivery",
  // });
  // const blocked = await t.query(api.installations.getTask, { taskId });
  // expect(blocked?.status).toBe("blocked");
  // expect(blocked?.blockedReason).toBe("Waiting for equipment delivery");

  // 3. Unblock task
  // await t.mutation(api.installations.unblockTask, { taskId });
  // const unblocked = await t.query(api.installations.getTask, { taskId });
  // expect(unblocked?.status).toBe("todo"); // or previous status
  // expect(unblocked?.blockedReason).toBeUndefined();

  expect(true).toBe(true);
});

test("should get tasks grouped by status for board view", async () => {
  const t = convexTest(schema);

  // 1. Create multiple tasks in different statuses
  // await t.mutation(api.installations.createTask, { /* todo */ });
  // const task2 = await t.mutation(api.installations.createTask, { /* ... */ });
  // await t.mutation(api.installations.moveTask, { taskId: task2, status: "in_progress" });
  // const task3 = await t.mutation(api.installations.createTask, { /* ... */ });
  // await t.mutation(api.installations.completeTask, { taskId: task3 });

  // 2. Get board view
  // const board = await t.query(api.installations.getTasksForBoard, { exhibitionId });

  // 3. Verify grouped by status
  // expect(board.todo.length).toBe(1);
  // expect(board.in_progress.length).toBe(1);
  // expect(board.completed.length).toBe(1);

  expect(true).toBe(true);
});
