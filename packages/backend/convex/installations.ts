import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { env } from "./env";
import { requireFeatureAccess } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const taskTypeValidator = v.union(
  v.literal("lighting"),
  v.literal("signage"),
  v.literal("mounts"),
  v.literal("conservation"),
  v.literal("labeling"),
  v.literal("security"),
  v.literal("av"),
  v.literal("other"),
);

const taskStatusValidator = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("blocked"),
);

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

async function requireInstallationAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireFeatureAccess(ctx, organizationId, "installations");
}

// ============================================
// TASK CRUD
// ============================================

export const createTask = mutation({
  args: {
    organizationId: v.id("organizations"),
    exhibitionId: v.id("exhibitions"),
    title: v.string(),
    description: v.optional(v.string()),
    taskType: taskTypeValidator,
    priority: priorityValidator,
    assigneeId: v.optional(v.id("users")),
    assigneeName: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
    notes: v.optional(v.string()),
  },
  returns: v.id("installationTasks"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await Promise.all([
      requireInstallationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.create"),
    ]);
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) throw new Error("Exhibition not found");
    if (exhibition.organizationId !== args.organizationId) {
      throw new Error("Exhibition does not belong to this organization");
    }

    const taskId = await ctx.db.insert("installationTasks", {
      organizationId: args.organizationId,
      exhibitionId: args.exhibitionId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      status: "todo",
      priority: args.priority,
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
      dueDate: args.dueDate,
      estimatedHours: args.estimatedHours,
      dependsOnTaskIds: args.dependsOnTaskIds,
      notes: args.notes,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "installationTask",
      entityId: taskId,
      changes: { title: args.title, taskType: args.taskType },
    });

    if (args.assigneeId && args.assigneeId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: args.organizationId,
        userId: args.assigneeId,
        type: "task_assigned",
        title: "New Task Assigned",
        message: `You have been assigned to: ${args.title}`,
        relatedEntityType: "installationTask",
        relatedEntityId: taskId,
      });
    }

    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    taskType: v.optional(taskTypeValidator),
    priority: v.optional(priorityValidator),
    assigneeId: v.optional(v.id("users")),
    assigneeName: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.update");

    const { taskId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(args.taskId, {
      ...filteredUpdates,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: task.organizationId,
      userId,
      action: "updated",
      entityType: "installationTask",
      entityId: args.taskId,
      changes: filteredUpdates,
    });

    return null;
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.delete"),
    ]);
    const comments = await ctx.db
      .query("installationTaskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    await Promise.all(comments.map((comment) => ctx.db.delete(comment._id)));

    const checklists = await ctx.db
      .query("installationTaskChecklists")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    await Promise.all([
      Promise.all(checklists.map((item) => ctx.db.delete(item._id))),
      ctx.db.delete(args.taskId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: task.organizationId,
        userId,
        action: "deleted",
        entityType: "installationTask",
        entityId: args.taskId,
        changes: { title: task.title },
      }),
    ] as const);

    return null;
  },
});

export const getTask = query({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.union(
    v.object({
      _id: v.id("installationTasks"),
      organizationId: v.id("organizations"),
      exhibitionId: v.id("exhibitions"),
      title: v.string(),
      description: v.optional(v.string()),
      taskType: taskTypeValidator,
      status: taskStatusValidator,
      priority: priorityValidator,
      assigneeId: v.optional(v.id("users")),
      assigneeName: v.optional(v.string()),
      assigneeInfo: v.optional(
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
      ),
      dueDate: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      completedBy: v.optional(v.id("users")),
      estimatedHours: v.optional(v.number()),
      actualHours: v.optional(v.number()),
      dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
      blockedReason: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      lastModifiedBy: v.optional(v.id("users")),
      lastModifiedAt: v.optional(v.number()),
      checklistItems: v.array(
        v.object({
          _id: v.id("installationTaskChecklists"),
          item: v.string(),
          completed: v.boolean(),
          sortOrder: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.read");

    let assigneeInfo:
      | { name: string | undefined; email: string | undefined }
      | undefined;
    if (task.assigneeId) {
      const user = await ctx.db.get(task.assigneeId);
      if (user) {
        assigneeInfo = { name: user.name, email: user.email };
      }
    }

    const checklists = await ctx.db
      .query("installationTaskChecklists")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const checklistItems = checklists
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        _id: c._id,
        item: c.item,
        completed: c.completed,
        sortOrder: c.sortOrder,
      }));

    return {
      _id: task._id,
      organizationId: task.organizationId,
      exhibitionId: task.exhibitionId,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      assigneeInfo,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      completedBy: task.completedBy,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      dependsOnTaskIds: task.dependsOnTaskIds,
      blockedReason: task.blockedReason,
      notes: task.notes,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      lastModifiedBy: task.lastModifiedBy,
      lastModifiedAt: task.lastModifiedAt,
      checklistItems,
    };
  },
});

export const listTasks = query({
  args: {
    organizationId: v.id("organizations"),
    exhibitionId: v.id("exhibitions"),
    status: v.optional(taskStatusValidator),
    assigneeId: v.optional(v.id("users")),
    taskType: v.optional(taskTypeValidator),
  },
  returns: v.array(
    v.object({
      _id: v.id("installationTasks"),
      title: v.string(),
      taskType: taskTypeValidator,
      status: taskStatusValidator,
      priority: priorityValidator,
      assigneeId: v.optional(v.id("users")),
      assigneeName: v.optional(v.string()),
      dueDate: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
    }),
  ),
  handler: async (ctx, args) => {
    await requireInstallationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    let tasksQuery = ctx.db
      .query("installationTasks")
      .withIndex("by_organization_and_exhibition", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("exhibitionId", args.exhibitionId),
      );

    if (args.status) {
      tasksQuery = tasksQuery.filter((q) =>
        q.eq(q.field("status"), args.status),
      );
    }
    if (args.assigneeId) {
      tasksQuery = tasksQuery.filter((q) =>
        q.eq(q.field("assigneeId"), args.assigneeId),
      );
    }
    if (args.taskType) {
      tasksQuery = tasksQuery.filter((q) =>
        q.eq(q.field("taskType"), args.taskType),
      );
    }

    const tasks = await tasksQuery.collect();

    return tasks.map((t) => ({
      _id: t._id,
      title: t.title,
      taskType: t.taskType,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assigneeId,
      assigneeName: t.assigneeName,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      dependsOnTaskIds: t.dependsOnTaskIds,
    }));
  },
});

// ============================================
// TASK STATUS MANAGEMENT
// ============================================

export const moveTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
    status: taskStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.update");

    const updates: {
      status: typeof args.status;
      completedAt?: number;
      completedBy?: Id<"users">;
      blockedReason?: string;
      lastModifiedBy: Id<"users">;
      lastModifiedAt: number;
    } = {
      status: args.status,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    if (args.status === "completed") {
      updates.completedAt = Date.now();
      updates.completedBy = userId;
    }

    if (args.status !== "blocked") {
      updates.blockedReason = undefined;
    }

    await ctx.db.patch(args.taskId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: task.organizationId,
      userId,
      action: "status_changed",
      entityType: "installationTask",
      entityId: args.taskId,
      changes: { from: task.status, to: args.status },
    });

    return null;
  },
});

export const completeTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
    actualHours: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
      ctx.db.patch(args.taskId, {
        status: "completed",
        completedAt: Date.now(),
        completedBy: userId,
        actualHours: args.actualHours ?? task.actualHours,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: task.organizationId,
        userId,
        action: "completed",
        entityType: "installationTask",
        entityId: args.taskId,
        changes: { title: task.title },
      }),
    ] as const);

    return null;
  },
});

export const blockTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
      ctx.db.patch(args.taskId, {
        status: "blocked",
        blockedReason: args.reason,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: task.organizationId,
        userId,
        action: "blocked",
        entityType: "installationTask",
        entityId: args.taskId,
        changes: { reason: args.reason },
      }),
    ] as const);

    return null;
  },
});

export const unblockTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    if (task.status !== "blocked") {
      throw new Error("Task is not blocked");
    }

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.update");

    await ctx.db.patch(args.taskId, {
      status: "todo",
      blockedReason: undefined,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: task.organizationId,
      userId,
      action: "unblocked",
      entityType: "installationTask",
      entityId: args.taskId,
    });

    return null;
  },
});

// ============================================
// ASSIGNEE MANAGEMENT
// ============================================

export const assignTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
    assigneeId: v.optional(v.id("users")),
    assigneeName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
      ctx.db.patch(args.taskId, {
        assigneeId: args.assigneeId,
        assigneeName: args.assigneeName,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: task.organizationId,
        userId,
        action: "assigned",
        entityType: "installationTask",
        entityId: args.taskId,
        changes: {
          assigneeId: args.assigneeId,
          assigneeName: args.assigneeName,
        },
      }),
    ] as const);

    if (args.assigneeId && args.assigneeId !== userId) {
      // Get user who is assigning the task
      const assigningUser = await ctx.db.get(userId);
      const assignedByName =
        assigningUser?.name ?? assigningUser?.email ?? "A team member";

      // Get organization for building deep link
      const org = await ctx.db.get(task.organizationId);
      const taskUrl = org
        ? `${env.SITE_URL}/${org.slug}/exhibitions/${task.exhibitionId}/tasks/${args.taskId}`
        : undefined;

      await ctx.runMutation(internal.notifications.sendNotification, {
        organizationId: task.organizationId,
        userId: args.assigneeId,
        type: "task_assigned",
        title: "Task Assigned",
        message: `You have been assigned to: ${task.title}`,
        relatedEntityType: "installationTask",
        relatedEntityId: args.taskId,
        emailData: {
          taskTitle: task.title,
          assignedBy: assignedByName,
          dueDate: task.dueDate
            ? new Date(task.dueDate).toLocaleDateString()
            : undefined,
          taskUrl,
        },
      });
    }

    return null;
  },
});

export const unassignTask = mutation({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
      ctx.db.patch(args.taskId, {
        assigneeId: undefined,
        assigneeName: undefined,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: task.organizationId,
        userId,
        action: "unassigned",
        entityType: "installationTask",
        entityId: args.taskId,
      }),
    ] as const);

    return null;
  },
});

// ============================================
// DEPENDENCIES
// ============================================

export const addDependency = mutation({
  args: {
    taskId: v.id("installationTasks"),
    dependsOnTaskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const dependsOnTask = await ctx.db.get(args.dependsOnTaskId);
    if (!dependsOnTask) throw new Error("Dependency task not found");

    if (task.exhibitionId !== dependsOnTask.exhibitionId) {
      throw new Error("Tasks must belong to the same exhibition");
    }

    if (args.taskId === args.dependsOnTaskId) {
      throw new Error("Task cannot depend on itself");
    }

    const currentDeps = task.dependsOnTaskIds ?? [];
    if (currentDeps.includes(args.dependsOnTaskId)) {
      throw new Error("Dependency already exists");
    }

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.update");

    await ctx.db.patch(args.taskId, {
      dependsOnTaskIds: [...currentDeps, args.dependsOnTaskId],
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const removeDependency = mutation({
  args: {
    taskId: v.id("installationTasks"),
    dependsOnTaskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.update");

    const currentDeps = task.dependsOnTaskIds ?? [];
    const newDeps = currentDeps.filter((id) => id !== args.dependsOnTaskId);

    await ctx.db.patch(args.taskId, {
      dependsOnTaskIds: newDeps.length > 0 ? newDeps : undefined,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const getDependencyChain = query({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.array(
    v.object({
      _id: v.id("installationTasks"),
      title: v.string(),
      status: taskStatusValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];

    await requireInstallationAccess(ctx, task.organizationId);
    await requirePermission(ctx, task.organizationId, "collections.read");

    const visited = new Set<Id<"installationTasks">>();
    const result: Array<{
      _id: Id<"installationTasks">;
      title: string;
      status: "todo" | "in_progress" | "completed" | "blocked";
    }> = [];

    async function traverse(taskId: Id<"installationTasks">) {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const t = await ctx.db.get(taskId);
      if (!t) return;

      result.push({ _id: t._id, title: t.title, status: t.status });

      if (t.dependsOnTaskIds) {
        await Promise.all(
          Array.from(t.dependsOnTaskIds).map(async (depId) => {
            await traverse(depId);
          }),
        );
      }
    }

    if (task.dependsOnTaskIds) {
      await Promise.all(
        Array.from(task.dependsOnTaskIds).map(async (depId) => {
          await traverse(depId);
        }),
      );
    }

    return result;
  },
});

// ============================================
// TEMPLATES
// ============================================

export const createTemplate = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    taskType: taskTypeValidator,
    defaultPriority: priorityValidator,
    defaultEstimatedHours: v.optional(v.number()),
    checklist: v.optional(
      v.array(v.object({ item: v.string(), required: v.boolean() })),
    ),
  },
  returns: v.id("installationTaskTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await Promise.all([
      requireInstallationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.create"),
    ]);
    const templateId = await ctx.db.insert("installationTaskTemplates", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      taskType: args.taskType,
      defaultPriority: args.defaultPriority,
      defaultEstimatedHours: args.defaultEstimatedHours,
      checklist: args.checklist,
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return templateId;
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("installationTaskTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    taskType: v.optional(taskTypeValidator),
    defaultPriority: v.optional(priorityValidator),
    defaultEstimatedHours: v.optional(v.number()),
    checklist: v.optional(
      v.array(v.object({ item: v.string(), required: v.boolean() })),
    ),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    await requireInstallationAccess(ctx, template.organizationId);
    await requirePermission(ctx, template.organizationId, "collections.update");

    const { templateId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(args.templateId, filteredUpdates);

    return null;
  },
});

export const deleteTemplate = mutation({
  args: {
    templateId: v.id("installationTaskTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    await Promise.all([
      requireInstallationAccess(ctx, template.organizationId),
      requirePermission(ctx, template.organizationId, "collections.delete"),
      ctx.db.patch(args.templateId, { isActive: false }),
    ] as const);

    return null;
  },
});

export const listTemplates = query({
  args: {
    organizationId: v.id("organizations"),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("installationTaskTemplates"),
      name: v.string(),
      description: v.optional(v.string()),
      taskType: taskTypeValidator,
      defaultPriority: priorityValidator,
      defaultEstimatedHours: v.optional(v.number()),
      checklist: v.optional(
        v.array(v.object({ item: v.string(), required: v.boolean() })),
      ),
      isActive: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireInstallationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    let templatesQuery = ctx.db
      .query("installationTaskTemplates")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.activeOnly !== false) {
      templatesQuery = templatesQuery.filter((q) =>
        q.eq(q.field("isActive"), true),
      );
    }

    const templates = await templatesQuery.collect();

    return templates.map((t) => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      taskType: t.taskType,
      defaultPriority: t.defaultPriority,
      defaultEstimatedHours: t.defaultEstimatedHours,
      checklist: t.checklist,
      isActive: t.isActive,
    }));
  },
});

export const applyTemplate = mutation({
  args: {
    templateId: v.id("installationTaskTemplates"),
    exhibitionId: v.id("exhibitions"),
    title: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    assigneeName: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  returns: v.id("installationTasks"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (!template.isActive) throw new Error("Template is not active");

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) throw new Error("Exhibition not found");
    if (exhibition.organizationId !== template.organizationId) {
      throw new Error("Exhibition does not belong to this organization");
    }
    await Promise.all([
      requireInstallationAccess(ctx, template.organizationId),
      requirePermission(ctx, template.organizationId, "collections.create"),
    ]);
    const taskId = await ctx.db.insert("installationTasks", {
      organizationId: template.organizationId,
      exhibitionId: args.exhibitionId,
      title: args.title ?? template.name,
      description: template.description,
      taskType: template.taskType,
      status: "todo",
      priority: template.defaultPriority,
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
      dueDate: args.dueDate,
      estimatedHours: template.defaultEstimatedHours,
      createdBy: userId,
      createdAt: Date.now(),
    });

    const checklist = template.checklist;
    if (checklist && checklist.length > 0) {
      await Promise.all(
        Array.from({ length: checklist.length }, async (_, i) => {
          const checkItem = checklist[i];
          if (checkItem) {
            await ctx.db.insert("installationTaskChecklists", {
              taskId,
              item: checkItem.item,
              completed: false,
              sortOrder: i,
            });
          }
        }),
      );
    }

    if (args.assigneeId && args.assigneeId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: template.organizationId,
        userId: args.assigneeId,
        type: "task_assigned",
        title: "New Task Assigned",
        message: `You have been assigned to: ${args.title ?? template.name}`,
        relatedEntityType: "installationTask",
        relatedEntityId: taskId,
      });
    }

    return taskId;
  },
});

// ============================================
// TASK COMMENTS
// ============================================

export const addComment = mutation({
  args: {
    taskId: v.id("installationTasks"),
    content: v.string(),
    attachmentIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("installationTaskComments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
    ]);
    const commentId = await ctx.db.insert("installationTaskComments", {
      taskId: args.taskId,
      authorId: userId,
      content: args.content,
      attachmentIds: args.attachmentIds,
      createdAt: Date.now(),
    });

    return commentId;
  },
});

export const listComments = query({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.array(
    v.object({
      _id: v.id("installationTaskComments"),
      authorId: v.id("users"),
      authorName: v.optional(v.string()),
      content: v.string(),
      attachmentIds: v.optional(v.array(v.id("_storage"))),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.read"),
    ]);
    const comments = await ctx.db
      .query("installationTaskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const commentsWithAuthors = await Promise.all(
      comments.map(async (c) => {
        const author = await ctx.db.get(c.authorId);
        return {
          _id: c._id,
          authorId: c.authorId,
          authorName: author?.name ?? author?.username,
          content: c.content,
          attachmentIds: c.attachmentIds,
          createdAt: c.createdAt,
        };
      }),
    );

    return commentsWithAuthors.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// ============================================
// TASK CHECKLISTS
// ============================================

export const addChecklistItem = mutation({
  args: {
    taskId: v.id("installationTasks"),
    item: v.string(),
  },
  returns: v.id("installationTaskChecklists"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
    ]);
    const existingItems = await ctx.db
      .query("installationTaskChecklists")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const maxOrder = existingItems.reduce(
      (max, item) => Math.max(max, item.sortOrder),
      -1,
    );

    const checklistId = await ctx.db.insert("installationTaskChecklists", {
      taskId: args.taskId,
      item: args.item,
      completed: false,
      sortOrder: maxOrder + 1,
    });

    return checklistId;
  },
});

export const updateChecklistItem = mutation({
  args: {
    checklistItemId: v.id("installationTaskChecklists"),
    completed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const checklistItem = await ctx.db.get(args.checklistItemId);
    if (!checklistItem) throw new Error("Checklist item not found");

    const task = await ctx.db.get(checklistItem.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
      ctx.db.patch(args.checklistItemId, {
        completed: args.completed,
        completedBy: args.completed ? userId : undefined,
        completedAt: args.completed ? Date.now() : undefined,
      }),
    ] as const);

    return null;
  },
});

export const removeChecklistItem = mutation({
  args: {
    checklistItemId: v.id("installationTaskChecklists"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const checklistItem = await ctx.db.get(args.checklistItemId);
    if (!checklistItem) throw new Error("Checklist item not found");

    const task = await ctx.db.get(checklistItem.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.delete"),
      ctx.db.delete(args.checklistItemId),
    ] as const);

    return null;
  },
});

export const reorderChecklist = mutation({
  args: {
    taskId: v.id("installationTasks"),
    itemIds: v.array(v.id("installationTaskChecklists")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await Promise.all([
      requireInstallationAccess(ctx, task.organizationId),
      requirePermission(ctx, task.organizationId, "collections.update"),
      Promise.all(
        Array.from({ length: args.itemIds.length }, async (_, i) => {
          const itemId = args.itemIds[i];
          if (itemId) {
            await ctx.db.patch(itemId, { sortOrder: i });
          }
        }),
      ),
    ] as const);

    return null;
  },
});

// ============================================
// QUERIES
// ============================================

export const getTasksForBoard = query({
  args: {
    organizationId: v.id("organizations"),
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    todo: v.array(
      v.object({
        _id: v.id("installationTasks"),
        title: v.string(),
        taskType: taskTypeValidator,
        priority: priorityValidator,
        assigneeId: v.optional(v.id("users")),
        assigneeName: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
      }),
    ),
    in_progress: v.array(
      v.object({
        _id: v.id("installationTasks"),
        title: v.string(),
        taskType: taskTypeValidator,
        priority: priorityValidator,
        assigneeId: v.optional(v.id("users")),
        assigneeName: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
      }),
    ),
    completed: v.array(
      v.object({
        _id: v.id("installationTasks"),
        title: v.string(),
        taskType: taskTypeValidator,
        priority: priorityValidator,
        assigneeId: v.optional(v.id("users")),
        assigneeName: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
      }),
    ),
    blocked: v.array(
      v.object({
        _id: v.id("installationTasks"),
        title: v.string(),
        taskType: taskTypeValidator,
        priority: priorityValidator,
        assigneeId: v.optional(v.id("users")),
        assigneeName: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        blockedReason: v.optional(v.string()),
        dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireInstallationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const tasks = await ctx.db
      .query("installationTasks")
      .withIndex("by_organization_and_exhibition", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("exhibitionId", args.exhibitionId),
      )
      .collect();

    const mapTask = (t: (typeof tasks)[0]) => ({
      _id: t._id,
      title: t.title,
      taskType: t.taskType,
      priority: t.priority,
      assigneeId: t.assigneeId,
      assigneeName: t.assigneeName,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      blockedReason: t.blockedReason,
      dependsOnTaskIds: t.dependsOnTaskIds,
    });

    const groupedTasks = {
      todo: [] as ReturnType<typeof mapTask>[],
      in_progress: [] as ReturnType<typeof mapTask>[],
      completed: [] as ReturnType<typeof mapTask>[],
      blocked: [] as ReturnType<typeof mapTask>[],
    };

    for (const task of tasks) {
      groupedTasks[task.status].push(mapTask(task));
    }

    return {
      todo: groupedTasks.todo,
      in_progress: groupedTasks.in_progress,
      completed: groupedTasks.completed,
      blocked: groupedTasks.blocked,
    };
  },
});

export const getOverdueTasks = query({
  args: {
    organizationId: v.id("organizations"),
    exhibitionId: v.optional(v.id("exhibitions")),
  },
  returns: v.array(
    v.object({
      _id: v.id("installationTasks"),
      exhibitionId: v.id("exhibitions"),
      exhibitionTitle: v.optional(v.string()),
      title: v.string(),
      taskType: taskTypeValidator,
      status: taskStatusValidator,
      priority: priorityValidator,
      dueDate: v.number(),
      assigneeId: v.optional(v.id("users")),
      assigneeName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireInstallationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    const now = Date.now();

    let tasksQuery = ctx.db
      .query("installationTasks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "completed"),
          q.neq(q.field("dueDate"), undefined),
          q.lt(q.field("dueDate"), now),
        ),
      );

    if (args.exhibitionId) {
      tasksQuery = tasksQuery.filter((q) =>
        q.eq(q.field("exhibitionId"), args.exhibitionId),
      );
    }

    const tasks = await tasksQuery.collect();

    const tasksWithExhibition = await Promise.all(
      tasks.map(async (t) => {
        const exhibition = await ctx.db.get(t.exhibitionId);
        return {
          _id: t._id,
          exhibitionId: t.exhibitionId,
          exhibitionTitle: exhibition?.title,
          title: t.title,
          taskType: t.taskType,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate!,
          assigneeId: t.assigneeId,
          assigneeName: t.assigneeName,
        };
      }),
    );

    return tasksWithExhibition.sort((a, b) => a.dueDate - b.dueDate);
  },
});

export const getTaskStats = query({
  args: {
    organizationId: v.id("organizations"),
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    total: v.number(),
    byStatus: v.object({
      todo: v.number(),
      in_progress: v.number(),
      completed: v.number(),
      blocked: v.number(),
    }),
    byType: v.record(v.string(), v.number()),
    overdue: v.number(),
    completionRate: v.number(),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireInstallationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const tasks = await ctx.db
      .query("installationTasks")
      .withIndex("by_organization_and_exhibition", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("exhibitionId", args.exhibitionId),
      )
      .collect();

    const now = Date.now();

    const byStatus = {
      todo: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
    };

    const byType: Record<string, number> = {};
    let overdue = 0;

    for (const task of tasks) {
      byStatus[task.status]++;
      byType[task.taskType] = (byType[task.taskType] ?? 0) + 1;

      if (task.status !== "completed" && task.dueDate && task.dueDate < now) {
        overdue++;
      }
    }

    const total = tasks.length;
    const completionRate =
      total > 0 ? Math.round((byStatus.completed / total) * 100) : 0;

    return {
      total,
      byStatus,
      byType,
      overdue,
      completionRate,
    };
  },
});

export const getMyTasks = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("installationTasks"),
      exhibitionId: v.id("exhibitions"),
      exhibitionTitle: v.optional(v.string()),
      title: v.string(),
      taskType: taskTypeValidator,
      status: taskStatusValidator,
      priority: priorityValidator,
      dueDate: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await Promise.all([
      requireInstallationAccess(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const tasks = await ctx.db
      .query("installationTasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), args.organizationId),
          q.neq(q.field("status"), "completed"),
        ),
      )
      .collect();

    const tasksWithExhibition = await Promise.all(
      tasks.map(async (t) => {
        const exhibition = await ctx.db.get(t.exhibitionId);
        return {
          _id: t._id,
          exhibitionId: t.exhibitionId,
          exhibitionTitle: exhibition?.title,
          title: t.title,
          taskType: t.taskType,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
        };
      }),
    );

    return tasksWithExhibition;
  },
});

// ============================================
// NOTIFICATIONS (INTERNAL)
// ============================================

export const notifyAssignee = internalMutation({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task || !task.assigneeId) return null;

    await ctx.runMutation(internal.audit.createNotificationInternal, {
      organizationId: task.organizationId,
      userId: task.assigneeId,
      type: "task_assigned",
      title: "Task Assigned",
      message: `You have been assigned to: ${task.title}`,
      relatedEntityType: "installationTask",
      relatedEntityId: args.taskId,
    });

    return null;
  },
});

export const notifyDueDate = internalMutation({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task || !task.assigneeId || !task.dueDate) return null;

    const now = Date.now();
    const hoursUntilDue = (task.dueDate - now) / (1000 * 60 * 60);

    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: task.organizationId,
        userId: task.assigneeId,
        type: "task_due_soon",
        title: "Task Due Soon",
        message: `Task "${task.title}" is due in less than 24 hours`,
        relatedEntityType: "installationTask",
        relatedEntityId: args.taskId,
      });
    }

    return null;
  },
});

export const notifyBlocked = internalMutation({
  args: {
    taskId: v.id("installationTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const userOrgs = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", task.organizationId),
      )
      .collect();

    await Promise.all(
      Array.from(userOrgs).map(async (userOrg) => {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: task.organizationId,
          userId: userOrg.userId,
          type: "task_blocked",
          title: "Task Blocked",
          message: `Task "${task.title}" has been blocked: ${task.blockedReason ?? "No reason provided"}`,
          relatedEntityType: "installationTask",
          relatedEntityId: args.taskId,
        });
      }),
    );

    return null;
  },
});
