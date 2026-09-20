"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
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
import { ArrowLeft, FolderOpen, Loader2, Save, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

interface NewCollectionFormData {
  name: string;
  description: string;
  curatorId: Id<"users"> | undefined;
  managedByRoleId: Id<"roles"> | undefined;
}

export default function NewCollectionPage() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createGroup = useMutation(api.collectionGroups.create);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewCollectionFormData>({
    name: "",
    description: "",
    curatorId: undefined,
    managedByRoleId: undefined,
  });

  const members = useQuery(
    api.organizations.listOrganizationUsers,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationCreate")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    if (!formData.name.trim()) {
      setError(t("form.nameError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createGroup({
        organizationId: currentOrganizationId,
        name: formData.name,
        description: formData.description,
        curatorId: formData.curatorId,
        managedByRoleId: formData.managedByRoleId,
      });
      push("/collections");
    } catch (err) {
      console.error("Error creating collection:", err);
      setError(err instanceof Error ? err.message : t("form.createError"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="@container h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-4">
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t("backToCollections")}
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("newCollection")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("createPage.description")}
            </p>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
          aria-busy={isSubmitting}
        >
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <fieldset
            disabled={isSubmitting}
            className="grid min-w-0 gap-5 @min-[52rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
          >
            <legend className="sr-only">{t("newCollection")}</legend>

            <section
              aria-labelledby="collection-details-heading"
              className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6"
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                  <FolderOpen className="size-4" aria-hidden="true" />
                </span>
                <h2
                  id="collection-details-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("createPage.detailsTitle")}
                </h2>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t("form.nameLabel")}{" "}
                    <span className="text-red-500" aria-hidden="true">
                      {t("form.nameRequired")}
                    </span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder={t("form.namePlaceholder")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="description">
                      {t("form.descriptionLabel")}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {t("createPage.optional")}
                    </span>
                  </div>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder={t("form.descriptionPlaceholder")}
                    rows={6}
                    className="resize-y"
                  />
                </div>
              </div>
            </section>

            <section
              aria-labelledby="collection-management-heading"
              className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6"
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                    <Users className="size-4" aria-hidden="true" />
                  </span>
                  <h2
                    id="collection-management-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    {t("createPage.managementTitle")}
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("createPage.optional")}
                </span>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="curator">{t("form.curatorLabel")}</Label>
                  <Select
                    value={formData.curatorId ?? "none"}
                    disabled={isSubmitting || members === undefined}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        curatorId: members?.find(
                          (member) => member._id === value,
                        )?._id,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="curator"
                      className="min-w-0 [&>span]:truncate"
                    >
                      <SelectValue placeholder={t("form.curatorPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("form.noCurator")}
                      </SelectItem>
                      {members?.map((member) => (
                        <SelectItem key={member._id} value={member._id}>
                          {member.name || member.email || t("form.unknown")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managedByRole">
                    {t("form.managedByRoleLabel")}
                  </Label>
                  <Select
                    value={formData.managedByRoleId ?? "none"}
                    disabled={isSubmitting || roles === undefined}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        managedByRoleId: roles?.find(
                          (role) => role._id === value,
                        )?._id,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="managedByRole"
                      aria-describedby="managed-by-role-hint"
                      className="min-w-0 [&>span]:truncate"
                    >
                      <SelectValue
                        placeholder={t("form.managedByRolePlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("form.anyRole")}</SelectItem>
                      {roles?.map((role) => (
                        <SelectItem key={role._id} value={role._id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p
                    id="managed-by-role-hint"
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    {t("form.roleHint")}
                  </p>
                </div>
              </div>
            </section>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 sm:px-6">
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {t("createPage.objectsHint")}
            </p>
            <div className="flex w-full flex-wrap items-center gap-2 @min-[36rem]:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => push("/collections")}
                className="flex-1 @min-[36rem]:flex-none"
              >
                {common("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-auto min-h-9 flex-1 whitespace-normal @min-[36rem]:flex-none"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {isSubmitting ? t("form.creating") : t("form.createButton")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
