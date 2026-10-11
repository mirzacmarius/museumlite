"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  PREPARATION_TRIGGERS,
  type PreparationTrigger,
} from "@v1/backend/convex/utils/preparationValidators";
import { workErrorFromError } from "@v1/backend/convex/utils/workErrors";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useScopedI18n } from "@/locales/client";
import {
  anchorsFor,
  blankStep,
  countsHours,
  type DraftErrors,
  draftErrors,
  EVIDENCE_KINDS,
  hasDraftErrors,
  type LoanDirectionChoice,
  MAX_STEPS,
  OWNER_KINDS,
  type Recipe,
  type RecipeDraft,
  recipeInput,
  type StepDraft,
  type StepField,
  withEarlierDependencies,
} from "./recipe-draft";

const NONE = "none";
const LOAN_DIRECTIONS: LoanDirectionChoice[] = ["any", "outgoing", "incoming"];

interface Member {
  userId: Id<"users">;
  name: string;
}

function stepError(
  stepIndex: number | undefined,
  field: StepField,
): DraftErrors {
  return stepIndex === undefined
    ? { steps: true, stepFields: {} }
    : { stepFields: { [stepIndex]: [field] } };
}

/** Field errors from the server's coded refusal. */
function serverErrorsOf(error: unknown): DraftErrors | null {
  const data = workErrorFromError(error);
  if (data?.code !== "RECIPE_INVALID") return null;
  switch (data.field) {
    case "name":
      return { name: true, stepFields: {} };
    case "title":
    case "description":
    case "owner":
    case "due":
    case "dependsOn":
      return stepError(data.stepIndex, data.field);
    default:
      return { steps: true, stepFields: {} };
  }
}

function StepEditor({
  step,
  index,
  count,
  trigger,
  earlierSteps,
  members,
  invalid,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  step: StepDraft;
  index: number;
  count: number;
  trigger: PreparationTrigger;
  earlierSteps: StepDraft[];
  members: Member[] | undefined;
  invalid: StepField[];
  disabled: boolean;
  onChange: (changes: Partial<StepDraft>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useScopedI18n("preparationRecipes.dialog");
  const tEvidence = useScopedI18n("caseTasks.evidenceKinds");
  const id = (field: string) => `recipe-step-${step.clientKey}-${field}`;
  const errorId = (field: StepField) => `${id(field)}-error`;
  const isInvalid = (field: StepField) => invalid.includes(field);
  const anchors = anchorsFor(trigger);
  const hourly = countsHours(trigger);
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-medium">
          {t("step", { number: index + 1 })}
        </legend>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("moveUp")}
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("moveDown")}
            disabled={disabled || index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("removeStep")}
            disabled={disabled || count === 1}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("title")}>{t("stepTitle")}</Label>
        <Input
          id={id("title")}
          value={step.title}
          maxLength={200}
          aria-invalid={isInvalid("title")}
          aria-describedby={isInvalid("title") ? errorId("title") : undefined}
          onChange={(event) => onChange({ title: event.target.value })}
          disabled={disabled}
        />
        {isInvalid("title") ? (
          <p id={errorId("title")} className="text-xs text-destructive">
            {t("errors.title")}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("description")}>{t("stepDescription")}</Label>
        <Textarea
          id={id("description")}
          value={step.description}
          maxLength={2000}
          rows={2}
          aria-invalid={isInvalid("description")}
          onChange={(event) => onChange({ description: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("evidence")}>{t("evidence")}</Label>
          <Select
            value={step.evidence}
            onValueChange={(value) =>
              onChange({
                evidence:
                  EVIDENCE_KINDS.find((kind) => kind === value) ?? "none",
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id={id("evidence")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("noEvidence")}</SelectItem>
              {EVIDENCE_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {tEvidence(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("owner")}>{t("owner")}</Label>
          <Select
            value={step.ownerKind}
            onValueChange={(value) => {
              const ownerKind = OWNER_KINDS.find((kind) => kind === value);
              if (ownerKind) onChange({ ownerKind });
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={id("owner")}
              aria-invalid={isInvalid("owner")}
              aria-describedby={
                isInvalid("owner") ? errorId("owner") : undefined
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OWNER_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {hourly ? t(`incidentOwners.${kind}`) : t(`owners.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {step.ownerKind === "member" ? (
        <div className="space-y-1.5">
          <Label htmlFor={id("member")}>{t("ownerMember")}</Label>
          <Select
            value={step.ownerUserId ?? ""}
            onValueChange={(value) =>
              onChange({
                ownerUserId:
                  members?.find((member) => member.userId === value)?.userId ??
                  null,
              })
            }
            disabled={disabled || !members}
          >
            <SelectTrigger
              id={id("member")}
              aria-invalid={isInvalid("owner")}
              aria-describedby={
                isInvalid("owner") ? errorId("owner") : undefined
              }
            >
              <SelectValue placeholder={t("chooseMember")} />
            </SelectTrigger>
            <SelectContent>
              {(members ?? []).map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {isInvalid("owner") ? (
        <p id={errorId("owner")} className="text-xs text-destructive">
          {t("errors.owner")}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("anchor")}>{t("due")}</Label>
          <Select
            value={step.dueAnchor}
            onValueChange={(value) =>
              onChange({
                dueAnchor: anchors.find((anchor) => anchor === value) ?? "none",
              })
            }
            disabled={disabled}
          >
            <SelectTrigger
              id={id("anchor")}
              aria-invalid={isInvalid("due")}
              aria-describedby={isInvalid("due") ? errorId("due") : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("noDue")}</SelectItem>
              {anchors.map((anchor) => (
                <SelectItem key={anchor} value={anchor}>
                  {hourly ? t("anchorTriage") : t(`anchors.${anchor}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {step.dueAnchor !== "none" && hourly ? (
          <div className="space-y-1.5">
            <Label htmlFor={id("offset")}>{t("offsetHours")}</Label>
            <Input
              id={id("offset")}
              type="number"
              inputMode="numeric"
              min={0}
              max={168}
              step={1}
              value={step.offsetHours}
              aria-invalid={isInvalid("due")}
              aria-describedby={isInvalid("due") ? errorId("due") : id("hint")}
              onChange={(event) =>
                onChange({ offsetHours: event.target.value })
              }
              disabled={disabled}
            />
            <p id={id("hint")} className="text-xs text-muted-foreground">
              {t("offsetHoursHint")}
            </p>
          </div>
        ) : step.dueAnchor !== "none" ? (
          <div className="space-y-1.5">
            <Label htmlFor={id("offset")}>{t("offsetDays")}</Label>
            <Input
              id={id("offset")}
              type="number"
              inputMode="numeric"
              min={-365}
              max={365}
              step={1}
              value={step.offsetDays}
              aria-invalid={isInvalid("due")}
              aria-describedby={isInvalid("due") ? errorId("due") : id("hint")}
              onChange={(event) => onChange({ offsetDays: event.target.value })}
              disabled={disabled}
            />
            <p id={id("hint")} className="text-xs text-muted-foreground">
              {t("offsetHint")}
            </p>
          </div>
        ) : null}
      </div>
      {isInvalid("due") ? (
        <p id={errorId("due")} className="text-xs text-destructive">
          {t("errors.due")}
        </p>
      ) : null}

      {earlierSteps.length > 0 ? (
        <div
          className="space-y-2"
          aria-invalid={isInvalid("dependsOn")}
          aria-describedby={
            isInvalid("dependsOn") ? errorId("dependsOn") : undefined
          }
        >
          <p className="text-sm font-medium">{t("dependsOn")}</p>
          {earlierSteps.map((earlier, position) => {
            const checkboxId = `${id("depends")}-${earlier.clientKey}`;
            return (
              <div key={earlier.clientKey} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={step.dependsOn.includes(earlier.clientKey)}
                  onCheckedChange={(checked) =>
                    onChange({
                      dependsOn:
                        checked === true
                          ? [...step.dependsOn, earlier.clientKey]
                          : step.dependsOn.filter(
                              (key) => key !== earlier.clientKey,
                            ),
                    })
                  }
                  disabled={disabled}
                />
                <Label htmlFor={checkboxId} className="font-normal">
                  {t("stepReference", {
                    number: position + 1,
                    title: earlier.title || t("untitled"),
                  })}
                </Label>
              </div>
            );
          })}
          {isInvalid("dependsOn") ? (
            <p id={errorId("dependsOn")} className="text-xs text-destructive">
              {t("errors.dependsOn")}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

/** Creates a recipe from `initialDraft`, or edits `recipe` when one is given. */
export function RecipeDialog({
  organizationId,
  recipe,
  initialDraft,
  triggers,
  onOpenChange,
}: {
  organizationId: Id<"organizations">;
  recipe?: Recipe;
  initialDraft: RecipeDraft;
  /** Triggers the organization's plan includes. */
  triggers: PreparationTrigger[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("preparationRecipes");
  const errorMessage = useWorkErrorMessage();
  const createRecipe = useMutation(api.preparationRecipes.create);
  const updateRecipe = useMutation(api.preparationRecipes.update);
  const [draft, setDraft] = useState(() => initialDraft);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<DraftErrors | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const members = useQuery(api.preparationRecipes.listOwnerCandidates, {
    organizationId,
    trigger: draft.trigger,
  });
  const errors = serverErrors ?? (submitted ? draftErrors(draft) : null);
  // An edited recipe keeps its trigger even if the plan no longer includes it.
  const triggerOptions = PREPARATION_TRIGGERS.filter(
    (trigger) => triggers.includes(trigger) || trigger === draft.trigger,
  );

  const setSteps = (steps: StepDraft[]) => {
    setServerErrors(null);
    setDraft((current) => ({
      ...current,
      steps: withEarlierDependencies(steps),
    }));
  };
  const changeStep = (index: number, changes: Partial<StepDraft>) =>
    setSteps(
      draft.steps.map((step, position) =>
        position === index ? { ...step, ...changes } : step,
      ),
    );
  const moveStep = (index: number, offset: -1 | 1) => {
    const steps = [...draft.steps];
    const [moved] = steps.splice(index, 1);
    if (!moved) return;
    steps.splice(index + offset, 0, moved);
    setSteps(steps);
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setServerErrors(null);
    const input = recipeInput(draft);
    if (hasDraftErrors(draftErrors(draft)) || !input) return;
    setIsSaving(true);
    try {
      if (recipe) await updateRecipe({ recipeId: recipe._id, recipe: input });
      else
        await createRecipe({
          organizationId,
          recipe: { ...input, trigger: draft.trigger },
        });
      toast.success(t("toasts.saved"));
      onOpenChange(false);
    } catch (error) {
      setServerErrors(serverErrorsOf(error));
      toast.error(errorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <DialogHeader>
            <DialogTitle>
              {recipe ? t("dialog.editTitle") : t("dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="recipe-name">{t("dialog.name")}</Label>
            <Input
              id="recipe-name"
              value={draft.name}
              maxLength={120}
              aria-invalid={errors?.name === true}
              aria-describedby={errors?.name ? "recipe-name-error" : undefined}
              onChange={(event) => {
                const name = event.target.value;
                setDraft((current) => ({ ...current, name }));
              }}
              disabled={isSaving}
            />
            {errors?.name ? (
              <p id="recipe-name-error" className="text-xs text-destructive">
                {t("dialog.errors.name")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recipe-trigger">{t("dialog.trigger")}</Label>
              <Select
                value={draft.trigger}
                onValueChange={(value) => {
                  const trigger = PREPARATION_TRIGGERS.find(
                    (option) => option === value,
                  );
                  if (!trigger) return;
                  const anchors = anchorsFor(trigger);
                  setDraft((current) => ({
                    ...current,
                    trigger,
                    steps: current.steps.map((step) => ({
                      ...step,
                      // Candidates differ by case kind; anchors by trigger.
                      ownerUserId: null,
                      dueAnchor:
                        step.dueAnchor !== "none" &&
                        anchors.includes(step.dueAnchor)
                          ? step.dueAnchor
                          : "none",
                    })),
                  }));
                }}
                disabled={isSaving || recipe !== undefined}
              >
                <SelectTrigger
                  id="recipe-trigger"
                  aria-describedby="recipe-trigger-hint"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {t(`triggers.${trigger}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                id="recipe-trigger-hint"
                className="text-xs text-muted-foreground"
              >
                {recipe
                  ? t("dialog.triggerLocked")
                  : t(`triggerHints.${draft.trigger}`)}
              </p>
            </div>
            {draft.trigger === "loan_approved" ? (
              <div className="space-y-1.5">
                <Label htmlFor="recipe-direction">
                  {t("dialog.direction")}
                </Label>
                <Select
                  value={draft.loanDirection}
                  onValueChange={(value) => {
                    const loanDirection = LOAN_DIRECTIONS.find(
                      (option) => option === value,
                    );
                    if (loanDirection)
                      setDraft((current) => ({ ...current, loanDirection }));
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger id="recipe-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_DIRECTIONS.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {t(`directions.${direction}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t("dialog.steps")}</h3>
            {draft.steps.map((step, index) => (
              <StepEditor
                key={step.clientKey}
                step={step}
                index={index}
                count={draft.steps.length}
                trigger={draft.trigger}
                earlierSteps={draft.steps.slice(0, index)}
                members={members}
                invalid={errors?.stepFields[index] ?? []}
                disabled={isSaving}
                onChange={(changes) => changeStep(index, changes)}
                onMove={(offset) => moveStep(index, offset)}
                onRemove={() =>
                  setSteps(
                    draft.steps.filter((_, position) => position !== index),
                  )
                }
              />
            ))}
            {errors?.steps ? (
              <p className="text-xs text-destructive">
                {t("dialog.errors.steps")}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving || draft.steps.length >= MAX_STEPS}
              onClick={() => setSteps([...draft.steps, blankStep()])}
            >
              <Plus className="mr-1 size-4" />
              {t("dialog.addStep")}
            </Button>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{t("dialog.ownerFallback")}</p>
            <p>{t("noAttestation")}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("dialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("dialog.saving") : t("dialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
