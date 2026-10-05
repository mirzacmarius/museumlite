"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useEffect, useMemo, useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

import { IdentifierReview } from "./identifier-review";

interface PreferencesPageState {
  error: string | null;
  isSubmitting: boolean;
  showSaveModal: boolean;
  saveTemplateName: string;
  saveTemplateDesc: string;
  deleteTemplateId: Id<"accessionTemplates"> | null;
  formData: PreferencesFormData;
}

type PreferencesPageAction =
  | { type: "setError"; value: string | null }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "setShowSaveModal"; value: boolean }
  | { type: "setSaveTemplateName"; value: string }
  | { type: "setSaveTemplateDesc"; value: string }
  | { type: "setDeleteTemplateId"; value: Id<"accessionTemplates"> | null }
  | { type: "setFormData"; value: PreferencesFormData }
  | {
      type: "updateFormData";
      updater: (current: PreferencesFormData) => PreferencesFormData;
    }
  | {
      type: "syncFromOrganization";
      organization: {
        accountNumber?: string;
        allowsIncomingTransferRequests?: boolean;
        settings?: {
          accessionNumberFormat?: string;
          accessionCounterScope?: PreferencesFormData["accessionCounterScope"];
          autoGenerateAccessionNumbers?: boolean;
          accessionWorkflowEnabled?: boolean;
          deaccessionWorkflowEnabled?: boolean;
          allowIncomingTransferRequests?: boolean;
          locationTrackingEnabled?: boolean;
          locationTypes?: string[];
          enableDetailedConditionReports?: boolean;
        };
      };
    }
  | {
      type: "openSaveTemplateModal";
      isUpdate: boolean;
      template?: { name: string; description?: string };
    }
  | { type: "closeSaveTemplateModal" }
  | { type: "clearDeleteTemplateId" };

const initialPreferencesFormData: PreferencesFormData = {
  accessionNumberFormat: "",
  accessionCounterScope: "year",
  autoGenerateAccessionNumbers: true,
  accessionWorkflowEnabled: true,
  deaccessionWorkflowEnabled: true,
  allowIncomingTransferRequests: false,
  locationTrackingEnabled: true,
  locationTypes: [],
  enableDetailedConditionReports: false,
};

const initialPreferencesPageState: PreferencesPageState = {
  error: null,
  isSubmitting: false,
  showSaveModal: false,
  saveTemplateName: "",
  saveTemplateDesc: "",
  deleteTemplateId: null,
  formData: initialPreferencesFormData,
};

function preferencesPageReducer(
  state: PreferencesPageState,
  action: PreferencesPageAction,
): PreferencesPageState {
  switch (action.type) {
    case "setError":
      return { ...state, error: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setShowSaveModal":
      return { ...state, showSaveModal: action.value };
    case "setSaveTemplateName":
      return { ...state, saveTemplateName: action.value };
    case "setSaveTemplateDesc":
      return { ...state, saveTemplateDesc: action.value };
    case "setDeleteTemplateId":
      return { ...state, deleteTemplateId: action.value };
    case "setFormData":
      return { ...state, formData: action.value };
    case "updateFormData":
      return { ...state, formData: action.updater(state.formData) };
    case "syncFromOrganization":
      return {
        ...state,
        formData: {
          accessionNumberFormat:
            action.organization.settings?.accessionNumberFormat || "",
          accessionCounterScope:
            action.organization.settings?.accessionCounterScope || "year",
          autoGenerateAccessionNumbers:
            action.organization.settings?.autoGenerateAccessionNumbers ?? true,
          accessionWorkflowEnabled:
            action.organization.settings?.accessionWorkflowEnabled ?? true,
          deaccessionWorkflowEnabled:
            action.organization.settings?.deaccessionWorkflowEnabled ?? true,
          allowIncomingTransferRequests:
            action.organization.settings?.allowIncomingTransferRequests ??
            action.organization.allowsIncomingTransferRequests ??
            false,
          locationTrackingEnabled:
            action.organization.settings?.locationTrackingEnabled ?? true,
          locationTypes: action.organization.settings?.locationTypes || [],
          enableDetailedConditionReports:
            action.organization.settings?.enableDetailedConditionReports ??
            false,
        },
      };
    case "openSaveTemplateModal":
      return {
        ...state,
        saveTemplateName:
          action.isUpdate && action.template ? action.template.name : "",
        saveTemplateDesc:
          action.isUpdate && action.template
            ? action.template.description || ""
            : "",
        showSaveModal: true,
      };
    case "closeSaveTemplateModal":
      return {
        ...state,
        showSaveModal: false,
        saveTemplateName: "",
        saveTemplateDesc: "",
      };
    case "clearDeleteTemplateId":
      return { ...state, deleteTemplateId: null };
  }
}

import {
  type PreferencesFormData,
  PreferencesSettingsForm,
} from "./preferences-settings-form";
import {
  PreferencesDeleteTemplateDialog,
  PreferencesPageShell,
  PreferencesSaveTemplateDialog,
  PreferencesStatusPanel,
} from "./preferences-settings-shared";

export default function PreferencesSettingsPage() {
  const t = useScopedI18n("settings");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [state, dispatch] = useReducer(
    preferencesPageReducer,
    initialPreferencesPageState,
  );

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const validation = useQuery(
    api.organizations.validateAccessionFormat,
    state.formData.accessionNumberFormat && organization
      ? {
          template: state.formData.accessionNumberFormat,
          organizationSlug: organization.slug,
        }
      : "skip",
  );
  const presets = useQuery(api.organizations.getAccessionTemplatePresets, {});
  const customTemplates = useQuery(
    api.accessionTemplates.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const updateOrganization = useMutation(api.organizations.update);
  const ensureTransferRegistryFields = useMutation(
    api.organizations.ensureTransferRegistryFields,
  );
  const createTemplate = useMutation(api.accessionTemplates.create);
  const removeTemplate = useMutation(api.accessionTemplates.remove);
  const updateTemplate = useMutation(api.accessionTemplates.update);

  useEffect(() => {
    if (!organization) return;
    dispatch({ type: "syncFromOrganization", organization });
  }, [organization]);

  useEffect(() => {
    if (!currentOrganizationId || organization?.accountNumber) return;
    void ensureTransferRegistryFields({
      organizationId: currentOrganizationId as Id<"organizations">,
    });
  }, [
    currentOrganizationId,
    ensureTransferRegistryFields,
    organization?.accountNumber,
  ]);

  const systemPresets = useMemo(
    () =>
      (presets || []).map((preset) => ({
        value: preset.template,
        label: preset.name,
        description: preset.description,
      })),
    [presets],
  );

  const customTemplateOptions = useMemo(
    () =>
      (customTemplates || []).map((template) => ({
        value: template.template,
        label: template.name,
        description: template.description,
        id: template._id,
      })),
    [customTemplates],
  );

  const selectedCustomTemplate = useMemo(
    () =>
      customTemplates?.find(
        (template) =>
          template.template === state.formData.accessionNumberFormat,
      ),
    [customTemplates, state.formData.accessionNumberFormat],
  );

  const selectedCustomTemplateId = selectedCustomTemplate?._id ?? null;

  const openSaveTemplateModal = (isUpdate = false) => {
    if (!state.formData.accessionNumberFormat || !validation?.isValid) {
      dispatch({
        type: "setError",
        value: t("organization.templateDialog.validTemplateRequired"),
      });
      return;
    }

    dispatch({
      type: "openSaveTemplateModal",
      isUpdate,
      template:
        isUpdate && selectedCustomTemplate ? selectedCustomTemplate : undefined,
    });
  };

  const handleSaveTemplate = async () => {
    if (!currentOrganizationId || !state.saveTemplateName.trim()) {
      dispatch({
        type: "setError",
        value: t("organization.templateDialog.templateNameRequired"),
      });
      return;
    }

    try {
      if (selectedCustomTemplateId) {
        await updateTemplate({
          templateId: selectedCustomTemplateId,
          name: state.saveTemplateName.trim(),
          description: state.saveTemplateDesc.trim() || undefined,
          template: state.formData.accessionNumberFormat,
        });
      } else {
        await createTemplate({
          organizationId: currentOrganizationId as Id<"organizations">,
          name: state.saveTemplateName.trim(),
          template: state.formData.accessionNumberFormat,
          description: state.saveTemplateDesc.trim() || undefined,
        });
      }
      dispatch({ type: "closeSaveTemplateModal" });
    } catch (err) {
      dispatch({
        type: "setError",
        value:
          err instanceof Error
            ? err.message
            : t("organization.templateDialog.saveError"),
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!state.deleteTemplateId) return;

    try {
      await removeTemplate({ templateId: state.deleteTemplateId });
      if (state.deleteTemplateId === selectedCustomTemplateId) {
        dispatch({
          type: "updateFormData",
          updater: (current) => ({
            ...current,
            accessionNumberFormat: "",
          }),
        });
      }
      dispatch({ type: "clearDeleteTemplateId" });
    } catch (err) {
      dispatch({
        type: "setError",
        value:
          err instanceof Error
            ? err.message
            : t("organization.templateDialog.deleteError"),
      });
    }
  };

  const handleSavePreferences = async () => {
    if (!currentOrganizationId) return;
    dispatch({ type: "setError", value: null });

    if (
      state.formData.accessionNumberFormat &&
      validation &&
      !validation.isValid
    ) {
      dispatch({
        type: "setError",
        value: `Invalid accession format: ${validation.error}`,
      });
      return;
    }

    dispatch({ type: "setIsSubmitting", value: true });
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        settings: {
          accessionNumberFormat:
            state.formData.accessionNumberFormat.trim() || undefined,
          accessionCounterScope: state.formData.accessionCounterScope,
          autoGenerateAccessionNumbers:
            state.formData.autoGenerateAccessionNumbers,
          accessionWorkflowEnabled: state.formData.accessionWorkflowEnabled,
          deaccessionWorkflowEnabled: state.formData.deaccessionWorkflowEnabled,
          allowIncomingTransferRequests:
            state.formData.allowIncomingTransferRequests,
          locationTrackingEnabled: state.formData.locationTrackingEnabled,
          locationTypes:
            state.formData.locationTypes.length > 0
              ? state.formData.locationTypes
              : undefined,
          enableDetailedConditionReports:
            state.formData.enableDetailedConditionReports,
        },
      });
    } catch (err) {
      dispatch({
        type: "setError",
        value:
          err instanceof Error ? err.message : "Failed to update preferences",
      });
    } finally {
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  if (!currentOrganizationId) {
    return (
      <PreferencesPageShell>
        <PreferencesStatusPanel message="Please select an organization to manage preferences." />
      </PreferencesPageShell>
    );
  }

  if (organization === undefined) {
    return (
      <PreferencesPageShell>
        <PreferencesStatusPanel message={tCommon("loading")} />
      </PreferencesPageShell>
    );
  }

  if (organization === null) {
    return (
      <PreferencesPageShell>
        <PreferencesStatusPanel message={tCommon("noResults")} />
      </PreferencesPageShell>
    );
  }

  return (
    <PreferencesPageShell>
      {state.error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <PreferencesSettingsForm
        currentOrganizationId={currentOrganizationId}
        organizationAccountNumber={organization.accountNumber}
        formData={state.formData}
        setFormData={(value) =>
          dispatch(
            typeof value === "function"
              ? { type: "updateFormData", updater: value }
              : { type: "setFormData", value },
          )
        }
        t={t}
        systemPresets={systemPresets}
        customTemplateOptions={customTemplateOptions}
        validation={validation}
        selectedCustomTemplateId={selectedCustomTemplateId}
        onOpenSaveTemplateModal={openSaveTemplateModal}
        onDeleteTemplate={(id) =>
          dispatch({ type: "setDeleteTemplateId", value: id })
        }
        isSubmitting={state.isSubmitting}
        onSavePreferences={handleSavePreferences}
      />

      <Suspense fallback={<p>Loading identifier review...</p>}>
        <IdentifierReview organizationId={currentOrganizationId} />
      </Suspense>

      <PreferencesSaveTemplateDialog
        accessionNumberFormat={state.formData.accessionNumberFormat}
        isOpen={state.showSaveModal}
        isUpdate={!!selectedCustomTemplateId}
        onOpenChange={(open) =>
          dispatch({ type: "setShowSaveModal", value: open })
        }
        onSave={handleSaveTemplate}
        preview={validation?.preview}
        saveTemplateDesc={state.saveTemplateDesc}
        saveTemplateName={state.saveTemplateName}
        setSaveTemplateDesc={(value) =>
          dispatch({ type: "setSaveTemplateDesc", value })
        }
        setSaveTemplateName={(value) =>
          dispatch({ type: "setSaveTemplateName", value })
        }
        t={t}
      />

      <PreferencesDeleteTemplateDialog
        deleteTemplateId={state.deleteTemplateId}
        onClose={() => dispatch({ type: "clearDeleteTemplateId" })}
        onConfirm={handleDeleteTemplate}
        t={t}
      />
    </PreferencesPageShell>
  );
}
