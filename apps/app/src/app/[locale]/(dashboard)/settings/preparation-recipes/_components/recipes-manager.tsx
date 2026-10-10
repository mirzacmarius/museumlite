"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { PreparationTrigger } from "@v1/backend/convex/utils/preparationValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ChevronDown,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useScopedI18n } from "@/locales/client";
import { RecipeDialog } from "./recipe-dialog";
import { draftOfRecipe, type Recipe, type RecipeDraft } from "./recipe-draft";
import { STARTERS, type StarterId, useRecipeStarter } from "./recipe-starters";

type RecipeStatus = Recipe["status"];

/** The recipe being edited, or none for a new one, and its starting draft. */
interface RecipeEditor {
  recipe?: Recipe;
  draft: RecipeDraft;
}

function statusToast(from: RecipeStatus, to: RecipeStatus) {
  if (from === "archived") return "toasts.restored";
  if (to === "archived") return "toasts.archived";
  return to === "paused" ? "toasts.paused" : "toasts.resumed";
}

/** Triggers whose cases the organization's plan includes. */
function useAvailableTriggers(): PreparationTrigger[] {
  const { hasFeature } = useFeatureAccess();
  return [
    "intake_accepted",
    ...(hasFeature("loans") ? (["loan_approved"] as const) : []),
    ...(hasFeature("exhibitions") ? (["exhibition_approved"] as const) : []),
  ];
}

function RecipeRow({
  recipe,
  busy,
  onEdit,
  onStatus,
}: {
  recipe: Recipe;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: RecipeStatus) => void;
}) {
  const t = useScopedI18n("preparationRecipes");
  const tEvidence = useScopedI18n("caseTasks.evidenceKinds");
  return (
    <li className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{recipe.name}</span>
            <Badge variant={recipe.status === "active" ? "default" : "outline"}>
              {t(`statuses.${recipe.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(`triggers.${recipe.trigger}`)}
            {recipe.trigger === "loan_approved"
              ? ` · ${t(`directions.${recipe.loanDirection ?? "any"}`)}`
              : null}
            {" · "}
            {t("stepCount", { count: recipe.steps.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recipe.status !== "archived" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={busy}
            >
              <Pencil className="mr-2 size-4" />
              {t("actions.edit")}
            </Button>
          ) : null}
          {recipe.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatus("paused")}
              disabled={busy}
            >
              <Pause className="mr-2 size-4" />
              {t("actions.pause")}
            </Button>
          ) : null}
          {recipe.status === "paused" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatus("active")}
              disabled={busy}
            >
              <Play className="mr-2 size-4" />
              {t("actions.resume")}
            </Button>
          ) : null}
          {recipe.status === "archived" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatus("paused")}
              disabled={busy}
            >
              <RotateCcw className="mr-2 size-4" />
              {t("actions.restore")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatus("archived")}
              disabled={busy}
            >
              <Archive className="mr-2 size-4" />
              {t("actions.archive")}
            </Button>
          )}
        </div>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground/80">
        {recipe.steps.map((step) => (
          <li key={step.key}>
            {step.title}
            {step.evidence ? (
              <span className="text-muted-foreground">
                {" "}
                · {t("evidenceShort", { kind: tEvidence(step.evidence) })}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </li>
  );
}

/** The organization's preparation recipes, their status actions and editor. */
export function RecipesManager({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("preparationRecipes");
  const errorMessage = useWorkErrorMessage();
  const recipes = useQuery(api.preparationRecipes.list, { organizationId });
  const setStatus = useMutation(api.preparationRecipes.setStatus);
  const starterDraft = useRecipeStarter();
  const triggers = useAvailableTriggers();
  const [editor, setEditor] = useState<RecipeEditor | null>(null);
  const [busyId, setBusyId] = useState<Id<"preparationRecipes"> | null>(null);

  // Loan starters open as exhibition recipes when only exhibitions are included.
  const starters = STARTERS.flatMap((starter) => {
    const draft = starterDraft(starter);
    if (triggers.includes(draft.trigger)) return [{ starter, draft }];
    if (
      draft.trigger === "loan_approved" &&
      triggers.includes("exhibition_approved")
    )
      return [
        {
          starter,
          draft: {
            ...draft,
            trigger: "exhibition_approved" as const,
            loanDirection: "any" as const,
          },
        },
      ];
    return [];
  });

  const openStarter = (starter: StarterId) => {
    const choice = starters.find((option) => option.starter === starter);
    if (choice) setEditor({ draft: choice.draft });
  };

  const changeStatus = async (recipe: Recipe, status: RecipeStatus) => {
    setBusyId(recipe._id);
    try {
      await setStatus({ recipeId: recipe._id, status });
      toast.success(t(statusToast(recipe.status, status)));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("description")}
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("notificationsHint")}{" "}
            <Link
              href="/notifications/settings"
              className="underline hover:text-foreground"
            >
              {t("notificationsLink")}
            </Link>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              {t("add")}
              <ChevronDown className="ml-2 size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {starters.map(({ starter }) => (
              <DropdownMenuItem
                key={starter}
                onSelect={() => openStarter(starter)}
              >
                {t(`starters.${starter}.label`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {recipes === undefined ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : recipes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {recipes.map((recipe) => (
            <RecipeRow
              key={recipe._id}
              recipe={recipe}
              busy={busyId === recipe._id}
              onEdit={() => setEditor({ recipe, draft: draftOfRecipe(recipe) })}
              onStatus={(status) => changeStatus(recipe, status)}
            />
          ))}
        </ul>
      )}

      {editor ? (
        <RecipeDialog
          organizationId={organizationId}
          recipe={editor.recipe}
          initialDraft={editor.draft}
          triggers={triggers}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
        />
      ) : null}
    </div>
  );
}
