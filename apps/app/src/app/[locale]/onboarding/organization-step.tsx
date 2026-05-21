"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Building2, Loader2 } from "lucide-react";
import { useI18n } from "@/locales/client";
import type { OrganizationFormData } from "./onboarding-types";

interface OrganizationStepProps {
  orgFormData: OrganizationFormData;
  setOrgFormData: React.Dispatch<React.SetStateAction<OrganizationFormData>>;
  orgError: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function OrganizationStep({
  orgFormData,
  setOrgFormData,
  orgError,
  isSubmitting,
  onSubmit,
}: OrganizationStepProps) {
  const t = useI18n();

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="size-8 text-primary" />
        </div>
        <h3 className="text-center text-2xl font-medium text-primary">
          {t("onboardingPage.orgTitle")}
        </h3>
        <p className="text-center text-base font-normal text-primary/60">
          {t("onboardingPage.orgDescription")}
        </p>
      </div>

      <form onSubmit={onSubmit} className="w-full space-y-4">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            {t("organizationsNew.nameLabel")}
          </label>
          <Input
            id="name"
            type="text"
            value={orgFormData.name}
            onChange={(e) =>
              setOrgFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder={t("organizationsNew.namePlaceholder")}
            required
          />
        </div>

        <div>
          <label htmlFor="slug" className="mb-2 block text-sm font-medium">
            {t("organizationsNew.slugLabel")}
          </label>
          <Input
            id="slug"
            type="text"
            value={orgFormData.slug}
            onChange={(e) =>
              setOrgFormData((prev) => ({ ...prev, slug: e.target.value }))
            }
            placeholder={t("organizationsNew.slugPlaceholder")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organizationsNew.slugHelp")}
          </p>
        </div>

        <div>
          <label htmlFor="type" className="mb-2 block text-sm font-medium">
            {t("organizationsNew.typeLabel")}
          </label>
          <Select
            value={orgFormData.type}
            onValueChange={(value) =>
              setOrgFormData((prev) => ({
                ...prev,
                type: value as typeof orgFormData.type,
              }))
            }
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="museum">
                {t("organizationsNew.types.museum")}
              </SelectItem>
              <SelectItem value="gallery">
                {t("organizationsNew.types.gallery")}
              </SelectItem>
              <SelectItem value="library">
                {t("organizationsNew.types.library")}
              </SelectItem>
              <SelectItem value="collector">
                {t("organizationsNew.types.collector")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orgError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{orgError}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !orgFormData.name}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            t("organizationsNew.submit")
          )}
        </Button>
      </form>
    </div>
  );
}
