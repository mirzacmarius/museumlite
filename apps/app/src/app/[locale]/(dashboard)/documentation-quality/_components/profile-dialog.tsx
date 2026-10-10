"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { qualityErrorFromError } from "@v1/backend/convex/utils/documentationQualityErrors";
import {
  DOCUMENTATION_REQUIREMENTS,
  DOCUMENTATION_STAGES,
  type DocumentationRequirement,
  type DocumentationStage,
} from "@v1/backend/convex/utils/documentationQualityValidators";
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
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useQualityErrorMessage } from "@/hooks/use-quality-error-message";
import { useScopedI18n } from "@/locales/client";

const ALL_TYPES = "__all__";

/** Client checks mirroring the profile commands; the server rules still apply. */
const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  objectType: z.string().trim().max(200),
  stages: z.array(z.enum(DOCUMENTATION_STAGES)).min(1),
  requirements: z.array(z.enum(DOCUMENTATION_REQUIREMENTS)).min(1),
});

type ProfileField = keyof z.infer<typeof profileSchema>;

type Profile = FunctionReturnType<
  typeof api.documentationQuality.listProfiles
>["profiles"][number];

interface ProfileDraft {
  name: string;
  objectType: string;
  stages: DocumentationStage[];
  requirements: DocumentationRequirement[];
}

function draftOf(profile: Profile | undefined): ProfileDraft {
  return profile
    ? {
        name: profile.name,
        objectType: profile.objectType ?? "",
        stages: profile.stages,
        requirements: profile.requirements,
      }
    : { name: "", objectType: "", stages: ["collection"], requirements: [] };
}

function fieldErrorsOf(draft: ProfileDraft) {
  const result = profileSchema.safeParse(draft);
  if (result.success) return {};
  const errors: Partial<Record<ProfileField, true>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      field === "name" ||
      field === "objectType" ||
      field === "stages" ||
      field === "requirements"
    )
      errors[field] = true;
  }
  return errors;
}

function toggle<Value>(values: Value[], value: Value, checked: boolean) {
  return checked
    ? [...values, value]
    : values.filter((current) => current !== value);
}

/** Creates a profile, or edits `profile` when one is given. */
export function ProfileDialog({
  organizationId,
  profile,
  onOpenChange,
}: {
  organizationId: Id<"organizations">;
  profile?: Profile;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useScopedI18n("documentationQuality");
  const errorMessage = useQualityErrorMessage();
  const typeOptions = useQuery(api.typeOptions.list, { organizationId });
  const createProfile = useMutation(api.documentationQuality.createProfile);
  const updateProfile = useMutation(api.documentationQuality.updateProfile);
  const [draft, setDraft] = useState(() => draftOf(profile));
  const [submitted, setSubmitted] = useState(false);
  const [serverField, setServerField] = useState<ProfileField | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const errors = submitted ? fieldErrorsOf(draft) : {};
  const invalid = (field: ProfileField) =>
    errors[field] === true || serverField === field;
  const objectTypes = Array.from(
    new Set([
      ...(typeOptions ?? []).map((option) => option.name),
      ...(profile?.objectType ? [profile.objectType] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setServerField(null);
    if (!profileSchema.safeParse(draft).success) return;
    const definition = {
      name: draft.name,
      objectType: draft.objectType.trim() || undefined,
      stages: draft.stages,
      requirements: draft.requirements,
    };
    setIsSaving(true);
    try {
      if (profile)
        await updateProfile({ profileId: profile._id, ...definition });
      else await createProfile({ organizationId, ...definition });
      toast.success(t("profiles.saved"));
      onOpenChange(false);
    } catch (error) {
      setServerField(qualityErrorFromError(error)?.field ?? null);
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
              {profile ? t("profiles.editTitle") : t("profiles.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("profiles.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t("profiles.fields.name")}</Label>
            <Input
              id="profile-name"
              value={draft.name}
              maxLength={120}
              aria-invalid={invalid("name")}
              aria-describedby={
                invalid("name") ? "profile-name-error" : undefined
              }
              onChange={(event) => {
                const name = event.target.value;
                setDraft((current) => ({ ...current, name }));
              }}
              disabled={isSaving}
            />
            {invalid("name") ? (
              <p id="profile-name-error" className="text-xs text-destructive">
                {t("profiles.errors.name")}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-object-type">
              {t("profiles.fields.objectType")}
            </Label>
            <Select
              value={draft.objectType || ALL_TYPES}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  objectType: value === ALL_TYPES ? "" : value,
                }))
              }
              disabled={isSaving}
            >
              <SelectTrigger
                id="profile-object-type"
                aria-invalid={invalid("objectType")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>
                  {t("profiles.allTypes")}
                </SelectItem>
                {objectTypes.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("profiles.objectTypeHint")}
            </p>
          </div>

          <fieldset
            className="space-y-2"
            aria-invalid={invalid("stages")}
            aria-describedby={
              invalid("stages") ? "profile-stages-error" : undefined
            }
          >
            <legend className="text-sm font-medium">
              {t("profiles.fields.stages")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DOCUMENTATION_STAGES.map((stage) => (
                <Label
                  key={stage}
                  className="flex items-start gap-2 rounded-md border border-border p-2 font-normal"
                >
                  <Checkbox
                    checked={draft.stages.includes(stage)}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        stages: toggle(current.stages, stage, checked === true),
                      }))
                    }
                    disabled={isSaving}
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm">
                      {t(`stages.${stage}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`stageHints.${stage}`)}
                    </span>
                  </span>
                </Label>
              ))}
            </div>
            {invalid("stages") ? (
              <p id="profile-stages-error" className="text-xs text-destructive">
                {t("profiles.errors.stages")}
              </p>
            ) : null}
          </fieldset>

          <fieldset
            className="space-y-2"
            aria-invalid={invalid("requirements")}
            aria-describedby={
              invalid("requirements") ? "profile-requirements-error" : undefined
            }
          >
            <legend className="text-sm font-medium">
              {t("profiles.fields.requirements")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DOCUMENTATION_REQUIREMENTS.map((requirement) => (
                <Label
                  key={requirement}
                  className="flex items-center gap-2 rounded-md border border-border p-2 font-normal"
                >
                  <Checkbox
                    checked={draft.requirements.includes(requirement)}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        requirements: toggle(
                          current.requirements,
                          requirement,
                          checked === true,
                        ),
                      }))
                    }
                    disabled={isSaving}
                  />
                  <span className="text-sm">
                    {t(`requirements.${requirement}`)}
                  </span>
                </Label>
              ))}
            </div>
            {invalid("requirements") ? (
              <p
                id="profile-requirements-error"
                className="text-xs text-destructive"
              >
                {t("profiles.errors.requirements")}
              </p>
            ) : null}
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("profiles.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("profiles.saving") : t("profiles.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
