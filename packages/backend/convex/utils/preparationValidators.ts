import { type Infer, v } from "convex/values";
import { caseTaskEvidenceKindValidator } from "./caseTaskValidators";

/**
 * Accepted case events a preparation recipe can follow. An incident response
 * plan follows triage, but only when a coordinator chose it (ADR 0015).
 */
export const preparationTriggerValidator = v.union(
  v.literal("intake_accepted"),
  v.literal("loan_approved"),
  v.literal("exhibition_approved"),
  v.literal("incident_response"),
);
export type PreparationTrigger = Infer<typeof preparationTriggerValidator>;

export const PREPARATION_TRIGGERS: readonly PreparationTrigger[] = [
  "intake_accepted",
  "loan_approved",
  "exhibition_approved",
  "incident_response",
];

export const preparationRecipeStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived"),
);

export const loanDirectionValidator = v.union(
  v.literal("incoming"),
  v.literal("outgoing"),
);

/**
 * Who owns a suggested task: the member assigned to the case, the member who
 * accepted the event, or a named member. Ineligible choices fall back in that
 * order (see `suggestPreparation`).
 */
export const preparationOwnerValidator = v.union(
  v.object({ kind: v.literal("caseAssignee") }),
  v.object({ kind: v.literal("approver") }),
  v.object({ kind: v.literal("member"), userId: v.id("users") }),
);
export type PreparationOwner = Infer<typeof preparationOwnerValidator>;

/**
 * A due date in days from a case date: the acceptance, or the loan or
 * exhibition's start or end. Incident plans count hours from triage instead.
 */
export const preparationDueValidator = v.object({
  anchor: v.union(v.literal("event"), v.literal("start"), v.literal("end")),
  offsetDays: v.number(),
  offsetHours: v.optional(v.number()),
});
export type PreparationDue = Infer<typeof preparationDueValidator>;

const stepFields = {
  title: v.string(),
  description: v.optional(v.string()),
  /** Evidence that shows the step was done; it gates completion. */
  evidence: v.optional(caseTaskEvidenceKindValidator),
  owner: preparationOwnerValidator,
  due: v.optional(preparationDueValidator),
};

export const preparationStepValidator = v.object({
  /** Stable within the recipe; part of every suggestion key. */
  key: v.string(),
  ...stepFields,
  /** Keys of earlier steps this one waits for. */
  dependsOn: v.array(v.string()),
});
export type PreparationStep = Infer<typeof preparationStepValidator>;

export const preparationStepInputValidator = v.object({
  /** Key of the step being edited; absent for a new step. */
  key: v.optional(v.string()),
  ...stepFields,
  /** Positions of earlier steps in the submitted list. */
  dependsOn: v.array(v.number()),
});
export type PreparationStepInput = Infer<typeof preparationStepInputValidator>;

/**
 * Where a suggested task came from: the preparation recipe step and the case
 * event that suggested it (ADR 0012).
 */
export const caseTaskSuggestionValidator = v.object({
  recipeId: v.id("preparationRecipes"),
  /** Recipe name when the task was suggested. */
  recipeName: v.string(),
  stepKey: v.string(),
  trigger: preparationTriggerValidator,
  eventAt: v.number(),
  /** Evidence kind that must be linked before the task can be completed. */
  evidence: v.optional(caseTaskEvidenceKindValidator),
  /** Due date the recipe last gave it; corrections move only an unchanged date. */
  suggestedDueDate: v.optional(v.number()),
  /** Set when the task was withdrawn because its event was reversed. */
  withdrawnReason: v.optional(v.literal("loan_cancelled")),
});
export type CaseTaskSuggestion = Infer<typeof caseTaskSuggestionValidator>;
