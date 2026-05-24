"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { useAction, useMutation } from "convex/react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useI18n } from "@/locales/client";
import type {
  CollectionGroupSuggestion,
  OrganizationFormData,
} from "./onboarding-types";

interface CollectionSetupStepProps {
  organizationId: Id<"organizations">;
  orgFormData: OrganizationFormData;
  onComplete: () => void;
  onSkip: () => void;
}

export function CollectionSetupStep({
  organizationId,
  orgFormData,
  onComplete,
  onSkip,
}: CollectionSetupStepProps) {
  const t = useI18n();
  const generateSuggestions = useAction(
    api.onboardingAi.generateCollectionSuggestions,
  );
  const applySuggestions = useMutation(
    api.onboardingAiMutations.applyCollectionSuggestions,
  );

  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CollectionGroupSuggestion[]>(
    [],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generateSuggestions({
        organizationName: orgFormData.name,
        organizationType: orgFormData.type,
        description,
      });

      const withIds = result.collectionGroups.map((group, index) => ({
        id: `suggestion-${index}`,
        name: group.name,
        description: group.description,
      }));

      setSummary(result.summary);
      setObjectTypes(result.objectTypes);
      setSuggestions(withIds);
      setSelectedIds(new Set(withIds.map((group) => group.id)));
    } catch {
      setError(t("onboardingPage.collectionSetup.generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSuggestion = useCallback(
    (id: string, patch: Partial<Pick<CollectionGroupSuggestion, "name" | "description">>) => {
      setSuggestions((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleApply = async () => {
    const selectedGroups = suggestions
      .filter((group) => selectedIds.has(group.id))
      .map((group) => ({
        name: group.name.trim(),
        description: group.description.trim(),
      }))
      .filter((group) => group.name.length > 0);

    if (selectedGroups.length === 0) {
      onComplete();
      return;
    }

    setError(null);
    setIsApplying(true);
    try {
      await applySuggestions({
        organizationId,
        collectionGroups: selectedGroups,
      });
      onComplete();
    } catch {
      setError(t("onboardingPage.collectionSetup.applyFailed"));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-8 text-primary" />
        </div>
        <h3 className="text-center text-2xl font-medium text-primary">
          {t("onboardingPage.collectionSetup.title")}
        </h3>
        <p className="text-center text-base font-normal text-primary/60">
          {t("onboardingPage.collectionSetup.description")}
        </p>
      </div>

      <div className="w-full space-y-4">
        <div>
          <label
            htmlFor="collection-description"
            className="mb-2 block text-sm font-medium"
          >
            {t("onboardingPage.collectionSetup.promptLabel")}
          </label>
          <Textarea
            id="collection-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("onboardingPage.collectionSetup.promptPlaceholder")}
            rows={4}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isGenerating || !orgFormData.name}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              {t("onboardingPage.collectionSetup.generate")}
            </>
          )}
        </Button>

        {summary && (
          <p className="rounded-lg border border-white/10 bg-muted/30 p-3 text-sm text-muted-foreground">
            {summary}
          </p>
        )}

        {objectTypes.length > 0 && (
          <div className="rounded-lg border border-white/10 p-3">
            <p className="mb-2 text-sm font-medium">
              {t("onboardingPage.collectionSetup.objectTypesLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {objectTypes.join(" · ")}
            </p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {t("onboardingPage.collectionSetup.groupsLabel")}
            </p>
            {suggestions.map((group) => (
              <div
                key={group.id}
                className="space-y-2 rounded-lg border border-white/10 p-3"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(group.id)}
                    onCheckedChange={(checked) =>
                      toggleSelected(group.id, checked === true)
                    }
                    aria-label={group.name}
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={group.name}
                      onChange={(event) =>
                        updateSuggestion(group.id, { name: event.target.value })
                      }
                      placeholder={t(
                        "onboardingPage.collectionSetup.groupNamePlaceholder",
                      )}
                    />
                    <Textarea
                      value={group.description}
                      onChange={(event) =>
                        updateSuggestion(group.id, {
                          description: event.target.value,
                        })
                      }
                      rows={2}
                      placeholder={t(
                        "onboardingPage.collectionSetup.groupDescriptionPlaceholder",
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSuggestion(group.id)}
                    aria-label={t("onboardingPage.collectionSetup.removeGroup")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={isApplying}
          onClick={handleApply}
        >
          {isApplying ? (
            <Loader2 className="animate-spin" />
          ) : (
            t("onboardingPage.collectionSetup.continue")
          )}
        </Button>

        <Button type="button" variant="ghost" className="w-full" onClick={onSkip}>
          {t("onboardingPage.collectionSetup.skip")}
        </Button>
      </div>
    </div>
  );
}
