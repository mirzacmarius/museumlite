"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkErrorMessage } from "@/hooks/use-work-error-message";
import { useScopedI18n } from "@/locales/client";

export type PreparationCaseType =
  | "accession"
  | "loan"
  | "exhibition"
  | "incident";

const STATE_STYLES = {
  suggested: "text-emerald-700 dark:text-emerald-300",
  ready: "text-muted-foreground",
  no_owner: "text-amber-700 dark:text-amber-300",
  limit_reached: "text-amber-700 dark:text-amber-300",
} as const;

/**
 * The tasks the case's preparation recipes suggested, the steps still
 * missing and why, and the action that suggests the missing ones.
 */
export function PreparationSummary({
  organizationId,
  caseType,
  caseId,
}: {
  organizationId: Id<"organizations">;
  caseType: PreparationCaseType;
  caseId: string;
}) {
  const t = useScopedI18n("caseTasks.preparation");
  const errorMessage = useWorkErrorMessage();
  const summary = useQuery(api.preparationRecipes.getForCase, {
    organizationId,
    caseType,
    caseId,
  });
  const apply = useMutation(api.preparationRecipes.applyToCase);
  const [busy, setBusy] = useState(false);
  if (!summary?.event || summary.recipes.length === 0) return null;
  const { event } = summary;
  let readyCount = 0;
  for (const recipe of summary.recipes)
    for (const step of recipe.steps) if (step.state === "ready") readyCount++;

  const suggestMissing = async () => {
    setBusy(true);
    try {
      const outcome = await apply({ organizationId, caseType, caseId });
      if (outcome.suggested > 0)
        toast.success(t("applied", { count: outcome.suggested }));
      else toast.info(t("nothingToApply"));
      if (outcome.skipped.length > 0)
        toast.warning(t("skipped", { count: outcome.skipped.length }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-violet-500" />
          {t("title")}
        </h4>
        {summary.canApply && readyCount > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={suggestMissing}
          >
            {busy ? t("applying") : t("apply", { count: readyCount })}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(`description.${event.trigger}`)}
      </p>
      <ul className="space-y-3">
        {summary.recipes.map((recipe) => (
          <li key={recipe.recipeId} className="space-y-1">
            <p className="text-sm text-foreground">{recipe.name}</p>
            <ul className="space-y-1">
              {recipe.steps.map((step) => (
                <li
                  key={step.key}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs"
                >
                  <span className="text-foreground/80">{step.title}</span>
                  <span className={cn(STATE_STYLES[step.state])}>
                    {t(`states.${step.state}`)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
