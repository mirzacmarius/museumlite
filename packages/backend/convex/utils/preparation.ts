import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  isOpenStatus,
  logTaskEvent,
  MAX_TASKS_PER_CASE,
  UNDATED,
} from "./caseTaskRules";
import { CASE_TYPES, canWorkWith } from "./caseTypes";
import { seesIncident, WORK_PERMISSION } from "./incidentAccess";
import { memberPermissionNames } from "./memberPermissions";
import { dispatchNotification } from "./notificationDispatch";
import type {
  PreparationDue,
  PreparationOwner,
  PreparationStep,
  PreparationTrigger,
} from "./preparationValidators";

/**
 * Preparation recipes turn an accepted intake, loan or exhibition into
 * suggested case tasks (ADR 0012). A suggestion is keyed on its case event,
 * recipe and step in the task table, so a repeated or corrected event keeps
 * one task per step. Suggestions never record custody, installation, title or
 * condition; the work they ask for is recorded through its own commands.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Recipes an organization may keep outside the archive. */
export const MAX_RECIPES = 20;

export type PreparationCaseType =
  | "accession"
  | "loan"
  | "exhibition"
  | "incident";

export const TRIGGER_CASE_TYPES = {
  intake_accepted: "accession",
  loan_approved: "loan",
  exhibition_approved: "exhibition",
  incident_response: "incident",
} as const satisfies Record<PreparationTrigger, PreparationCaseType>;

export interface PreparationCaseRef {
  organizationId: Id<"organizations">;
  caseType: PreparationCaseType;
  caseId: string;
}

/** An accepted intake, loan or exhibition: the event recipes follow. */
export interface CaseEvent extends PreparationCaseRef {
  trigger: PreparationTrigger;
  eventAt: number;
  approverId?: Id<"users">;
  assigneeId?: Id<"users">;
  loanDirection?: Doc<"loans">["type"];
  /** Case dates that due dates count from. */
  dates: { event: number; start?: number; end?: number };
  /**
   * Recipes staff chose for this case. Set for incidents, whose plans never
   * apply unless a coordinator chose them (ADR 0015).
   */
  chosenRecipeIds?: ReadonlySet<Id<"preparationRecipes">>;
}

const LOAN_PREPARATION_STATUSES: ReadonlySet<Doc<"loans">["status"]> = new Set([
  "active",
  "dispatched",
]);
const EXHIBITION_PREPARATION_STATUSES: ReadonlySet<
  Doc<"exhibitions">["status"]
> = new Set(["approved", "installing", "active", "deinstalling"]);

/**
 * The accepted event of a case while it still calls for preparation: an
 * approved accession, an approved loan that is not returned or cancelled, or
 * an approved exhibition that is not closed. Null otherwise.
 */
export async function acceptedCaseEvent(
  ctx: QueryCtx,
  ref: PreparationCaseRef,
): Promise<CaseEvent | null> {
  switch (ref.caseType) {
    case "accession": {
      const id = ctx.db.normalizeId("accessions", ref.caseId);
      const accession = id ? await ctx.db.get(id) : null;
      if (
        !accession ||
        accession.organizationId !== ref.organizationId ||
        accession.status !== "approved"
      )
        return null;
      const eventAt = accession.approvedAt ?? accession._creationTime;
      return {
        ...ref,
        trigger: "intake_accepted",
        eventAt,
        approverId: accession.approvedBy,
        assigneeId: accession.assignedTo,
        dates: { event: eventAt },
      };
    }
    case "loan": {
      const id = ctx.db.normalizeId("loans", ref.caseId);
      const loan = id ? await ctx.db.get(id) : null;
      if (
        !loan ||
        loan.organizationId !== ref.organizationId ||
        !LOAN_PREPARATION_STATUSES.has(loan.status)
      )
        return null;
      const eventAt = loan.approvedAt ?? loan._creationTime;
      return {
        ...ref,
        trigger: "loan_approved",
        eventAt,
        approverId: loan.approvedBy,
        assigneeId: loan.assignedTo,
        loanDirection: loan.type,
        dates: { event: eventAt, start: loan.startDate, end: loan.endDate },
      };
    }
    case "exhibition": {
      const id = ctx.db.normalizeId("exhibitions", ref.caseId);
      const exhibition = id ? await ctx.db.get(id) : null;
      if (
        !exhibition ||
        exhibition.organizationId !== ref.organizationId ||
        !EXHIBITION_PREPARATION_STATUSES.has(exhibition.status)
      )
        return null;
      const eventAt = exhibition.approvedAt ?? exhibition._creationTime;
      return {
        ...ref,
        trigger: "exhibition_approved",
        eventAt,
        // Without a workflow, creating the exhibition accepted it.
        approverId: exhibition.approvedBy ?? exhibition.createdBy,
        dates: {
          event: eventAt,
          start: exhibition.startDate,
          end: exhibition.endDate,
        },
      };
    }
    case "incident": {
      const id = ctx.db.normalizeId("incidents", ref.caseId);
      const incident = id ? await ctx.db.get(id) : null;
      if (
        !incident ||
        incident.organizationId !== ref.organizationId ||
        incident.status !== "responding" ||
        incident.triagedAt === undefined
      )
        return null;
      return {
        ...ref,
        trigger: "incident_response",
        eventAt: incident.triagedAt,
        approverId: incident.triagedBy,
        assigneeId: incident.leadId,
        dates: { event: incident.triagedAt },
        chosenRecipeIds: new Set(incident.plans.map((plan) => plan.recipeId)),
      };
    }
  }
}

/** Active recipes that follow this event, oldest first. */
export async function recipesForEvent(ctx: QueryCtx, event: CaseEvent) {
  const recipes = await ctx.db
    .query("preparationRecipes")
    .withIndex("by_organizationId_and_trigger_and_status", (q) =>
      q
        .eq("organizationId", event.organizationId)
        .eq("trigger", event.trigger)
        .eq("status", "active"),
    )
    .take(MAX_RECIPES);
  return recipes.filter(
    (recipe) =>
      (!recipe.loanDirection || recipe.loanDirection === event.loanDirection) &&
      (!event.chosenRecipeIds || event.chosenRecipeIds.has(recipe._id)),
  );
}

export function suggestionKey(
  event: Pick<CaseEvent, "trigger" | "caseId">,
  recipeId: Id<"preparationRecipes">,
  stepKey: string,
) {
  return `${event.trigger}:${event.caseId}:${recipeId}:${stepKey}`;
}

/**
 * UTC day of the case date plus the offset in days, or the case time plus
 * the offset in hours; undefined without that date.
 */
export function suggestedDueDate(
  due: PreparationDue | undefined,
  dates: CaseEvent["dates"],
) {
  if (!due) return undefined;
  const from = dates[due.anchor];
  if (from === undefined) return undefined;
  if (due.offsetHours !== undefined) return from + due.offsetHours * HOUR_MS;
  return Math.floor(from / DAY_MS) * DAY_MS + due.offsetDays * DAY_MS;
}

type Eligibility = (userId: Id<"users">) => Promise<boolean>;

/**
 * Whether a member may own tasks on this case, cached per member. On a
 * sensitive incident they must also be in its scope.
 */
export function ownerEligibility(
  ctx: QueryCtx,
  ref: PreparationCaseRef,
): Eligibility {
  const { organizationId, caseType } = ref;
  const incidentId =
    caseType === "incident"
      ? ctx.db.normalizeId("incidents", ref.caseId)
      : null;
  const incident = incidentId ? ctx.db.get(incidentId) : null;
  const cache = new Map<Id<"users">, Promise<boolean>>();
  return (userId) => {
    let eligible = cache.get(userId);
    if (!eligible) {
      eligible = memberPermissionNames(ctx, organizationId, userId).then(
        async (permissions) => {
          if (!canWorkWith(permissions, caseType)) return false;
          if (!incident) return caseType !== "incident";
          const doc = await incident;
          return (
            !!doc &&
            !!permissions?.has(WORK_PERMISSION) &&
            seesIncident(doc, userId, permissions)
          );
        },
      );
      cache.set(userId, eligible);
    }
    return eligible;
  };
}

/**
 * The step's chosen owner, else the case assignee, else the member who
 * accepted the event: the first who may work on the case.
 */
export async function ownerForStep(
  owner: PreparationOwner,
  event: CaseEvent,
  eligible: Eligibility,
) {
  const chosen =
    owner.kind === "member"
      ? owner.userId
      : owner.kind === "caseAssignee"
        ? event.assigneeId
        : event.approverId;
  for (const userId of [chosen, event.assigneeId, event.approverId]) {
    if (userId && (await eligible(userId))) return userId;
  }
  return null;
}

export async function suggestedTaskWithKey(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  key: string,
) {
  return await ctx.db
    .query("caseTasks")
    .withIndex("by_organization_and_suggestionKey", (q) =>
      q.eq("organizationId", organizationId).eq("suggestionKey", key),
    )
    .first();
}

/** The case's tasks; a case holds at most MAX_TASKS_PER_CASE. */
async function tasksOnCase(ctx: QueryCtx, ref: PreparationCaseRef) {
  return await ctx.db
    .query("caseTasks")
    .withIndex("by_organization_and_caseType_and_caseId", (q) =>
      q
        .eq("organizationId", ref.organizationId)
        .eq("caseType", ref.caseType)
        .eq("caseId", ref.caseId),
    )
    .take(MAX_TASKS_PER_CASE);
}

export async function caseTaskCount(ctx: QueryCtx, ref: PreparationCaseRef) {
  return (await tasksOnCase(ctx, ref)).length;
}

export type SkipReason = "no_owner" | "limit_reached";

export interface PreparationOutcome {
  suggested: number;
  existing: number;
  skipped: Array<{ recipeName: string; stepTitle: string; reason: SkipReason }>;
}

/**
 * Keeps an open suggestion in line with its corrected event: it waits for
 * the tasks of the steps it depends on, and its due date follows the case
 * dates unless staff changed it.
 */
async function keepSuggestionCurrent(
  ctx: MutationCtx,
  task: Doc<"caseTasks">,
  step: PreparationStep,
  event: CaseEvent,
  dependsOn: Id<"caseTasks">[],
  actorId: Id<"users">,
) {
  const suggestion = task.suggestion;
  if (!suggestion || !isOpenStatus(task.status)) return;
  const missingDependencies = dependsOn.filter(
    (id) => !task.dependsOnTaskIds.includes(id),
  );
  const dueDate = suggestedDueDate(step.due, event.dates);
  const reschedule =
    dueDate !== suggestion.suggestedDueDate &&
    task.dueDate === suggestion.suggestedDueDate;
  if (missingDependencies.length === 0 && !reschedule) return;
  await ctx.db.patch(task._id, {
    dependsOnTaskIds: [...task.dependsOnTaskIds, ...missingDependencies],
    ...(reschedule
      ? {
          dueDate,
          queueDueAt: dueDate ?? UNDATED,
          suggestion: { ...suggestion, suggestedDueDate: dueDate },
        }
      : {}),
    updatedAt: Date.now(),
  });
  await logTaskEvent(ctx, task, task._id, actorId, "task_suggestion_updated", {
    dependsOnTaskIds: missingDependencies,
    ...(reschedule ? { from: task.dueDate, to: dueDate } : {}),
  });
}

async function insertSuggestedTask(
  ctx: MutationCtx,
  args: {
    event: CaseEvent;
    recipe: Doc<"preparationRecipes">;
    step: PreparationStep;
    key: string;
    ownerId: Id<"users">;
    dependsOn: Id<"caseTasks">[];
    actorId: Id<"users">;
  },
) {
  const { event, recipe, step, ownerId, actorId } = args;
  const dueDate = suggestedDueDate(step.due, event.dates);
  const now = Date.now();
  const task = {
    organizationId: event.organizationId,
    caseType: event.caseType,
    caseId: event.caseId,
    title: step.title,
    description: step.description,
    ownerId,
    dueDate,
    queueDueAt: dueDate ?? UNDATED,
    status: "todo" as const,
    open: true,
    dependsOnTaskIds: args.dependsOn,
    suggestion: {
      recipeId: recipe._id,
      recipeName: recipe.name,
      stepKey: step.key,
      trigger: event.trigger,
      eventAt: event.eventAt,
      evidence: step.evidence,
      suggestedDueDate: dueDate,
    },
    suggestionKey: args.key,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
  const taskId = await ctx.db.insert("caseTasks", task);
  await logTaskEvent(ctx, task, taskId, actorId, "task_suggested", {
    recipeId: recipe._id,
    recipeName: recipe.name,
    stepKey: step.key,
    ownerId,
    dueDate,
    dependsOnTaskIds: args.dependsOn,
  });
  await dispatchNotification(ctx, {
    organizationId: event.organizationId,
    type: "task_assigned",
    recipients: [ownerId],
    title: "Task Assigned",
    message: `You have been assigned to: ${step.title}`,
    related: {
      entityType: CASE_TYPES[event.caseType].entityType,
      entityId: event.caseId,
    },
    email: {
      kind: "taskAssigned",
      taskTitle: step.title,
      assignedBy: recipe.name,
      dueDate,
    },
    idempotencyKey: `preparation:${args.key}`,
  });
  return taskId;
}

/**
 * Suggests the steps of every active recipe that follows the case's accepted
 * event, as the actor. A step that already has a task, in any status, keeps
 * it: repeating the event only adds missing steps, and a correction moves due
 * dates staff have not changed. Steps without an eligible owner, or past the
 * case's task limit, are skipped and reported.
 */
export async function suggestPreparation(
  ctx: MutationCtx,
  ref: PreparationCaseRef,
  actorId: Id<"users">,
): Promise<PreparationOutcome> {
  const outcome: PreparationOutcome = {
    suggested: 0,
    existing: 0,
    skipped: [],
  };
  const event = await acceptedCaseEvent(ctx, ref);
  if (!event) return outcome;
  const recipes = await recipesForEvent(ctx, event);
  if (recipes.length === 0) return outcome;
  const eligible = ownerEligibility(ctx, event);
  let taskCount = await caseTaskCount(ctx, event);
  for (const recipe of recipes) {
    const stepTasks = new Map<string, Id<"caseTasks">>();
    for (const step of recipe.steps) {
      const key = suggestionKey(event, recipe._id, step.key);
      const dependsOn = step.dependsOn.flatMap((dependency) => {
        const taskId = stepTasks.get(dependency);
        return taskId ? [taskId] : [];
      });
      const existing = await suggestedTaskWithKey(
        ctx,
        event.organizationId,
        key,
      );
      if (existing) {
        stepTasks.set(step.key, existing._id);
        outcome.existing++;
        await keepSuggestionCurrent(
          ctx,
          existing,
          step,
          event,
          dependsOn,
          actorId,
        );
        continue;
      }
      const skip = (reason: SkipReason) =>
        outcome.skipped.push({
          recipeName: recipe.name,
          stepTitle: step.title,
          reason,
        });
      if (taskCount >= MAX_TASKS_PER_CASE) {
        skip("limit_reached");
        continue;
      }
      const ownerId = await ownerForStep(step.owner, event, eligible);
      if (!ownerId) {
        skip("no_owner");
        continue;
      }
      const taskId = await insertSuggestedTask(ctx, {
        event,
        recipe,
        step,
        key,
        ownerId,
        dependsOn,
        actorId,
      });
      stepTasks.set(step.key, taskId);
      taskCount++;
      outcome.suggested++;
    }
  }
  return outcome;
}

/**
 * Moves the due dates of the case's open suggestions with its corrected
 * dates, unless staff changed them. Suggestions of paused or archived
 * recipes follow too; nothing is added, so a date change never brings in
 * steps nobody applied.
 */
export async function correctPreparation(
  ctx: MutationCtx,
  ref: PreparationCaseRef,
  actorId: Id<"users">,
) {
  const event = await acceptedCaseEvent(ctx, ref);
  if (!event) return;
  const stepsByRecipe = new Map<
    Id<"preparationRecipes">,
    Promise<Map<string, PreparationStep>>
  >();
  const stepsOf = (recipeId: Id<"preparationRecipes">) => {
    let steps = stepsByRecipe.get(recipeId);
    if (!steps) {
      steps = ctx.db
        .get(recipeId)
        .then(
          (recipe) =>
            new Map((recipe?.steps ?? []).map((step) => [step.key, step])),
        );
      stepsByRecipe.set(recipeId, steps);
    }
    return steps;
  };
  for (const task of await tasksOnCase(ctx, ref)) {
    const suggestion = task.suggestion;
    if (!suggestion || !isOpenStatus(task.status)) continue;
    const step = (await stepsOf(suggestion.recipeId)).get(suggestion.stepKey);
    if (step) await keepSuggestionCurrent(ctx, task, step, event, [], actorId);
  }
}

/**
 * Withdraws the suggestions nobody has started when their event is reversed,
 * such as an approved loan cancelled before dispatch. Started, blocked or
 * reviewed tasks and tasks with linked evidence stay for staff to close.
 */
export async function withdrawPreparation(
  ctx: MutationCtx,
  ref: PreparationCaseRef,
  actorId: Id<"users">,
  reason: "loan_cancelled",
) {
  for (const task of await tasksOnCase(ctx, ref)) {
    if (!task.suggestion || task.status !== "todo" || task.startedAt) continue;
    const evidence = await ctx.db
      .query("caseTaskEvidence")
      .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
      .first();
    if (evidence) continue;
    await ctx.db.patch(task._id, {
      status: "cancelled",
      open: false,
      suggestion: { ...task.suggestion, withdrawnReason: reason },
      updatedAt: Date.now(),
    });
    await logTaskEvent(
      ctx,
      task,
      task._id,
      actorId,
      "task_suggestion_withdrawn",
      { reason, from: task.status, to: "cancelled" },
    );
  }
}
