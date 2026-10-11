import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { CaseTaskEvidenceKind } from "@v1/backend/convex/utils/caseTaskValidators";
import type {
  PreparationOwner,
  PreparationStepInput,
  PreparationTrigger,
} from "@v1/backend/convex/utils/preparationValidators";
import type { FunctionReturnType } from "convex/server";
import { z } from "zod";

export type Recipe = FunctionReturnType<
  typeof api.preparationRecipes.list
>[number];

export const EVIDENCE_KINDS: CaseTaskEvidenceKind[] = [
  "conditionAssessment",
  "media",
  "movement",
  "auditEntry",
];
export const OWNER_KINDS = ["caseAssignee", "approver", "member"] as const;
export const DUE_ANCHORS = ["event", "start", "end"] as const;
export const MAX_STEPS = 10;

export type OwnerKind = (typeof OWNER_KINDS)[number];
export type DueAnchor = (typeof DUE_ANCHORS)[number];
export type LoanDirectionChoice = "any" | "incoming" | "outgoing";

export interface StepDraft {
  /** React key; stays with the step while it moves. */
  clientKey: string;
  /** Server key of a saved step, so its suggestions stay the same intent. */
  key?: string;
  title: string;
  description: string;
  evidence: CaseTaskEvidenceKind | "none";
  ownerKind: OwnerKind;
  ownerUserId: Id<"users"> | null;
  dueAnchor: DueAnchor | "none";
  offsetDays: string;
  /** Incident plans count hours from triage instead of days. */
  offsetHours: string;
  /** Client keys of earlier steps this one waits for. */
  dependsOn: string[];
}

export interface RecipeDraft {
  name: string;
  trigger: PreparationTrigger;
  loanDirection: LoanDirectionChoice;
  steps: StepDraft[];
}

let nextClientKey = 0;
export function newClientKey() {
  nextClientKey += 1;
  return `step-${nextClientKey}`;
}

export function blankStep(): StepDraft {
  return {
    clientKey: newClientKey(),
    title: "",
    description: "",
    evidence: "none",
    ownerKind: "caseAssignee",
    ownerUserId: null,
    dueAnchor: "none",
    offsetDays: "0",
    offsetHours: "1",
    dependsOn: [],
  };
}

/** A new incident response plan: the institution writes every step. */
export function blankIncidentPlan(): RecipeDraft {
  return {
    name: "",
    trigger: "incident_response",
    loanDirection: "any",
    steps: [blankStep()],
  };
}

export function draftOfRecipe(recipe: Recipe): RecipeDraft {
  const clientKeys = new Map(
    recipe.steps.map((step) => [step.key, newClientKey()]),
  );
  return {
    name: recipe.name,
    trigger: recipe.trigger,
    loanDirection: recipe.loanDirection ?? "any",
    steps: recipe.steps.map((step) => ({
      clientKey: clientKeys.get(step.key) ?? newClientKey(),
      key: step.key,
      title: step.title,
      description: step.description ?? "",
      evidence: step.evidence ?? "none",
      ownerKind: step.owner.kind,
      ownerUserId: step.owner.kind === "member" ? step.owner.userId : null,
      dueAnchor: step.due?.anchor ?? "none",
      offsetDays: String(step.due?.offsetDays ?? 0),
      offsetHours: String(step.due?.offsetHours ?? 1),
      dependsOn: step.dependsOn.flatMap((key) => clientKeys.get(key) ?? []),
    })),
  };
}

/**
 * Anchors a trigger's cases have: intakes only have their acceptance, and
 * incidents their triage.
 */
export function anchorsFor(trigger: PreparationTrigger): DueAnchor[] {
  return trigger === "intake_accepted" || trigger === "incident_response"
    ? ["event"]
    : [...DUE_ANCHORS];
}

/** Incident plan steps fall due in hours from triage. */
export function countsHours(trigger: PreparationTrigger) {
  return trigger === "incident_response";
}

/** Keeps each step waiting only for steps that still come before it. */
export function withEarlierDependencies(steps: StepDraft[]): StepDraft[] {
  return steps.map((step, index) => {
    const earlier = new Set(
      steps.slice(0, index).map((candidate) => candidate.clientKey),
    );
    return {
      ...step,
      dependsOn: step.dependsOn.filter((key) => earlier.has(key)),
    };
  });
}

const offsetSchema = z.coerce.number().int().min(-365).max(365);
const hoursSchema = z.coerce.number().int().min(0).max(168);

/** Client checks mirroring the recipe commands; the server rules still apply. */
const stepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
});

export type StepField = "title" | "description" | "owner" | "due" | "dependsOn";

export interface DraftErrors {
  name?: true;
  steps?: true;
  /** Per step position, the fields to fix. */
  stepFields: Record<number, StepField[]>;
}

export function draftErrors(draft: RecipeDraft): DraftErrors {
  const errors: DraftErrors = { stepFields: {} };
  if (!z.string().trim().min(1).max(120).safeParse(draft.name).success)
    errors.name = true;
  if (draft.steps.length < 1 || draft.steps.length > MAX_STEPS)
    errors.steps = true;
  const anchors = anchorsFor(draft.trigger);
  draft.steps.forEach((step, index) => {
    const fields: StepField[] = [];
    const parsed = stepSchema.safeParse(step);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        if (issue.path[0] === "title" || issue.path[0] === "description")
          fields.push(issue.path[0]);
    if (step.ownerKind === "member" && !step.ownerUserId) fields.push("owner");
    if (
      step.dueAnchor !== "none" &&
      (!anchors.includes(step.dueAnchor) ||
        !(countsHours(draft.trigger) ? hoursSchema : offsetSchema).safeParse(
          countsHours(draft.trigger) ? step.offsetHours : step.offsetDays,
        ).success)
    )
      fields.push("due");
    if (fields.length > 0) errors.stepFields[index] = fields;
  });
  return errors;
}

export function hasDraftErrors(errors: DraftErrors) {
  return (
    errors.name === true ||
    errors.steps === true ||
    Object.keys(errors.stepFields).length > 0
  );
}

function ownerOf(step: StepDraft): PreparationOwner | null {
  if (step.ownerKind !== "member") return { kind: step.ownerKind };
  return step.ownerUserId ? { kind: "member", userId: step.ownerUserId } : null;
}

/** The recipe as the recipe commands take it; null while an owner is missing. */
export function recipeInput(draft: RecipeDraft) {
  const hourly = countsHours(draft.trigger);
  const positions = new Map(
    draft.steps.map((step, index) => [step.clientKey, index]),
  );
  const steps: PreparationStepInput[] = [];
  for (const step of draft.steps) {
    const owner = ownerOf(step);
    if (!owner) return null;
    steps.push({
      key: step.key,
      title: step.title.trim(),
      description: step.description.trim() || undefined,
      evidence: step.evidence === "none" ? undefined : step.evidence,
      owner,
      due:
        step.dueAnchor === "none"
          ? undefined
          : hourly
            ? {
                anchor: step.dueAnchor,
                offsetDays: 0,
                offsetHours: Number(step.offsetHours),
              }
            : { anchor: step.dueAnchor, offsetDays: Number(step.offsetDays) },
      dependsOn: step.dependsOn.flatMap((key) => positions.get(key) ?? []),
    });
  }
  return {
    name: draft.name.trim(),
    loanDirection:
      draft.trigger === "loan_approved" && draft.loanDirection !== "any"
        ? draft.loanDirection
        : undefined,
    steps,
  };
}
