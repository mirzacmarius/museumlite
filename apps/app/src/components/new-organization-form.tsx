"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useI18n } from "@/locales/client";

function getConvexErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return null;
  }

  const data = error.data;
  if (!data || typeof data !== "object" || !("code" in data)) {
    return null;
  }

  const { code } = data;
  return typeof code === "string" ? code : null;
}

function isOrganizationSlugTakenError(error: unknown): boolean {
  const code = getConvexErrorCode(error);
  if (code === "ORGANIZATION_SLUG_TAKEN") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return `${error.message}\n${error.stack ?? ""}`.includes(
    "Organization slug already exists",
  );
}

export function NewOrganizationForm() {
  const t = useI18n();
  const { push } = useRouter();
  const createOrganization = useMutation(api.organizations.create);
  const { currentOrganization, setCurrentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createAsSubOrganization, setCreateAsSubOrganization] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    type: "museum" as "museum" | "gallery" | "library" | "collector",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const slug =
        formData.slug ||
        formData.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

      const organizationId = await createOrganization({
        name: formData.name,
        slug,
        type: formData.type,
        parentOrganizationId:
          createAsSubOrganization && currentOrganization
            ? currentOrganization._id
            : undefined,
      });

      setCurrentOrganizationId(organizationId as Id<"organizations">);
      push("/settings/organization");
    } catch (err) {
      if (isOrganizationSlugTakenError(err)) {
        setError(t("organizationsNew.slugTaken"));
      } else {
        setError(t("organizationsNew.createFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-primary">
          {t("organizationsNew.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("organizationsNew.description")}
        </p>
      </div>

      <div className="max-w-2xl rounded-lg border border-border bg-card">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">
              {t("organizationsNew.nameLabel")}
            </label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
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
              value={formData.slug}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
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
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  type: value as typeof formData.type,
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

          {currentOrganization &&
            (currentOrganization.subscriptionTier === "pro" ||
              currentOrganization.subscriptionTier === "enterprise") && (
              <label
                htmlFor="create-as-sub-organization"
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <Checkbox
                  id="create-as-sub-organization"
                  checked={createAsSubOrganization}
                  onCheckedChange={(checked) =>
                    setCreateAsSubOrganization(checked === true)
                  }
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    Create under {currentOrganization.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Sub-organizations can transfer objects within the same
                    hierarchy.
                  </span>
                </span>
              </label>
            )}

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting || !formData.name}>
              {isSubmitting
                ? t("organizationsNew.submitting")
                : t("organizationsNew.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => push("/settings/organization")}
            >
              {t("organizationsNew.cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
