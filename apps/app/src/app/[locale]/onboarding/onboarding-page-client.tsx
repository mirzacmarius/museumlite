"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useReducer,
} from "react";
import { useI18n } from "@/locales/client";
import { CollectionSetupStep } from "./collection-setup-step";
import { FirstDataStep } from "./first-data-step";
import {
  isOrganizationSlugTakenError,
  type OnboardingStep,
  type OrganizationFormData,
} from "./onboarding-types";
import { OrganizationStep } from "./organization-step";
import { StepIndicator } from "./step-indicator";
import { UsernameStep } from "./username-step";

interface OnboardingPageState {
  currentStep: OnboardingStep;
  isSubmitting: boolean;
  orgError: string | null;
  createdOrgId: Id<"organizations"> | null;
  orgFormData: OrganizationFormData;
  collectionSetupCompleted: boolean;
}

type OnboardingPageAction =
  | { type: "setCurrentStep"; value: OnboardingStep }
  | { type: "setSubmitting"; value: boolean }
  | { type: "setOrgError"; value: string | null }
  | { type: "setCreatedOrgId"; value: Id<"organizations"> | null }
  | { type: "setOrgFormData"; value: OrganizationFormData }
  | { type: "setCollectionSetupCompleted"; value: boolean };

const initialOnboardingPageState: OnboardingPageState = {
  currentStep: "username",
  isSubmitting: false,
  orgError: null,
  createdOrgId: null,
  orgFormData: {
    name: "",
    slug: "",
    type: "museum",
  },
  collectionSetupCompleted: false,
};

function onboardingPageReducer(
  state: OnboardingPageState,
  action: OnboardingPageAction,
): OnboardingPageState {
  switch (action.type) {
    case "setCurrentStep":
      return { ...state, currentStep: action.value };
    case "setSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setOrgError":
      return { ...state, orgError: action.value };
    case "setCreatedOrgId":
      return { ...state, createdOrgId: action.value };
    case "setOrgFormData":
      return { ...state, orgFormData: action.value };
    case "setCollectionSetupCompleted":
      return { ...state, collectionSetupCompleted: action.value };
  }
}

export function OnboardingPageClient() {
  const t = useI18n();
  const { push } = useRouter();
  const user = useQuery(api.users.getUser);
  const organizations = useQuery(api.organizations.listUserOrganizations);
  const updateUsername = useMutation(api.users.updateUsername);
  const createOrganization = useMutation(api.organizations.create);

  const [state, dispatch] = useReducer(
    onboardingPageReducer,
    initialOnboardingPageState,
  );

  const setOrgFormData: Dispatch<SetStateAction<OrganizationFormData>> =
    useCallback(
      (value) => {
        dispatch({
          type: "setOrgFormData",
          value: typeof value === "function" ? value(state.orgFormData) : value,
        });
      },
      [state.orgFormData],
    );

  const handleUsernameContinue = async (username: string) => {
    await updateUsername({ username });
    dispatch({ type: "setCurrentStep", value: "organization" });
  };

  const firstOrganizationId =
    state.createdOrgId ?? organizations?.[0]?._id ?? null;

  const collectionsPreview = useQuery(
    api.collections.list,
    firstOrganizationId
      ? {
          organizationId: firstOrganizationId,
          paginationOpts: { numItems: 1, cursor: null },
        }
      : "skip",
  );

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    firstOrganizationId ? { organizationId: firstOrganizationId } : "skip",
  );

  const completeCollectionSetup = useCallback(() => {
    dispatch({ type: "setCollectionSetupCompleted", value: true });
    dispatch({ type: "setCurrentStep", value: "firstData" });
  }, []);

  useEffect(() => {
    if (!user || organizations === undefined) return;

    const hasOrganization =
      organizations.length > 0 || state.createdOrgId !== null;
    if (user.username && hasOrganization) {
      if (collectionsPreview === undefined || collectionGroups === undefined) {
        return;
      }

      if (collectionsPreview.page.length > 0) {
        push("/");
        return;
      }

      const hasCollectionGroups = collectionGroups.length > 0;
      if (
        !state.collectionSetupCompleted &&
        !hasCollectionGroups &&
        state.currentStep !== "collectionSetup"
      ) {
        dispatch({ type: "setCurrentStep", value: "collectionSetup" });
        return;
      }

      if (
        state.currentStep !== "firstData" &&
        state.currentStep !== "collectionSetup"
      ) {
        dispatch({ type: "setCurrentStep", value: "firstData" });
      }
      return;
    }

    if (user.username) {
      dispatch({ type: "setCurrentStep", value: "organization" });
    }
  }, [
    user,
    organizations,
    push,
    collectionsPreview,
    collectionGroups,
    state.createdOrgId,
    state.collectionSetupCompleted,
    state.currentStep,
  ]);

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "setOrgError", value: null });
    dispatch({ type: "setSubmitting", value: true });

    try {
      const slug =
        state.orgFormData.slug ||
        state.orgFormData.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

      const organizationId = await createOrganization({
        name: state.orgFormData.name,
        slug,
        type: state.orgFormData.type,
      });

      dispatch({ type: "setCreatedOrgId", value: organizationId });
      dispatch({ type: "setCurrentStep", value: "collectionSetup" });
    } catch (err) {
      if (isOrganizationSlugTakenError(err)) {
        dispatch({
          type: "setOrgError",
          value: t("organizationsNew.slugTaken"),
        });
      } else {
        dispatch({
          type: "setOrgError",
          value: t("organizationsNew.createFailed"),
        });
      }
    } finally {
      dispatch({ type: "setSubmitting", value: false });
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
      <StepIndicator currentStep={state.currentStep} />

      {state.currentStep === "username" && (
        <UsernameStep onContinue={handleUsernameContinue} />
      )}

      {state.currentStep === "organization" && (
        <OrganizationStep
          orgFormData={state.orgFormData}
          setOrgFormData={setOrgFormData}
          orgError={state.orgError}
          isSubmitting={state.isSubmitting}
          onSubmit={handleOrgSubmit}
        />
      )}

      {state.currentStep === "collectionSetup" && firstOrganizationId && (
        <CollectionSetupStep
          organizationId={firstOrganizationId}
          orgFormData={state.orgFormData}
          onComplete={completeCollectionSetup}
          onSkip={completeCollectionSetup}
        />
      )}

      {state.currentStep === "firstData" && (
        <FirstDataStep onSkip={() => push("/")} />
      )}
    </div>
  );
}
