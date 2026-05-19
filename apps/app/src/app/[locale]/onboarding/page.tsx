"use client";

import { useI18n } from "@/locales/client";
import { useForm } from "@tanstack/react-form";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import * as validators from "@v1/backend/convex/utils/validators";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Database,
  FolderPlus,
  Loader2,
  Plus,
  Upload,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Step = "username" | "organization" | "firstData";

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

export default function OnboardingPage() {
  const t = useI18n();
  const { push } = useRouter();
  const user = useQuery(api.users.getUser);
  const organizations = useQuery(api.organizations.listUserOrganizations);
  const updateUsername = useMutation(api.users.updateUsername);
  const createOrganization = useMutation(api.organizations.create);

  const [currentStep, setCurrentStep] = useState<Step>("username");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<Id<"organizations"> | null>(
    null,
  );
  const [orgFormData, setOrgFormData] = useState({
    name: "",
    slug: "",
    type: "museum" as "museum" | "gallery" | "library" | "collector",
  });

  const usernameForm = useForm({
    defaultValues: { username: "" },
    onSubmit: async ({ value }) => {
      await updateUsername({ username: value.username });
      setCurrentStep("organization");
    },
  });

  const firstOrganizationId = createdOrgId ?? organizations?.[0]?._id ?? null;

  const collectionsPreview = useQuery(
    api.collections.list,
    firstOrganizationId
      ? {
          organizationId: firstOrganizationId,
          paginationOpts: { numItems: 1, cursor: null },
        }
      : "skip",
  );

  useEffect(() => {
    if (!user || organizations === undefined) return;

    const hasOrganization = organizations.length > 0 || createdOrgId !== null;
    if (user.username && hasOrganization) {
      if (collectionsPreview === undefined) return;

      if (collectionsPreview.page.length > 0) {
        push("/");
        return;
      }

      setCurrentStep("firstData");
      return;
    }

    if (user.username) {
      setCurrentStep("organization");
    }
  }, [user, organizations, push, collectionsPreview, createdOrgId]);

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    setIsSubmitting(true);

    try {
      const slug =
        orgFormData.slug ||
        orgFormData.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

      const organizationId = await createOrganization({
        name: orgFormData.name,
        slug,
        type: orgFormData.type,
      });

      setCreatedOrgId(organizationId);
      setCurrentStep("firstData");
    } catch (err) {
      if (isOrganizationSlugTakenError(err)) {
        setOrgError(t("organizationsNew.slugTaken"));
      } else {
        setOrgError(t("organizationsNew.createFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex size-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex size-full max-w-md flex-col items-center justify-center gap-8 px-4">
      <StepIndicator currentStep={currentStep} />

      {currentStep === "username" && (
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <span className="mb-2 select-none text-6xl">👋</span>
            <h3 className="text-center text-2xl font-medium text-primary">
              {t("onboardingPage.welcome")}
            </h3>
            <p className="text-center text-base font-normal text-primary/60">
              {t("onboardingPage.description")}
            </p>
          </div>

          <form
            className="flex w-full flex-col items-start gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              usernameForm.handleSubmit();
            }}
          >
            <div className="flex w-full flex-col gap-1.5">
              <label htmlFor="username" className="sr-only">
                {t("onboardingPage.usernameLabel")}
              </label>
              <usernameForm.Field
                name="username"
                validators={{ onSubmit: validators.username }}
                // biome-ignore lint/correctness/noChildrenProp: tanstack best practice
                children={(field) => (
                  <Input
                    placeholder={t("onboardingPage.usernameLabel")}
                    autoComplete="off"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={`bg-transparent ${
                      field.state.meta?.errors.length > 0 &&
                      "border-destructive focus-visible:ring-destructive"
                    }`}
                  />
                )}
              />
            </div>

            {usernameForm.state.fieldMeta.username?.errors.length > 0 && (
              <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                {usernameForm.state.fieldMeta.username?.errors.join(" ")}
              </span>
            )}

            <Button type="submit" size="sm" className="mt-2 w-full">
              {usernameForm.state.isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                t("onboardingPage.continue")
              )}
            </Button>
          </form>

          <p className="px-6 text-center text-sm font-normal leading-normal text-primary/60">
            {t("onboardingPage.updateNote")}
          </p>
        </div>
      )}

      {currentStep === "organization" && (
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

          <form onSubmit={handleOrgSubmit} className="w-full space-y-4">
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
      )}

      {currentStep === "firstData" && (
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Database className="size-8 text-primary" />
            </div>
            <h3 className="text-center text-2xl font-medium text-primary">
              {t("onboardingPage.dataTitle")}
            </h3>
            <p className="text-center text-base font-normal text-primary/60">
              {t("onboardingPage.dataDescription")}
            </p>
          </div>

          <div className="grid w-full gap-3">
            <Button asChild>
              <Link href="/objects/new">
                <Plus className="mr-2 size-4" />
                {t("onboardingPage.addFirstObject")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/collections/import">
                <Upload className="mr-2 size-4" />
                {t("onboardingPage.importObjects")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/collections/new">
                <FolderPlus className="mr-2 size-4" />
                {t("onboardingPage.createCollectionGroup")}
              </Link>
            </Button>
          </div>

          <Button variant="ghost" onClick={() => push("/")}>
            {t("onboardingPage.skipForNow")}
          </Button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { id: "username" as const, icon: User },
    { id: "organization" as const, icon: Building2 },
    { id: "firstData" as const, icon: Database },
  ];
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isPast
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-5" />
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  isPast ? "bg-primary/40" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
