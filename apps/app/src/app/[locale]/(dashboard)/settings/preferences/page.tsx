"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] =
    useState<Id<"accessionTemplates"> | null>(null);
  const [formData, setFormData] = useState<PreferencesFormData>({
    accessionNumberFormat: "",
    accessionCounterScope: "year",
    autoGenerateAccessionNumbers: true,
    accessionWorkflowEnabled: true,
    deaccessionWorkflowEnabled: true,
    locationTrackingEnabled: true,
    locationTypes: [],
    enableDetailedConditionReports: false,
  });

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const validation = useQuery(
    api.organizations.validateAccessionFormat,
    formData.accessionNumberFormat && organization
      ? {
          template: formData.accessionNumberFormat,
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
  const createTemplate = useMutation(api.accessionTemplates.create);
  const removeTemplate = useMutation(api.accessionTemplates.remove);
  const updateTemplate = useMutation(api.accessionTemplates.update);

  useEffect(() => {
    if (!organization) return;
    setFormData({
      accessionNumberFormat: organization.settings?.accessionNumberFormat || "",
      accessionCounterScope:
        organization.settings?.accessionCounterScope || "year",
      autoGenerateAccessionNumbers:
        organization.settings?.autoGenerateAccessionNumbers ?? true,
      accessionWorkflowEnabled:
        organization.settings?.accessionWorkflowEnabled ?? true,
      deaccessionWorkflowEnabled:
        organization.settings?.deaccessionWorkflowEnabled ?? true,
      locationTrackingEnabled:
        organization.settings?.locationTrackingEnabled ?? true,
      locationTypes: organization.settings?.locationTypes || [],
      enableDetailedConditionReports:
        organization.settings?.enableDetailedConditionReports ?? false,
    });
  }, [organization]);

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
        (template) => template.template === formData.accessionNumberFormat,
      ),
    [customTemplates, formData.accessionNumberFormat],
  );

  const selectedCustomTemplateId = selectedCustomTemplate?._id ?? null;

  const openSaveTemplateModal = (isUpdate = false) => {
    if (!formData.accessionNumberFormat || !validation?.isValid) {
      setError(t("organization.templateDialog.validTemplateRequired"));
      return;
    }

    if (isUpdate && selectedCustomTemplate) {
      setSaveTemplateName(selectedCustomTemplate.name);
      setSaveTemplateDesc(selectedCustomTemplate.description || "");
    } else {
      setSaveTemplateName("");
      setSaveTemplateDesc("");
    }
    setShowSaveModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!currentOrganizationId || !saveTemplateName.trim()) {
      setError(t("organization.templateDialog.templateNameRequired"));
      return;
    }

    try {
      if (selectedCustomTemplateId) {
        await updateTemplate({
          templateId: selectedCustomTemplateId,
          name: saveTemplateName.trim(),
          description: saveTemplateDesc.trim() || undefined,
          template: formData.accessionNumberFormat,
        });
      } else {
        await createTemplate({
          organizationId: currentOrganizationId as Id<"organizations">,
          name: saveTemplateName.trim(),
          template: formData.accessionNumberFormat,
          description: saveTemplateDesc.trim() || undefined,
        });
      }
      setShowSaveModal(false);
      setSaveTemplateName("");
      setSaveTemplateDesc("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("organization.templateDialog.saveError"),
      );
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      await removeTemplate({ templateId: deleteTemplateId });
      if (deleteTemplateId === selectedCustomTemplateId) {
        setFormData((current) => ({
          ...current,
          accessionNumberFormat: "",
        }));
      }
      setDeleteTemplateId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("organization.templateDialog.deleteError"),
      );
    }
  };

  const handleSavePreferences = async () => {
    if (!currentOrganizationId) return;
    setError(null);

    if (formData.accessionNumberFormat && validation && !validation.isValid) {
      setError(`Invalid accession format: ${validation.error}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        settings: {
          accessionNumberFormat:
            formData.accessionNumberFormat.trim() || undefined,
          accessionCounterScope: formData.accessionCounterScope,
          autoGenerateAccessionNumbers: formData.autoGenerateAccessionNumbers,
          accessionWorkflowEnabled: formData.accessionWorkflowEnabled,
          deaccessionWorkflowEnabled: formData.deaccessionWorkflowEnabled,
          locationTrackingEnabled: formData.locationTrackingEnabled,
          locationTypes:
            formData.locationTypes.length > 0
              ? formData.locationTypes
              : undefined,
          enableDetailedConditionReports:
            formData.enableDetailedConditionReports,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update preferences",
      );
    } finally {
      setIsSubmitting(false);
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
      {error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <PreferencesSettingsForm
        currentOrganizationId={currentOrganizationId}
        formData={formData}
        setFormData={setFormData}
        t={t}
        systemPresets={systemPresets}
        customTemplateOptions={customTemplateOptions}
        validation={validation}
        selectedCustomTemplateId={selectedCustomTemplateId}
        onOpenSaveTemplateModal={openSaveTemplateModal}
        onDeleteTemplate={setDeleteTemplateId}
        isSubmitting={isSubmitting}
        onSavePreferences={handleSavePreferences}
      />

      <PreferencesSaveTemplateDialog
        accessionNumberFormat={formData.accessionNumberFormat}
        isOpen={showSaveModal}
        isUpdate={!!selectedCustomTemplateId}
        onOpenChange={setShowSaveModal}
        onSave={handleSaveTemplate}
        preview={validation?.preview}
        saveTemplateDesc={saveTemplateDesc}
        saveTemplateName={saveTemplateName}
        setSaveTemplateDesc={setSaveTemplateDesc}
        setSaveTemplateName={setSaveTemplateName}
        t={t}
      />

      <PreferencesDeleteTemplateDialog
        deleteTemplateId={deleteTemplateId}
        onClose={() => setDeleteTemplateId(null)}
        onConfirm={handleDeleteTemplate}
        t={t}
      />
    </PreferencesPageShell>
  );
}
