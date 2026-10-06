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

type PreferencesPageUpdate =
  | Partial<PreferencesPageState>
  | ((current: PreferencesPageState) => Partial<PreferencesPageState>);

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
  update: PreferencesPageUpdate,
): PreferencesPageState {
  return {
    ...state,
    ...(typeof update === "function" ? update(state) : update),
  };
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

function usePreferencesPage() {
  const t = useScopedI18n("settings");
  const tCommon = useScopedI18n("common");
  const tDashboard = useScopedI18n("untranslatedDashboard.settings");
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
    dispatch({
      formData: {
        accessionNumberFormat:
          organization.settings?.accessionNumberFormat || "",
        accessionCounterScope:
          organization.settings?.accessionCounterScope || "year",
        autoGenerateAccessionNumbers:
          organization.settings?.autoGenerateAccessionNumbers ?? true,
        accessionWorkflowEnabled:
          organization.settings?.accessionWorkflowEnabled ?? true,
        deaccessionWorkflowEnabled:
          organization.settings?.deaccessionWorkflowEnabled ?? true,
        allowIncomingTransferRequests:
          organization.settings?.allowIncomingTransferRequests ??
          organization.allowsIncomingTransferRequests ??
          false,
        locationTrackingEnabled:
          organization.settings?.locationTrackingEnabled ?? true,
        locationTypes: organization.settings?.locationTypes || [],
        enableDetailedConditionReports:
          organization.settings?.enableDetailedConditionReports ?? false,
      },
    });
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
        error: t("organization.templateDialog.validTemplateRequired"),
      });
      return;
    }

    dispatch({
      saveTemplateName:
        isUpdate && selectedCustomTemplate ? selectedCustomTemplate.name : "",
      saveTemplateDesc:
        isUpdate && selectedCustomTemplate
          ? selectedCustomTemplate.description || ""
          : "",
      showSaveModal: true,
    });
  };

  const handleSaveTemplate = async () => {
    if (!currentOrganizationId || !state.saveTemplateName.trim()) {
      dispatch({
        error: t("organization.templateDialog.templateNameRequired"),
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
      dispatch({
        showSaveModal: false,
        saveTemplateName: "",
        saveTemplateDesc: "",
      });
    } catch {
      dispatch({ error: t("organization.templateDialog.saveError") });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!state.deleteTemplateId) return;

    try {
      await removeTemplate({ templateId: state.deleteTemplateId });
      if (state.deleteTemplateId === selectedCustomTemplateId) {
        dispatch((current) => ({
          formData: { ...current.formData, accessionNumberFormat: "" },
        }));
      }
      dispatch({ deleteTemplateId: null });
    } catch {
      dispatch({ error: t("organization.templateDialog.deleteError") });
    }
  };

  const handleSavePreferences = async () => {
    if (!currentOrganizationId) return;
    dispatch({ error: null });

    if (
      state.formData.accessionNumberFormat &&
      validation &&
      !validation.isValid
    ) {
      dispatch({ error: `Invalid accession format: ${validation.error}` });
      return;
    }

    dispatch({ isSubmitting: true });
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
    } catch {
      dispatch({ error: tDashboard("updatePreferencesFailed") });
    } finally {
      dispatch({ isSubmitting: false });
    }
  };

  return {
    t,
    tCommon,
    tDashboard,
    currentOrganizationId,
    state,
    dispatch,
    organization,
    validation,
    systemPresets,
    customTemplateOptions,
    selectedCustomTemplateId,
    openSaveTemplateModal,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleSavePreferences,
  };
}

export default function PreferencesSettingsPage() {
  const {
    t,
    tCommon,
    tDashboard,
    currentOrganizationId,
    state,
    dispatch,
    organization,
    validation,
    systemPresets,
    customTemplateOptions,
    selectedCustomTemplateId,
    openSaveTemplateModal,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleSavePreferences,
  } = usePreferencesPage();

  if (!currentOrganizationId) {
    return (
      <PreferencesPageShell>
        <PreferencesStatusPanel
          message={tDashboard("selectOrganizationPreferences")}
        />
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
          dispatch((current) => ({
            formData:
              typeof value === "function" ? value(current.formData) : value,
          }))
        }
        t={t}
        systemPresets={systemPresets}
        customTemplateOptions={customTemplateOptions}
        validation={validation}
        selectedCustomTemplateId={selectedCustomTemplateId}
        onOpenSaveTemplateModal={openSaveTemplateModal}
        onDeleteTemplate={(id) => dispatch({ deleteTemplateId: id })}
        isSubmitting={state.isSubmitting}
        onSavePreferences={handleSavePreferences}
      />

      <Suspense fallback={<p>{tCommon("loading")}</p>}>
        <IdentifierReview organizationId={currentOrganizationId} />
      </Suspense>

      <PreferencesSaveTemplateDialog
        accessionNumberFormat={state.formData.accessionNumberFormat}
        isOpen={state.showSaveModal}
        isUpdate={!!selectedCustomTemplateId}
        onOpenChange={(open) => dispatch({ showSaveModal: open })}
        onSave={handleSaveTemplate}
        preview={validation?.preview}
        saveTemplateDesc={state.saveTemplateDesc}
        saveTemplateName={state.saveTemplateName}
        setSaveTemplateDesc={(saveTemplateDesc) =>
          dispatch({ saveTemplateDesc })
        }
        setSaveTemplateName={(saveTemplateName) =>
          dispatch({ saveTemplateName })
        }
        t={t}
      />

      <PreferencesDeleteTemplateDialog
        deleteTemplateId={state.deleteTemplateId}
        onClose={() => dispatch({ deleteTemplateId: null })}
        onConfirm={handleDeleteTemplate}
        t={t}
      />
    </PreferencesPageShell>
  );
}
