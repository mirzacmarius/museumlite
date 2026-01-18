"use client";

import { useOrganization } from "@/components/organization-provider";
import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
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

export default function NewOrganizationPage() {
  const t = useI18n();
  const router = useRouter();
  const createOrganization = useMutation(api.organizations.create);
  const { setCurrentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      // Auto-generate slug from name if not provided
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
      });

      // Set as current organization
      setCurrentOrganizationId(organizationId as Id<"organizations">);

      // Redirect to dashboard
      router.push("/collections");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {t("organizationsNew.title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {t("organizationsNew.description")}
              </p>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium"
                >
                  {t("organizationsNew.nameLabel")}
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("organizationsNew.namePlaceholder")}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium"
                >
                  {t("organizationsNew.slugLabel")}
                </label>
                <Input
                  id="slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder={t("organizationsNew.slugPlaceholder")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("organizationsNew.slugHelp")}
                </p>
              </div>

              <div>
                <label
                  htmlFor="type"
                  className="mb-2 block text-sm font-medium"
                >
                  {t("organizationsNew.typeLabel")}
                </label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      type: value as typeof formData.type,
                    })
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
                  onClick={() => router.back()}
                >
                  {t("organizationsNew.cancel")}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
