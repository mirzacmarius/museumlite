import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  CASE_CONFIG,
  canWorkWith,
  displayName,
  loadCase,
  MAX_TASKS_PER_CASE,
} from "./utils/caseTaskRules";
import { caseTaskEvidenceKindValidator } from "./utils/caseTaskValidators";
import { requireFeatureAccess } from "./utils/featureGates";
import {
  memberPermissionNames,
  rolePermissionNames,
} from "./utils/memberPermissions";
import { mutation } from "./utils/mutationBuilders";
import { hasPermission, requirePermission } from "./utils/permissions";
import {
  acceptedCaseEvent,
  caseTaskCount,
  MAX_RECIPES,
  ownerEligibility,
  ownerForStep,
  recipesForEvent,
  suggestedTaskWithKey,
  suggestionKey,
  suggestPreparation,
  TRIGGER_CASE_TYPES,
} from "./utils/preparation";
import {
  loanDirectionValidator,
  type PreparationStep,
  type PreparationStepInput,
  type PreparationTrigger,
  preparationDueValidator,
  preparationOwnerValidator,
  preparationRecipeStatusValidator,
  preparationStepInputValidator,
  preparationTriggerValidator,
} from "./utils/preparationValidators";
import { type RecipeField, workError } from "./utils/workErrors";

const SETTINGS_PERMISSION = "organization.manage_settings";
const MAX_STEPS = 10;
const MAX_NAME_LENGTH = 120;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_OFFSET_DAYS = 365;
/** Recipes listed in settings, archived ones included. */
const MAX_LISTED = 200;
const MEMBER_SCAN = 200;

const TRIGGER_FEATURES = {
  intake_accepted: null,
  loan_approved: "loans",
  exhibition_approved: "exhibitions",
} as const satisfies Record<PreparationTrigger, "loans" | "exhibitions" | null>;

function recipeInvalid(
  field: RecipeField,
  message: string,
  stepIndex?: number,
) {
  return workError("RECIPE_INVALID", message, { field, stepIndex });
}

async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

function recipeName(value: string) {
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH)
    throw recipeInvalid("name", "A recipe needs a name of 1-120 characters");
  return name;
}

/**
 * Validates submitted steps and gives new ones keys. Existing steps keep
 * their key, so tasks already suggested for them stay the same intent.
 */
async function normalizeSteps(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  trigger: PreparationTrigger,
  inputs: PreparationStepInput[],
  existingKeys: ReadonlySet<string>,
  firstStepNumber: number,
) {
  if (inputs.length < 1 || inputs.length > MAX_STEPS)
    throw recipeInvalid("steps", "A recipe needs 1-10 steps");
  const caseType = TRIGGER_CASE_TYPES[trigger];
  let nextStepNumber = firstStepNumber;
  const keys: string[] = [];
  const keptKeys = new Set<string>();
  for (const [index, input] of inputs.entries()) {
    if (input.key === undefined) {
      keys.push(`s${nextStepNumber++}`);
    } else if (existingKeys.has(input.key) && !keptKeys.has(input.key)) {
      keys.push(input.key);
      keptKeys.add(input.key);
    } else {
      throw recipeInvalid("steps", "Unknown step", index);
    }
  }
  const steps: PreparationStep[] = [];
  for (const [index, input] of inputs.entries()) {
    const title = input.title.trim();
    if (!title || title.length > MAX_TITLE_LENGTH)
      throw recipeInvalid("title", "A step needs a title", index);
    const description = input.description?.trim() || undefined;
    if (description && description.length > MAX_DESCRIPTION_LENGTH)
      throw recipeInvalid("description", "Description is too long", index);
    if (input.owner.kind === "member") {
      const permissions = await memberPermissionNames(
        ctx,
        organizationId,
        input.owner.userId,
      );
      if (!canWorkWith(permissions, caseType))
        throw recipeInvalid(
          "owner",
          "The owner must be a member who can work on these cases",
          index,
        );
    }
    if (input.due) {
      const { anchor, offsetDays } = input.due;
      if (
        (trigger === "intake_accepted" && anchor !== "event") ||
        !Number.isInteger(offsetDays) ||
        Math.abs(offsetDays) > MAX_OFFSET_DAYS
      )
        throw recipeInvalid("due", "The due date rule is invalid", index);
    }
    const dependsOn = [...new Set(input.dependsOn)];
    if (
      dependsOn.length !== input.dependsOn.length ||
      dependsOn.some(
        (position) =>
          !Number.isInteger(position) || position < 0 || position >= index,
      )
    )
      throw recipeInvalid(
        "dependsOn",
        "A step can only wait for earlier steps",
        index,
      );
    steps.push({
      key: keys[index] ?? `s${nextStepNumber++}`,
      title,
      description,
      evidence: input.evidence,
      owner: input.owner,
      due: input.due,
      dependsOn: dependsOn.flatMap((position) => keys[position] ?? []),
    });
  }
  return { steps, nextStepNumber };
}

async function unarchivedRecipeCount(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const recipes = await ctx.db
    .query("preparationRecipes")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .take(MAX_RECIPES * 10);
  return recipes.filter((recipe) => recipe.status !== "archived").length;
}

async function logRecipeEvent(
  ctx: MutationCtx,
  recipeId: Id<"preparationRecipes">,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  action: string,
  changes: Record<string, unknown>,
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId,
    userId,
    action: `preparation_recipe_${action}`,
    entityType: "preparationRecipe",
    entityId: recipeId,
    changes,
  });
}

const STATUS_ORDER = { active: 0, paused: 1, archived: 2 } as const;

const recipeValidator = v.object({
  _id: v.id("preparationRecipes"),
  name: v.string(),
  trigger: preparationTriggerValidator,
  loanDirection: v.optional(loanDirectionValidator),
  status: preparationRecipeStatusValidator,
  steps: v.array(
    v.object({
      key: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      evidence: v.optional(caseTaskEvidenceKindValidator),
      owner: preparationOwnerValidator,
      /** Name of a member owner, for the editor. */
      ownerName: v.optional(v.string()),
      due: v.optional(preparationDueValidator),
      dependsOn: v.array(v.string()),
    }),
  ),
  updatedAt: v.number(),
});

/** Every recipe of the organization: active, then paused, then archived. */
export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(recipeValidator),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    await requirePermission(ctx, args.organizationId, SETTINGS_PERMISSION);
    const recipes = await ctx.db
      .query("preparationRecipes")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(MAX_LISTED);
    const owners = new Map<Id<"users">, Promise<Doc<"users"> | null>>();
    const ownerName = async (userId: Id<"users">) => {
      let owner = owners.get(userId);
      if (!owner) {
        owner = ctx.db.get(userId);
        owners.set(userId, owner);
      }
      return displayName(await owner);
    };
    const presented = await Promise.all(
      recipes.map(async (recipe) => ({
        _id: recipe._id,
        name: recipe.name,
        trigger: recipe.trigger,
        loanDirection: recipe.loanDirection,
        status: recipe.status,
        steps: await Promise.all(
          recipe.steps.map(async (step) => ({
            ...step,
            ownerName:
              step.owner.kind === "member"
                ? await ownerName(step.owner.userId)
                : undefined,
          })),
        ),
        updatedAt: recipe.updatedAt,
        createdAt: recipe._creationTime,
      })),
    );
    return presented
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.createdAt - b.createdAt,
      )
      .map(({ createdAt: _createdAt, ...recipe }) => recipe);
  },
});

/** Members who may own tasks on the cases a trigger concerns. */
export const listOwnerCandidates = query({
  args: {
    organizationId: v.id("organizations"),
    trigger: preparationTriggerValidator,
  },
  returns: v.array(v.object({ userId: v.id("users"), name: v.string() })),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    await requirePermission(ctx, args.organizationId, SETTINGS_PERMISSION);
    const caseType = TRIGGER_CASE_TYPES[args.trigger];
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(MEMBER_SCAN);
    const rolePermissions = new Map<Id<"roles">, Promise<Set<string> | null>>();
    const candidates = await Promise.all(
      memberships.map(async (membership) => {
        let permissions = rolePermissions.get(membership.roleId);
        if (!permissions) {
          permissions = rolePermissionNames(ctx, membership.roleId);
          rolePermissions.set(membership.roleId, permissions);
        }
        if (!canWorkWith(await permissions, caseType)) return null;
        const name = displayName(await ctx.db.get(membership.userId));
        return name ? { userId: membership.userId, name } : null;
      }),
    );
    return candidates
      .flatMap((candidate) => (candidate ? [candidate] : []))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId),
      );
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    recipe: v.object({
      name: v.string(),
      trigger: preparationTriggerValidator,
      loanDirection: v.optional(loanDirectionValidator),
      steps: v.array(preparationStepInputValidator),
    }),
  },
  returns: v.id("preparationRecipes"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { organizationId, recipe } = args;
    await requirePermission(ctx, organizationId, SETTINGS_PERMISSION);
    const feature = TRIGGER_FEATURES[recipe.trigger];
    if (feature) await requireFeatureAccess(ctx, organizationId, feature);
    const name = recipeName(recipe.name);
    if (recipe.loanDirection && recipe.trigger !== "loan_approved")
      throw recipeInvalid(
        "loanDirection",
        "Only loan recipes have a direction",
      );
    if ((await unarchivedRecipeCount(ctx, organizationId)) >= MAX_RECIPES)
      throw workError(
        "LIMIT_REACHED",
        "This organization has too many recipes",
      );
    const { steps, nextStepNumber } = await normalizeSteps(
      ctx,
      organizationId,
      recipe.trigger,
      recipe.steps,
      new Set(),
      1,
    );
    const now = Date.now();
    const recipeId = await ctx.db.insert("preparationRecipes", {
      organizationId,
      name,
      trigger: recipe.trigger,
      loanDirection: recipe.loanDirection,
      status: "active",
      steps,
      nextStepNumber,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
    await logRecipeEvent(ctx, recipeId, organizationId, userId, "created", {
      name,
      trigger: recipe.trigger,
      stepCount: steps.length,
    });
    return recipeId;
  },
});

async function loadRecipeForSettings(
  ctx: QueryCtx,
  recipeId: Id<"preparationRecipes">,
) {
  const recipe = await ctx.db.get(recipeId);
  if (!recipe) throw workError("RECIPE_NOT_FOUND", "Recipe not found");
  await requirePermission(ctx, recipe.organizationId, SETTINGS_PERMISSION);
  return recipe;
}

export const update = mutation({
  args: {
    recipeId: v.id("preparationRecipes"),
    recipe: v.object({
      name: v.string(),
      loanDirection: v.optional(loanDirectionValidator),
      steps: v.array(preparationStepInputValidator),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const recipe = await loadRecipeForSettings(ctx, args.recipeId);
    if (recipe.status === "archived")
      throw workError("STATUS_CHANGED", "Restore the recipe before editing it");
    const name = recipeName(args.recipe.name);
    if (args.recipe.loanDirection && recipe.trigger !== "loan_approved")
      throw recipeInvalid(
        "loanDirection",
        "Only loan recipes have a direction",
      );
    const { steps, nextStepNumber } = await normalizeSteps(
      ctx,
      recipe.organizationId,
      recipe.trigger,
      args.recipe.steps,
      new Set(recipe.steps.map((step) => step.key)),
      recipe.nextStepNumber,
    );
    await ctx.db.patch(recipe._id, {
      name,
      loanDirection: args.recipe.loanDirection,
      steps,
      nextStepNumber,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await logRecipeEvent(
      ctx,
      recipe._id,
      recipe.organizationId,
      userId,
      "updated",
      {
        name,
        stepCount: steps.length,
      },
    );
    return null;
  },
});

/**
 * Pauses, resumes, archives or restores a recipe. Tasks it already
 * suggested stay as they are.
 */
export const setStatus = mutation({
  args: {
    recipeId: v.id("preparationRecipes"),
    status: preparationRecipeStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const recipe = await loadRecipeForSettings(ctx, args.recipeId);
    if (recipe.status === args.status) return null;
    if (
      recipe.status === "archived" &&
      (await unarchivedRecipeCount(ctx, recipe.organizationId)) >= MAX_RECIPES
    )
      throw workError(
        "LIMIT_REACHED",
        "This organization has too many recipes",
      );
    await ctx.db.patch(recipe._id, {
      status: args.status,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await logRecipeEvent(
      ctx,
      recipe._id,
      recipe.organizationId,
      userId,
      "status_changed",
      {
        from: recipe.status,
        to: args.status,
      },
    );
    return null;
  },
});

// ============================================
// CASES
// ============================================

const caseArgs = {
  organizationId: v.id("organizations"),
  caseType: v.union(
    v.literal("accession"),
    v.literal("loan"),
    v.literal("exhibition"),
  ),
  caseId: v.string(),
};

const stepStateValidator = v.union(
  /** A task exists for the step, in any status. */
  v.literal("suggested"),
  /** Applying the recipe now would suggest it. */
  v.literal("ready"),
  v.literal("no_owner"),
  v.literal("limit_reached"),
);

interface StepView {
  key: string;
  title: string;
  state: Infer<typeof stepStateValidator>;
  taskId?: Id<"caseTasks">;
}

/**
 * The case's accepted event and, for each active recipe that follows it,
 * whether each step has its task or why applying would skip it.
 */
export const getForCase = query({
  args: caseArgs,
  returns: v.object({
    event: v.union(
      v.null(),
      v.object({ trigger: preparationTriggerValidator, eventAt: v.number() }),
    ),
    /** True when the viewer may apply the recipes to this case. */
    canApply: v.boolean(),
    recipes: v.array(
      v.object({
        recipeId: v.id("preparationRecipes"),
        name: v.string(),
        steps: v.array(
          v.object({
            key: v.string(),
            title: v.string(),
            state: stepStateValidator,
            taskId: v.optional(v.id("caseTasks")),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    await loadCase(ctx, args.organizationId, args.caseType, args.caseId);
    const event = await acceptedCaseEvent(ctx, args);
    if (!event) return { event: null, canApply: false, recipes: [] };
    const [canApply, recipes, taskCount] = await Promise.all([
      hasPermission(
        ctx,
        args.organizationId,
        CASE_CONFIG[args.caseType].workPermission,
      ),
      recipesForEvent(ctx, event),
      caseTaskCount(ctx, event),
    ]);
    const eligible = ownerEligibility(ctx, args.organizationId, args.caseType);
    let room = MAX_TASKS_PER_CASE - taskCount;
    const presented: Array<{
      recipeId: Id<"preparationRecipes">;
      name: string;
      steps: StepView[];
    }> = [];
    for (const recipe of recipes) {
      const steps: StepView[] = [];
      for (const step of recipe.steps) {
        const row = { key: step.key, title: step.title };
        const task = await suggestedTaskWithKey(
          ctx,
          args.organizationId,
          suggestionKey(event, recipe._id, step.key),
        );
        if (task) {
          steps.push({ ...row, state: "suggested", taskId: task._id });
        } else if (room <= 0) {
          steps.push({ ...row, state: "limit_reached" });
        } else if (await ownerForStep(step.owner, event, eligible)) {
          room--;
          steps.push({ ...row, state: "ready" });
        } else {
          steps.push({ ...row, state: "no_owner" });
        }
      }
      presented.push({ recipeId: recipe._id, name: recipe.name, steps });
    }
    return {
      event: { trigger: event.trigger, eventAt: event.eventAt },
      canApply,
      recipes: presented,
    };
  },
});

/**
 * Applies the active recipes to an accepted case again: suggests missing
 * steps, keeps existing ones and moves due dates staff have not changed.
 */
export const applyToCase = mutation({
  args: caseArgs,
  returns: v.object({
    suggested: v.number(),
    existing: v.number(),
    skipped: v.array(
      v.object({
        recipeName: v.string(),
        stepTitle: v.string(),
        reason: v.union(v.literal("no_owner"), v.literal("limit_reached")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Case access refuses anonymous callers before anything is read.
    await loadCase(ctx, args.organizationId, args.caseType, args.caseId);
    await requirePermission(
      ctx,
      args.organizationId,
      CASE_CONFIG[args.caseType].workPermission,
    );
    if (!(await acceptedCaseEvent(ctx, args)))
      throw workError(
        "CASE_NOT_ACCEPTED",
        "Recipes apply once the case is accepted and until it ends",
      );
    return await suggestPreparation(ctx, args, await requireUserId(ctx));
  },
});
