import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  requireExhibitionReadPermission,
  requireExhibitionUpdatePermission,
} from "./exhibitionContext";
import { requirePermission } from "./permissions";

export async function setInstallationChecklistHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    checklist: Array<{
      taskId: string;
      task: string;
      required: boolean;
    }>;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "proposed" && exhibition.status !== "approved") {
    throw new Error("Cannot modify checklist after installation has started");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  const checklistItems = args.checklist.map((item) => ({
    taskId: item.taskId,
    task: item.task,
    required: item.required,
    completed: false,
    completedBy: undefined,
    completedAt: undefined,
    notes: undefined,
  }));

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      installationChecklist: checklistItems,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "set_installation_checklist",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskCount: args.checklist.length },
    }),
  ]);

  return null;
}

export async function startInstallationHandler(
  ctx: MutationCtx,
  args: { exhibitionId: Id<"exhibitions"> },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "approved") {
    throw new Error("Exhibition must be approved before starting installation");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      status: "installing",
      installationStartedAt: Date.now(),
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "started_installation",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "installing" },
    }),
  ]);

  return null;
}

export async function completeInstallationTaskHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    taskId: string;
    notes?: string;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "installing" && exhibition.status !== "approved") {
    throw new Error("Exhibition is not in installation phase");
  }

  const checklist = exhibition.installationChecklist ?? [];
  const taskIndex = checklist.findIndex((t) => t.taskId === args.taskId);

  if (taskIndex === -1) {
    throw new Error("Task not found in installation checklist");
  }

  const existingTask = checklist[taskIndex];
  if (!existingTask) {
    throw new Error("Task not found");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  checklist[taskIndex] = {
    taskId: existingTask.taskId,
    task: existingTask.task,
    required: existingTask.required,
    completed: true,
    completedBy: userId,
    completedAt: Date.now(),
    notes: args.notes,
  };

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      installationChecklist: checklist,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "completed_installation_task",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskId: args.taskId, task: existingTask.task },
    }),
  ]);

  return null;
}

export async function uncompleteInstallationTaskHandler(
  ctx: MutationCtx,
  args: { exhibitionId: Id<"exhibitions">; taskId: string },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "installing" && exhibition.status !== "approved") {
    throw new Error("Exhibition is not in installation phase");
  }

  const checklist = exhibition.installationChecklist ?? [];
  const taskIndex = checklist.findIndex((t) => t.taskId === args.taskId);

  if (taskIndex === -1) {
    throw new Error("Task not found in installation checklist");
  }

  const existingTask = checklist[taskIndex];
  if (!existingTask) {
    throw new Error("Task not found");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  checklist[taskIndex] = {
    taskId: existingTask.taskId,
    task: existingTask.task,
    required: existingTask.required,
    completed: false,
    completedBy: undefined,
    completedAt: undefined,
    notes: undefined,
  };

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      installationChecklist: checklist,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "uncompleted_installation_task",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskId: args.taskId },
    }),
  ]);

  return null;
}

export async function checkInstallationReadinessHandler(
  ctx: QueryCtx,
  args: { exhibitionId: Id<"exhibitions"> },
) {
  const exhibition = await ctx.db.get(args.exhibitionId);
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  await requireExhibitionReadPermission(ctx, exhibition.organizationId);

  const checklist = exhibition.installationChecklist ?? [];
  const totalTasks = checklist.length;
  const completedTasks = checklist.filter((t) => t.completed).length;
  const requiredTasksRemaining = checklist.filter(
    (t) => t.required && !t.completed,
  ).length;

  const enrichedChecklist = await Promise.all(
    checklist.map(async (task) => {
      const completer = task.completedBy
        ? await ctx.db.get(task.completedBy)
        : null;
      return {
        taskId: task.taskId,
        task: task.task,
        required: task.required,
        completed: task.completed,
        completedBy: task.completedBy,
        completedAt: task.completedAt,
        completedByName: completer?.name ?? completer?.username ?? undefined,
        notes: task.notes,
      };
    }),
  );

  return {
    isReady: requiredTasksRemaining === 0,
    totalTasks,
    completedTasks,
    requiredTasksRemaining,
    checklist: enrichedChecklist,
  };
}

export async function completeInstallationHandler(
  ctx: MutationCtx,
  args: { exhibitionId: Id<"exhibitions"> },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "installing") {
    throw new Error("Exhibition is not in installation phase");
  }

  const checklist = exhibition.installationChecklist ?? [];
  const incompleteRequired = checklist.filter(
    (t) => t.required && !t.completed,
  );

  if (incompleteRequired.length > 0) {
    throw new Error(
      `Cannot complete installation: ${incompleteRequired.length} required tasks remain`,
    );
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      status: "approved",
      installationCompletedAt: Date.now(),
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "completed_installation",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "approved" },
    }),
  ]);

  return null;
}

export async function setDeinstallationChecklistHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    checklist: Array<{
      taskId: string;
      task: string;
      required: boolean;
    }>;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  const checklistItems = args.checklist.map((item) => ({
    taskId: item.taskId,
    task: item.task,
    required: item.required,
    completed: false,
    completedBy: undefined,
    completedAt: undefined,
    notes: undefined,
  }));

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      deinstallationChecklist: checklistItems,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "set_deinstallation_checklist",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskCount: args.checklist.length },
    }),
  ]);

  return null;
}

export async function startDeinstallationHandler(
  ctx: MutationCtx,
  args: { exhibitionId: Id<"exhibitions">; notes?: string },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "active") {
    throw new Error("Exhibition must be active to start deinstallation");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      status: "deinstalling",
      deinstallationStartedAt: Date.now(),
      deinstallationNotes: args.notes,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "started_deinstallation",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "deinstalling" },
    }),
  ]);

  return null;
}

export async function completeDeinstallationTaskHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    taskId: string;
    notes?: string;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "deinstalling") {
    throw new Error("Exhibition is not in deinstallation phase");
  }

  const checklist = exhibition.deinstallationChecklist ?? [];
  const taskIndex = checklist.findIndex((t) => t.taskId === args.taskId);

  if (taskIndex === -1) {
    throw new Error("Task not found in deinstallation checklist");
  }

  const existingTask = checklist[taskIndex];
  if (!existingTask) {
    throw new Error("Task not found");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  checklist[taskIndex] = {
    taskId: existingTask.taskId,
    task: existingTask.task,
    required: existingTask.required,
    completed: true,
    completedBy: userId,
    completedAt: Date.now(),
    notes: args.notes,
  };

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      deinstallationChecklist: checklist,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "completed_deinstallation_task",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskId: args.taskId, task: existingTask.task },
    }),
  ]);

  return null;
}

export async function checkDeinstallationReadinessHandler(
  ctx: QueryCtx,
  args: { exhibitionId: Id<"exhibitions"> },
) {
  const exhibition = await ctx.db.get(args.exhibitionId);
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  await requireExhibitionReadPermission(ctx, exhibition.organizationId);

  const checklist = exhibition.deinstallationChecklist ?? [];
  const totalTasks = checklist.length;
  const completedTasks = checklist.filter((t) => t.completed).length;
  const requiredTasksRemaining = checklist.filter(
    (t) => t.required && !t.completed,
  ).length;

  const exhibitionObjects = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_exhibition", (q) => q.eq("exhibitionId", args.exhibitionId))
    .collect();

  const objectsNotReturned = exhibitionObjects.filter(
    (obj) => obj.status !== "returned",
  ).length;

  const enrichedChecklist = await Promise.all(
    checklist.map(async (task) => {
      const completer = task.completedBy
        ? await ctx.db.get(task.completedBy)
        : null;
      return {
        taskId: task.taskId,
        task: task.task,
        required: task.required,
        completed: task.completed,
        completedBy: task.completedBy,
        completedAt: task.completedAt,
        completedByName: completer?.name ?? completer?.username ?? undefined,
        notes: task.notes,
      };
    }),
  );

  return {
    isReady: requiredTasksRemaining === 0 && objectsNotReturned === 0,
    totalTasks,
    completedTasks,
    requiredTasksRemaining,
    objectsNotReturned,
    checklist: enrichedChecklist,
  };
}
