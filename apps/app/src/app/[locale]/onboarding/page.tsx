"use client";

import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FirstDataStep } from "./first-data-step";
import {
  type OnboardingStep,
  type OrganizationFormData,
  isOrganizationSlugTakenError,
} from "./onboarding-types";
import { OrganizationStep } from "./organization-step";
import { StepIndicator } from "./step-indicator";
import { UsernameStep } from "./username-step";

export default function OnboardingPage() {
  const t = useI18n();
  const { push } = useRouter();
  const user = useQuery(api.users.getUser);
  const organizations = useQuery(api.organizations.listUserOrganizations);
  const updateUsername = useMutation(api.users.updateUsername);
  const createOrganization = useMutation(api.organizations.create);

  const [currentStep, setCurrentStep] = useState<OnboardingStep>("username");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<Id<"organizations"> | null>(
    null,
  );
  const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
    name: "",
    slug: "",
    type: "museum",
  });

  const handleUsernameContinue = async (username: string) => {
    await updateUsername({ username });
    setCurrentStep("organization");
  };

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
        <UsernameStep onContinue={handleUsernameContinue} />
      )}

      {currentStep === "organization" && (
        <OrganizationStep
          orgFormData={orgFormData}
          setOrgFormData={setOrgFormData}
          orgError={orgError}
          isSubmitting={isSubmitting}
          onSubmit={handleOrgSubmit}
        />
      )}

      {currentStep === "firstData" && (
        <FirstDataStep onSkip={() => push("/")} />
      )}
    </div>
  );
}
