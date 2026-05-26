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

interface CollectionSetupState {
  description: string;
  summary: string | null;
  objectTypes: string[];
  suggestions: CollectionGroupSuggestion[];
  selectedIds: Set<string>;
  isGenerating: boolean;
  isApplying: boolean;
  error: string | null;
}

const initialCollectionSetupState: CollectionSetupState = {
  description: "",
  summary: null,
  objectTypes: [],
  suggestions: [],
  selectedIds: new Set(),
  isGenerating: false,
  isApplying: false,
  error: null,
};

function collectSelectedCollectionGroups(
  suggestions: CollectionGroupSuggestion[],
  selectedIds: Set<string>,
): Array<{ name: string; description: string }> {
  const selectedGroups: Array<{ name: string; description: string }> = [];
  for (const group of suggestions) {
    if (!selectedIds.has(group.id)) continue;
    const name = group.name.trim();
    if (name.length === 0) continue;
    selectedGroups.push({ name, description: group.description.trim() });
  }
  return selectedGroups;
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

  const [setup, setSetup] = useState<CollectionSetupState>(
    initialCollectionSetupState,
  );

  const handleGenerate = async () => {
    setSetup((current) => ({ ...current, error: null, isGenerating: true }));
    try {
      const result = await generateSuggestions({
        organizationName: orgFormData.name,
        organizationType: orgFormData.type,
        description: setup.description,
      });

      const withIds = result.collectionGroups.map((group, index) => ({
        id: `suggestion-${index}`,
        name: group.name,
        description: group.description,
      }));

      setSetup((current) => ({
        ...current,
        summary: result.summary,
        objectTypes: result.objectTypes,
        suggestions: withIds,
        selectedIds: new Set(withIds.map((group) => group.id)),
        isGenerating: false,
      }));
    } catch {
      setSetup((current) => ({
        ...current,
        error: t("onboardingPage.collectionSetup.generateFailed"),
        isGenerating: false,
      }));
    }
  };

  const updateSuggestion = useCallback(
    (id: string, patch: Partial<Pick<CollectionGroupSuggestion, "name" | "description">>) => {
      setSetup((current) => ({
        ...current,
        suggestions: current.suggestions.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [],
  );

  const removeSuggestion = useCallback((id: string) => {
    setSetup((current) => {
      const nextSelectedIds = new Set(current.selectedIds);
      nextSelectedIds.delete(id);
      return {
        ...current,
        suggestions: current.suggestions.filter((item) => item.id !== id),
        selectedIds: nextSelectedIds,
      };
    });
  }, []);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSetup((current) => {
      const nextSelectedIds = new Set(current.selectedIds);
      if (checked) nextSelectedIds.add(id);
      else nextSelectedIds.delete(id);
      return { ...current, selectedIds: nextSelectedIds };
    });
  }, []);

  const handleApply = async () => {
    const selectedGroups = collectSelectedCollectionGroups(
      setup.suggestions,
      setup.selectedIds,
    );

    if (selectedGroups.length === 0) {
      onComplete();
      return;
    }

    setSetup((current) => ({ ...current, error: null, isApplying: true }));
    try {
      await applySuggestions({
        organizationId,
        collectionGroups: selectedGroups,
      });
      onComplete();
    } catch {
      setSetup((current) => ({
        ...current,
        error: t("onboardingPage.collectionSetup.applyFailed"),
        isApplying: false,
      }));
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
            value={setup.description}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder={t("onboardingPage.collectionSetup.promptPlaceholder")}
            rows={4}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={setup.isGenerating || !orgFormData.name}
          onClick={handleGenerate}
        >
          {setup.isGenerating ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              {t("onboardingPage.collectionSetup.generate")}
            </>
          )}
        </Button>

        {setup.summary && (
          <p className="rounded-lg border border-white/10 bg-muted/30 p-3 text-sm text-muted-foreground">
            {setup.summary}
          </p>
        )}

        {setup.objectTypes.length > 0 && (
          <div className="rounded-lg border border-white/10 p-3">
            <p className="mb-2 text-sm font-medium">
              {t("onboardingPage.collectionSetup.objectTypesLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {setup.objectTypes.join(" · ")}
            </p>
          </div>
        )}

        {setup.suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {t("onboardingPage.collectionSetup.groupsLabel")}
            </p>
            {setup.suggestions.map((group) => (
              <div
                key={group.id}
                className="space-y-2 rounded-lg border border-white/10 p-3"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={setup.selectedIds.has(group.id)}
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

        {setup.error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{setup.error}</p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={setup.isApplying}
          onClick={handleApply}
        >
          {setup.isApplying ? (
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
